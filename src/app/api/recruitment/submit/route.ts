import { NextResponse } from "next/server";
import { getCandidateTestById, submitCandidateTest, getHireOSCandidates } from "@/lib/hireos-sheets";
import { gradeTestWithAI } from "@/lib/hireos-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { candidateId, answers, tabSwitches = 0 } = body;

    if (!candidateId || !Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, message: "Candidate ID and answers are required." },
        { status: 400 }
      );
    }

    const test = await getCandidateTestById(candidateId);
    if (!test) {
      return NextResponse.json(
        { success: false, message: "Assessment not found." },
        { status: 404 }
      );
    }

    if (test.status === "Completed") {
      return NextResponse.json(
        { success: false, message: "This assessment has already been submitted." },
        { status: 400 }
      );
    }

    // Candidate questions
    const questionItems = (test.questions || []).map((q: any) => {
      const submitted = answers.find((a: any) => a.id === q.id);
      return {
        id: q.id,
        question: q.question,
        candidateAnswer: submitted?.answer || "",
      };
    });

    // Run AI grading
    const evaluation = await gradeTestWithAI({
      candidateName: test.name,
      position: test.position,
      questions: questionItems,
    });

    // Save to Google Sheet
    await submitCandidateTest({
      candidateId,
      answers,
      tabSwitches: Number(tabSwitches) || 0,
      overallScore: evaluation.overallScore,
      aiSummary: evaluation.aiSummary,
      perQuestionResults: evaluation.perQuestionResults,
    });

    return NextResponse.json({
      success: true,
      data: {
        score: evaluation.overallScore,
        aiSummary: evaluation.aiSummary,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/submit:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit assessment" },
      { status: 500 }
    );
  }
}
