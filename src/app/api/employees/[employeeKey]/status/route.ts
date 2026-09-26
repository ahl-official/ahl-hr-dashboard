import { NextRequest, NextResponse } from "next/server";
import { updateEmployeeStatusRecord } from "@/lib/store";
import { getEmployeeByKey } from "@/lib/store";
import { uploadHrAttachment } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ employeeKey: string }> }
) {
  try {
    const { employeeKey } = await params;
    const payload = await req.json();
    if (!payload.employmentStatus || !["Active", "Left"].includes(payload.employmentStatus)) {
      return NextResponse.json(
        { success: false, error: "Valid employmentStatus ('Active' or 'Left') is required" },
        { status: 400 }
      );
    }

    if (payload.employmentStatus === "Left" && !payload.lastWorkingDate) {
      return NextResponse.json(
        { success: false, error: "lastWorkingDate is required when status is Left" },
        { status: 400 }
      );
    }

    const employee = await getEmployeeByKey(employeeKey);
    if (!employee) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    const operationId = req.headers.get("Idempotency-Key") || `STS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const uploaded = payload.attachment
      ? await uploadHrAttachment(payload.attachment, employee.fullName, employee.employeeKey, operationId)
      : null;

    const updated = await updateEmployeeStatusRecord({
      employeeKey,
      operationId,
      employmentStatus: payload.employmentStatus,
      lastWorkingDate: payload.lastWorkingDate,
      exitReason: payload.exitReason,
      relievingLetterLink: uploaded?.driveLink || payload.relievingLetterLink,
      updatedBy: payload.updatedBy || "HR User",
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update status" },
      { status: 500 }
    );
  }
}
