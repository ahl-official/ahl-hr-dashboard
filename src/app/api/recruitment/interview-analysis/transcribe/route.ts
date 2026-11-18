import { NextResponse } from "next/server";
import { getTranscriptionJob, startTranscriptionJob } from "@/lib/transcription";
import { recordingDownloadUrl } from "@/lib/interview-analysis";

export const dynamic = "force-dynamic";

// Vercel rejects request bodies over 4.5 MB; bigger recordings are given as a link instead.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

/** Starts transcribing a recording: multipart with `file` (≤ 4 MB) or `recordingUrl` (e.g. a Google Drive link). */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    if (String(form.get("consent") || "") !== "true") {
      return fail("Confirm that the candidate agreed to the call being recorded.");
    }
    const file = form.get("file");
    const link = String(form.get("recordingUrl") || "").trim();

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) return fail("The recording is larger than 4 MB. Upload it to Google Drive and paste the link instead.");
      if (!/^(audio|video)\//.test(file.type) && !/\.(mp3|m4a|aac|amr|wav|ogg|opus|webm|mp4|3gp|flac)$/i.test(file.name)) {
        return fail("This does not look like an audio recording.");
      }
      const jobId = await startTranscriptionJob({ bytes: new Uint8Array(await file.arrayBuffer()) });
      return NextResponse.json({ success: true, data: { jobId } });
    }

    if (link) {
      const url = recordingDownloadUrl(link);
      if (!url) return fail("Paste a link to the recording file itself (a Google Drive file link, not a folder).");
      const jobId = await startTranscriptionJob({ audioUrl: url });
      return NextResponse.json({ success: true, data: { jobId } });
    }

    return fail("Upload the recording or paste a link to it.");
  } catch (error: any) {
    console.error("Error in POST /api/recruitment/interview-analysis/transcribe:", error);
    return fail(error?.message || "Could not start transcription", 500);
  }
}

/** Status of a transcription job; includes the transcript once it is done. */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!/^[\w-]{6,}$/.test(id)) return fail("Missing transcription id.");
    return NextResponse.json({ success: true, data: await getTranscriptionJob(id) });
  } catch (error: any) {
    return fail(error?.message || "Could not check transcription", 500);
  }
}
