import { NextRequest, NextResponse } from "next/server";
import { getCanonicalDepartments } from "@/lib/store";
import { createInvite, listInvites } from "@/lib/invites";
import { COMPANY_CODES } from "@/lib/employee-id";
import { sendWhatsApp } from "@/lib/waha";
import { ValidationError, errorStatus, isIsoDate, isPhone } from "@/lib/validate";
import { LINK_VALID_DAYS, type InviteMode } from "@/lib/invite-rules";

export const dynamic = "force-dynamic";

const baseUrl = (req: NextRequest) => (process.env.APP_BASE_URL || req.nextUrl.origin).replace(/\/+$/, "");

export async function GET() {
  try {
    const invites = await listInvites(12);
    return NextResponse.json({
      success: true,
      data: invites.map((i) => ({ inviteId: i.inviteId, name: i.name, company: i.company, mode: i.mode, status: i.status, createdAt: i.createdAt, expiresAt: i.expiresAt, employeeId: i.employeeId })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to load invitations" }, { status: 500 });
  }
}

/** HR creates an invitation. mode "link" = send it on WhatsApp, "device" = open the form on this company device. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const mode: InviteMode = b.mode === "device" ? "device" : "link";
    const s = (k: string) => String(b[k] ?? "").trim();
    for (const [k, label] of [["name", "Employee name"], ["company", "Company"], ["department", "Department"], ["designation", "Designation"], ["manager", "Reporting manager"], ["doj", "Joining date"]] as const) {
      if (!s(k)) throw new ValidationError(`${label} is required.`);
    }
    if (!isIsoDate(s("doj"))) throw new ValidationError("Joining date must be a valid date.");
    if (!Object.keys(COMPANY_CODES).some((c) => c.toLowerCase() === s("company").toLowerCase())) throw new ValidationError("Unknown company.");
    const departments = await getCanonicalDepartments();
    if (!departments.some((d) => d.departmentName === s("department"))) throw new ValidationError("Please select a valid department.");
    if (mode === "link" && !isPhone(s("mobile"))) throw new ValidationError("A valid 10-digit WhatsApp number is required to send the link.");

    const { inviteId, token, expiresAt } = await createInvite(
      { name: s("name"), mobile: s("mobile"), company: s("company"), department: s("department"), designation: s("designation"), manager: s("manager"), doj: s("doj") },
      mode,
      s("createdBy") || "HR",
    );
    const url = `${baseUrl(req)}/join/${token}`;

    let sent = false, sendError = "";
    if (mode === "link") {
      const first = s("name").split(/\s+/)[0];
      const text = `Hello ${first}, welcome to ${s("company").replace(/\s*\(.*\)/, "")}! 🎉

Please fill in your joining form here (takes about 10 minutes):
${url}

This link is personal to you and valid for ${LINK_VALID_DAYS} days.

- HR Team`;
      const digits = s("mobile").replace(/\D/g, "");
      try {
        await sendWhatsApp(digits.length === 10 ? `91${digits}` : digits, text);
        sent = true;
      } catch (e: any) {
        sendError = e?.message || "WhatsApp send failed";
      }
    }
    return NextResponse.json({ success: true, data: { inviteId, token, url, mode, expiresAt, sent, sendError } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to create invitation" }, { status: errorStatus(error) });
  }
}
