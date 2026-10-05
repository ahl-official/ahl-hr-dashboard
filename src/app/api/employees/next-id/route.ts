import { NextRequest, NextResponse } from "next/server";
import { getAllEmployees } from "@/lib/store";
import { formatEmployeeId, nextEmployeeNumber } from "@/lib/employee-id";

export const dynamic = "force-dynamic";

/**
 * Preview of the ID the next employee of this company/department would get.
 * It does NOT reserve anything; the real ID is allocated when HR approves the record.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";
  const department = searchParams.get("department") || "";
  if (!company || !department) {
    return NextResponse.json({ success: false, error: "company and department are required" }, { status: 400 });
  }
  try {
    const next = nextEmployeeNumber(await getAllEmployees(), company);
    return NextResponse.json({ success: true, data: { employeeId: formatEmployeeId(company, department, next), number: next, reserved: false } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to compute next ID" }, { status: 500 });
  }
}
