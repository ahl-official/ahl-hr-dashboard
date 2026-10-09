import { NextResponse } from "next/server";
import { getAllAudioReviews, saveAudioReview } from "@/lib/hireos-sheets";
import { generateAudioReviewWithAI } from "@/lib/hireos-ai";

export async function GET() {
  try {
    const reviews = await getAllAudioReviews();
    return NextResponse.json({
      success: true,
      data: reviews,
      reviews,
    });
  } catch (error: any) {
    console.error("Error in GET /api/recruitment/audio:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load audio reviews" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, role, hrNotes, audioFileName, transcript } = body;

    if (!name || !role) {
      return NextResponse.json({ success: false, message: "Name and role are required" }, { status: 400 });
    }

    const reviewId = `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Generate AI evaluation
    const report = await generateAudioReviewWithAI({
      candidateName: name,
      role,
      hrNotes: hrNotes || "",
      transcript: transcript || "",
    });

    const saved = await saveAudioReview({
      id: reviewId,
      name,
      role,
      hrNotes: hrNotes || "",
      audioFileName: audioFileName || "interview_audio.mp3",
      transcript: transcript || "Audio response evaluated via AI.",
      report,
      recommendation: report.recommendation,
      finalVerdict: report.finalVerdict,
    });

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/audio:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process audio review" },
      { status: 500 }
    );
  }
}
