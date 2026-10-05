import { NextRequest, NextResponse } from "next/server";
import { getAllDocuments, addDocumentRecord, getEmployeeByKey } from "@/lib/store";
import { uploadHrAttachment } from "@/lib/google-drive";

import { errorStatus } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Drive + WhatsApp can take 10-40 s; Vercel allows 10 s by default

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeKey = searchParams.get("employeeKey");
    const type = searchParams.get("type");

    let docs = await getAllDocuments();
    if (employeeKey) {
      docs = docs.filter((d) => d.employeeKey === employeeKey);
    }
    if (type) {
      docs = docs.filter((d) => d.documentType === type);
    }

    return NextResponse.json({ success: true, data: docs });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch documents" },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get("Idempotency-Key");
    const payload = await req.json();

    if (!payload.employeeKey || !payload.documentType || !payload.uploadedBy) {
      return NextResponse.json(
        { success: false, error: "employeeKey, documentType, and uploadedBy are required" },
        { status: 400 }
      );
    }

    const employee = await getEmployeeByKey(payload.employeeKey);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Selected employee not found" },
        { status: 404 }
      );
    }

    const documentId =
      payload.documentId ||
      `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const uploaded = payload.attachment
      ? await uploadHrAttachment(payload.attachment, employee.fullName, employee.employeeKey, documentId)
      : null;

    const newDoc = await addDocumentRecord({
      documentId,
      employeeKey: employee.employeeKey,
      employeeId: employee.employeeId,
      employeeName: employee.fullName,
      documentType: payload.documentType,
      documentStatus: payload.documentStatus || "Pending",
      fileName: uploaded?.fileName || payload.fileName || "",
      driveFileId: uploaded?.driveFileId || payload.driveFileId || "",
      driveLink: uploaded?.driveLink || payload.driveLink || "",
      notes: payload.notes || "",
      uploadedBy: payload.uploadedBy,
    });

    return NextResponse.json({
      success: true,
      data: newDoc,
      idempotencyKey,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save document" },
      { status: errorStatus(error) }
    );
  }
}
