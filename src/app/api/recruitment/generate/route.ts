import { NextResponse } from "next/server";
import { createHireOSCandidate } from "@/lib/hireos-sheets";
import { generateTestQuestionsWithAI } from "@/lib/hireos-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      mobile,
      email,
      position,
      experience,
      resumeText,
      timeLimit = 15,
      customQuestions = [],
      mustCheckSkills = "",
      icpContent = "",
    } = body;

    if (!name || !mobile || !position) {
      return NextResponse.json(
        { success: false, message: "Name, mobile, and position are required." },
        { status: 400 }
      );
    }

    const candidateId = `CAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Host URL resolution
    const url = new URL(req.url);
    const origin = url.origin;
    const testUrl = `${origin}/test/${candidateId}`;

    // Filter valid custom questions
    const validCustomQuestions = Array.isArray(customQuestions)
      ? customQuestions.map((q: any) => (typeof q === "string" ? q.trim() : "")).filter(Boolean)
      : [];

    // Generate AI questions
    const questions = await generateTestQuestionsWithAI({
      candidateName: name,
      position,
      resumeText: resumeText || "",
      experience: experience || "",
      mustCheckSkills: mustCheckSkills || "",
      customQuestions: validCustomQuestions,
      icpContent: icpContent || "",
    });

    const parsedTimeLimit = Number(timeLimit) || 15;

    // Save to Google Sheet
    await createHireOSCandidate({
      candidateId,
      name,
      mobile,
      email: email || "",
      position,
      experience: experience || "",
      timeLimit: parsedTimeLimit,
      testUrl,
      questions,
    });

    // Generate WhatsApp text
    const cleanMobile = mobile.replace(/[^0-9]/g, "");
    const formattedMobile = cleanMobile.startsWith("91") && cleanMobile.length === 12 ? cleanMobile : `91${cleanMobile.slice(-10)}`;
    const whatsappMessage = encodeURIComponent(
      `Hello ${name},\n\nThank you for applying for the ${position} role at American Hairline.\n\nPlease complete your preliminary technical assessment using the link below:\n🔗 ${testUrl}\n\nAssessment Details:\n• Format: AI Voice Interview\n• Allocated Time: ${parsedTimeLimit} minutes\n• Instructions: Speak clearly into your microphone; your spoken answers will be transcribed and editable before final submission.\n• Note: Do not switch browser tabs during the assessment.\n\nBest regards,\nAHL HR Team`
    );
    const whatsappLink = `https://wa.me/${formattedMobile}?text=${whatsappMessage}`;

    return NextResponse.json({
      success: true,
      data: {
        candidateId,
        testUrl,
        whatsappLink,
        questions,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/generate:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate assessment" },
      { status: 500 }
    );
  }
}
