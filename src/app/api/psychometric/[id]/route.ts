import { NextResponse } from "next/server";
import { DISC_QUESTIONS_DATA } from "@/lib/disc-questions";
import { getHireOSCandidates, getPsychometricResult, submitDiscAssessment } from "@/lib/hireos-sheets";
import { getAllEmployees } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entity") === "Employee" ? "Employee" : "Candidate";

    let personName = "";
    let role = "";
    let company = "";

    if (entityType === "Employee") {
      const employees = await getAllEmployees();
      const emp = employees.find((e) => e.employeeId === id || e.employeeKey === id);
      if (!emp) {
        return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
      }
      personName = emp.fullName;
      role = emp.designation || "Staff";
      company = emp.company || "";
    } else {
      const candidates = await getHireOSCandidates();
      const c = candidates.find((x) => x.id === id || x.candidateId === id);
      if (!c) {
        return NextResponse.json({ success: false, message: "Candidate not found" }, { status: 404 });
      }
      personName = c.name;
      role = c.position || "Applicant";
    }

    // Check existing DISC status
    const psych = await getPsychometricResult(id, entityType);
    if (psych && psych.status === "Completed") {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        data: {
          id,
          name: personName,
          role,
          entityType,
          completedAt: psych.testCompletedAt,
          discProfile: psych.discProfile,
          discD: psych.discD,
          discI: psych.discI,
          discS: psych.discS,
          discC: psych.discC,
          discSummary: psych.discSummary,
        },
      });
    }

    // Prepare questions with randomized option orders per question
    const questions = DISC_QUESTIONS_DATA.map((q, idx) => {
      const opts: { dim: "D" | "I" | "S" | "C"; text: string }[] = [
        { dim: "D", text: q.D },
        { dim: "I", text: q.I },
        { dim: "S", text: q.S },
        { dim: "C", text: q.C },
      ];

      // Pseudo-random shuffle based on question index + id
      const seed = (idx * 7 + 13) % 4;
      const rotated = [...opts.slice(seed), ...opts.slice(0, seed)];
      const labels: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];

      return {
        questionNo: idx + 1,
        question: q.question,
        options: rotated.map((opt, oIdx) => ({
          label: labels[oIdx],
          dim: opt.dim,
          text: opt.text,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      alreadyCompleted: false,
      data: {
        id,
        name: personName,
        role,
        company,
        entityType,
        totalQuestions: questions.length,
        questions,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/psychometric/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load assessment" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { answers, entityType = "Candidate" } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { success: false, message: "Answers payload is required" },
        { status: 400 }
      );
    }

    const result = await submitDiscAssessment({
      id,
      entityType: entityType === "Employee" ? "Employee" : "Candidate",
      answers,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in POST /api/psychometric/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit assessment" },
      { status: 500 }
    );
  }
}
