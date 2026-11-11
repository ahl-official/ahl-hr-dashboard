import { NextRequest, NextResponse } from "next/server";
import { addCanonicalDepartment, getCanonicalDepartments } from "@/lib/store";
import { addCustomDropdownOption, getAllCustomDropdownOptions } from "@/lib/custom-dropdowns";
import { normalizeDropdownCategory } from "@/lib/custom-dropdown-rules";
import { errorStatus } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const category = normalizeDropdownCategory(req.nextUrl.searchParams.get("category") || "");
    const [customMap, departments] = await Promise.all([
      getAllCustomDropdownOptions(),
      getCanonicalDepartments().catch(() => []),
    ]);

    const merged: Record<string, string[]> = {
      ...customMap,
      department: departments.map((d) => d.departmentName),
    };

    if (category) {
      return NextResponse.json({ success: true, data: merged[category] || [] });
    }
    return NextResponse.json({ success: true, data: merged });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load dropdown options" },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const category = normalizeDropdownCategory(body?.category);
    const rawValue = String(body?.value ?? "");

    if (!category) {
      return NextResponse.json({ success: false, error: "Category is required." }, { status: 400 });
    }

    if (category === "department") {
      const dept = await addCanonicalDepartment(rawValue);
      const departments = await getCanonicalDepartments();
      return NextResponse.json({
        success: true,
        data: {
          category: "department",
          value: dept.departmentName,
          options: departments.map((d) => d.departmentName),
        },
      });
    }

    const result = await addCustomDropdownOption(category, rawValue);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save custom option" },
      { status: errorStatus(error) }
    );
  }
}
