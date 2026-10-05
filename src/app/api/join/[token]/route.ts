import { NextRequest, NextResponse } from "next/server";
import { addDocumentRecord, addEmployeeRecord, setEmployeePdfLink } from "@/lib/store";
import { findInviteByToken, setInviteFields } from "@/lib/invites";
import { inviteState, isTokenShape } from "@/lib/invite-rules";
import { toEmployeePayload, buildMasterFields } from "@/lib/onboarding-fields";
import { buildOnboardingPdf } from "@/lib/onboarding-pdf";
import { uploadHrAttachment } from "@/lib/google-drive";
import { notifyHr } from "@/lib/waha";
import { companyLogo } from "@/lib/brand";
import { companyCode } from "@/lib/employee-id";
import { rateLimited } from "@/lib/rate-limit";
import { ValidationError, errorStatus, validateOnboardingStep } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Drive + WhatsApp can take 10-40 s; Vercel allows 10 s by default

const GONE: Record<string, string> = {
  expired: "This link has expired. Please ask HR to send you a new one.",
  used: "This form has already been submitted. Thank you!",
  cancelled: "This link is no longer active. Please contact HR.",
  busy: "Your form is being processed. Please wait a moment and refresh.",
};

const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

async function load(token: string) {
  if (!isTokenShape(token)) return { error: NextResponse.json({ success: false, error: "Invalid link." }, { status: 404 }) };
  const invite = await findInviteByToken(token);
  if (!invite) return { error: NextResponse.json({ success: false, error: "Invalid link." }, { status: 404 }) };
  const state = inviteState(invite, new Date());
  if (state !== "ok") return { error: NextResponse.json({ success: false, state, error: GONE[state] }, { status: 410 }) };
  return { invite };
}

/** Joiner opens the link: returns only what HR pre-filled. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (rateLimited(`join-get:${clientIp(req)}`, 30)) return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429 });
  try {
    const { token } = await params;
    const r = await load(token);
    if (r.error) return r.error;
    const { invite } = r;
    if (invite.status === "Invited") await setInviteFields(invite.rowNumber, { Status: "Opened", "Opened At": new Date().toISOString() });
    return NextResponse.json({
      success: true,
      data: { name: invite.name, mobile: invite.mobile, company: invite.company, department: invite.department, designation: invite.designation, manager: invite.manager, doj: invite.doj, mode: invite.mode },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Could not load the form. Please try again." }, { status: 500 });
  }
}

/** Joiner submits: the employee is created in the main database, the PDF is saved, HR is told. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (rateLimited(`join-post:${clientIp(req)}`, 6)) return NextResponse.json({ success: false, error: "Too many attempts. Please wait a minute." }, { status: 429 });
  const { token } = await params;
  const r = await load(token);
  if (r.error) return r.error;
  const { invite } = r;

  let claimed = false;
  try {
    const body = await req.json();
    // HR-controlled fields always come from the invitation, never from the browser
    const form: Record<string, string> = {
      ...Object.fromEntries(Object.entries(body.form ?? {}).map(([k, v]) => [k, String(v ?? "")])),
      company: invite.company, department: invite.department, designation: invite.designation, manager: invite.manager, doj: invite.doj,
    };
    if (!form.fullName?.trim()) form.fullName = invite.name;

    for (const step of [1, 2, 3, 5]) {
      const problem = validateOnboardingStep(step, form);
      if (problem) throw new ValidationError(problem);
    }

    // claim the invitation so a double-click cannot create two employees
    await setInviteFields(invite.rowNumber, { Status: "Processing" });
    claimed = true;

    const employee = await addEmployeeRecord(toEmployeePayload(form, `Joiner (${invite.inviteId})`));

    // Signed PDF -> Drive -> HR_Documents + master "PDF Link". Failure here must not undo the employee.
    let pdfLink = "", pdfWarning = "";
    try {
      const logo = companyLogo(employee.company);
      let logoData: { bytes: Uint8Array; type: "png" | "jpg" } | null = null;
      if (logo) {
        const res = await fetch(new URL(logo.src, req.nextUrl.origin));
        if (res.ok) logoData = { bytes: new Uint8Array(await res.arrayBuffer()), type: logo.src.endsWith(".png") ? "png" : "jpg" };
      }
      const pdf = await buildOnboardingPdf({
        company: employee.company, employeeId: employee.employeeId, fullName: employee.fullName,
        fields: buildMasterFields(form, employee.employeeId), logo: logoData,
      });
      const fileName = `${employee.fullName} - Employee Form.pdf`;
      const up = await uploadHrAttachment({ name: fileName, mimeType: "application/pdf", base64: Buffer.from(pdf).toString("base64") }, employee.fullName, employee.employeeKey, invite.inviteId);
      pdfLink = up.driveLink;
      await addDocumentRecord({ employeeKey: employee.employeeKey, documentType: "Onboarding Form", documentStatus: "Uploaded", fileName, driveFileId: up.driveFileId, driveLink: up.driveLink, notes: "Signed by the employee on the onboarding form", uploadedBy: "Joiner (self-service)" });
      await setEmployeePdfLink(employee.rowNumber, up.driveLink);
    } catch (e: any) {
      pdfWarning = e?.message || "PDF could not be saved";
    }

    await setInviteFields(invite.rowNumber, { Status: "Submitted", "Submitted At": new Date().toISOString(), "Employee Key": employee.employeeKey, "Employee ID": employee.employeeId });
    await notifyHr(`*New joiner form submitted*\n${employee.fullName} - ${employee.department} (${companyCode(employee.company)})\nEmployee ID: ${employee.employeeId}\n${pdfLink ? "Signed PDF saved to Drive." : `PDF NOT saved: ${pdfWarning}`}`);

    return NextResponse.json({ success: true, data: { pdfSaved: Boolean(pdfLink) } });
  } catch (error: any) {
    if (claimed) await setInviteFields(invite.rowNumber, { Status: invite.status === "Opened" ? "Opened" : "Invited" }).catch(() => {});
    const status = errorStatus(error);
    return NextResponse.json({ success: false, error: status === 500 ? "Could not save your form. Please try again or contact HR." : error.message }, { status });
  }
}
