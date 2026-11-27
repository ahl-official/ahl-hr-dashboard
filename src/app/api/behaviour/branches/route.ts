import { NextResponse } from "next/server";
import { getBranchesStore, evaluateAndSaveBranch } from "@/lib/behaviour-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || undefined;
    const color = searchParams.get("color") || undefined;
    const status = searchParams.get("status") || undefined;
    const employeeKey = searchParams.get("employeeKey") || undefined;
    const employeeName = searchParams.get("name") || searchParams.get("employeeName") || undefined;
    const phone = searchParams.get("phone") || undefined;

    const branches = getBranchesStore({ month, color, status, employeeKey, employeeName, phone });
    return NextResponse.json({ success: true, branches });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load branches" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.employeeName || !body.month) {
      return NextResponse.json(
        { success: false, error: "employeeName and month are required." },
        { status: 400 }
      );
    }

    const branch = evaluateAndSaveBranch(body);
    return NextResponse.json({ success: true, branch });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to evaluate branch" },
      { status: 500 }
    );
  }
}
