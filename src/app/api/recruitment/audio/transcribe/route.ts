import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/transcription";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let audioBuffer: Buffer;
    let fileName = "interview_audio.mp3";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ success: false, message: "No audio file provided" }, { status: 400 });
      }
      fileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    } else {
      const body = await req.json();
      const { audioBase64, audioFileName } = body;
      if (!audioBase64) {
        return NextResponse.json({ success: false, message: "audioBase64 is required" }, { status: 400 });
      }
      if (audioFileName) fileName = audioFileName;
      audioBuffer = Buffer.from(audioBase64, "base64");
    }

    if (audioBuffer.length === 0) {
      return NextResponse.json({ success: false, message: "Audio file is empty" }, { status: 400 });
    }

    const result = await transcribeAudio(audioBuffer, fileName);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Transcription error in /api/recruitment/audio/transcribe:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to transcribe audio",
      },
      { status: 500 }
    );
  }
}
