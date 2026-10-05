import { NextRequest, NextResponse } from "next/server";
import { getEmployeeByKey } from "@/lib/store";

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
