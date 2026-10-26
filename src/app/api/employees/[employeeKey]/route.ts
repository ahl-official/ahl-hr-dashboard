import { NextRequest, NextResponse } from "next/server";
import { getEmployeeByKey, updateEmployeeRecord } from "@/lib/store";

import { errorStatus } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeKey: string }> }
) {
  try {
    const { employeeKey } = await params;
    const employee = await getEmployeeByKey(employeeKey);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: employee });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: errorStatus(error) }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ employeeKey: string }> }
) {
  try {
    const { employeeKey } = await params;
    const payload = await req.json();
    const updated = await updateEmployeeRecord(employeeKey, payload);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update employee" },
      { status: errorStatus(error) }
    );
  }
}
