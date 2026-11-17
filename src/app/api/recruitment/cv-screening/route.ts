import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { getFmsCandidateById, updateFmsCandidateStore } from "@/lib/fms-candidates-store";
import { getFmsRequisitionsStore } from "@/lib/fms-requisitions-store";
import { getAllICPs } from "@/lib/hireos-sheets";
import { screenCvWithAI } from "@/lib/hireos-ai";
import { MIN_CV_CHARS, pickIcpForPosition, type CvScreeningReport, type IcpOption } from "@/lib/cv-screening";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel rejects request bodies over 4.5 MB.
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

/**
 * Screens a candidate's CV against the role's ICP and saves the report on the candidate.
 * multipart/form-data: candidateId, icpId ("" = pick automatically), and either file (PDF) or cvText.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const candidateId = String(form.get("candidateId") || "").trim();
    const icpId = String(form.get("icpId") || "").trim();
    const file = form.get("file");
    let cvText = String(form.get("cvText") || "").trim();
    let cvSource: CvScreeningReport["cvSource"] = "text";
    let cvFileName = "";

    const candidate = candidateId ? await getFmsCandidateById(candidateId) : null;
    if (!candidate) return fail("Candidate not found", 404);

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PDF_BYTES) return fail("The PDF is larger than 4 MB. Paste the CV text instead.");
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return fail("Upload the CV as a PDF, or paste its text.");
      try {
        const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
        cvText = String((await extractText(pdf, { mergePages: true })).text || "").trim();
      } catch {
        return fail("Could not read this PDF. Paste the CV text instead.");
      }
      cvSource = "pdf";
      cvFileName = file.name;
    }
    if (cvText.length < MIN_CV_CHARS) {
      return fail(
        cvSource === "pdf"
          ? "Almost no text could be read from this PDF (it may be a scanned image). Paste the CV text instead."
          : "Paste the full CV text, or upload the CV as a PDF."
      );
    }

    const [requisitions, icps] = await Promise.all([
      getFmsRequisitionsStore(),
      getAllICPs().catch(() => [] as IcpOption[]),
    ]);
    // Requisition IDs are not unique in the sheet; the job title settles which one this is.
    const sameId = requisitions.filter((r) => r.id === candidate.requisitionId);
    const requisition =
      sameId.find((r) => r.jobTitle.trim().toLowerCase() === (candidate.position || "").trim().toLowerCase()) || sameId[0];

    const icpList = icps as IcpOption[];
    const icp = icpId
      ? icpList.find((i) => i.icpId === icpId) || null
      : pickIcpForPosition(icpList, candidate.position, requisition?.jobTitle);
    if (icpId && !icp) return fail("The selected ICP no longer exists.");

    const result = await screenCvWithAI(candidate.fullName, cvText, {
      position: candidate.position || requisition?.jobTitle || "",
      requisition,
      icp,
    });

    const report: CvScreeningReport = {
      ...result,
      icpId: icp?.icpId || "",
      icpRole: icp?.roleName || "",
      icpVersion: icp?.version || "",
      icpApproved: icp?.approval === "Approved",
      cvSource,
      cvFileName,
      screenedAt: new Date().toISOString(),
    };

    const updated = await updateFmsCandidateStore(candidate.id, {
      stageData: {
        ...candidate.stageData,
        ar: { ...(candidate.stageData?.ar || {}), cvScreening: report },
      },
    });
    return NextResponse.json({ success: true, data: { report, candidate: updated } });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/cv-screening:", error);
    return fail(error?.message || "CV screening failed", 500);
  }
}
