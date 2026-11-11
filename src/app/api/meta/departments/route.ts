import { NextRequest, NextResponse } from "next/server";
import { addCanonicalDepartment, getCanonicalDepartments } from "@/lib/store";
import { errorStatus } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getCanonicalDepartments() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to load departments" }, { status: errorStatus(error) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dept = await addCanonicalDepartment(String(body?.departmentName ?? body?.name ?? body?.value ?? ""));
    return NextResponse.json({ success: true, data: dept });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to add department" }, { status: errorStatus(error) });
  }
}
