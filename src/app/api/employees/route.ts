import { NextRequest, NextResponse } from "next/server";
import { getAllEmployees, addEmployeeRecord } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const company = searchParams.get("company") || "";
    const department = searchParams.get("department") || "";
    const gender = searchParams.get("gender") || "";
    const employmentStatus = searchParams.get("employmentStatus") || "Active";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10));

    let employees = await getAllEmployees();

    if (search) {
      employees = employees.filter((emp) => {
        const text = [
          emp.fullName,
          emp.employeeId,
          emp.designation,
          emp.department,
          emp.company,
          emp.manager,
          emp.mobile,
          emp.companyEmail,
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(search);
      });
    }

    if (company) {
      employees = employees.filter((e) => e.company === company);
    }
    if (department) {
      employees = employees.filter((e) => e.department === department);
    }
    if (gender) {
      employees = employees.filter((e) => e.gender === gender);
    }
    if (employmentStatus && employmentStatus !== "All") {
      employees = employees.filter((e) => e.employmentStatus === employmentStatus);
    }

    const total = employees.length;
    const start = (page - 1) * pageSize;
    const items = employees.slice(start, start + pageSize);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get("Idempotency-Key");
    const payload = await req.json();

    if (!payload.fullName || !payload.employeeId || !payload.company || !payload.department) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (fullName, employeeId, company, department)" },
        { status: 400 }
      );
    }

    const newEmp = await addEmployeeRecord(payload);

    return NextResponse.json({
      success: true,
      data: newEmp,
      idempotencyKey,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create employee" },
      { status: 500 }
    );
  }
}
