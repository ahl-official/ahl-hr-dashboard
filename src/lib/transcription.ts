/**
 * Audio Transcription Service for HireOS & HR Command Center.
 * Ported from hireos-web/backend/HireOSService.gs (transcribeWithAssemblyAI_).
 * Supports:
 *  1. AssemblyAI Universal-3-Pro (Native HireOS engine)
 *  2. OpenAI Whisper / Groq Whisper (if configured)
 *  3. In-browser Web Speech API fallback
 */

export interface TranscriptionResult {
  transcript: string;
  model: string;
  confidence?: number;
  durationSeconds?: number;
}

/**
 * Transcribes an audio Buffer using AssemblyAI REST API.
 * Uses AssemblyAI's flagship 'universal-3-pro' speech model.
 */
export async function transcribeWithAssemblyAI(
  audioBuffer: Buffer,
  apiKey: string
): Promise<TranscriptionResult> {
  // 1. Upload audio bytes
  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(audioBuffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`AssemblyAI upload failed (${uploadRes.status}): ${errText}`);
  }

  const uploadData = await uploadRes.json();
  const audioUrl = uploadData.upload_url;
  if (!audioUrl) {
    throw new Error("AssemblyAI did not return an upload_url");
  }

  // 2. Request transcription with universal-3-pro model
  const transcribeRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speech_models: ["universal-3-pro"],
      language_code: "en",
    }),
  });

  if (!transcribeRes.ok) {
    const errText = await transcribeRes.text();
    throw new Error(`AssemblyAI transcribe request failed (${transcribeRes.status}): ${errText}`);
  }

  const transcribeData = await transcribeRes.json();
  const transcriptId = transcribeData.id;

  // 3. Poll for completion (up to 3 minutes)
  const pollUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  const maxAttempts = 60;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const pollRes = await fetch(pollUrl, {
      method: "GET",
      headers: { Authorization: apiKey },
    });

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();

    if (pollData.status === "completed") {
      return {
        transcript: String(pollData.text || "").trim(),
        model: "AssemblyAI (universal-3-pro)",
        confidence: pollData.confidence || 0.95,
        durationSeconds: pollData.audio_duration,
      };
    }

    if (pollData.status === "error") {
      throw new Error(`AssemblyAI transcription error: ${pollData.error || "Unknown error"}`);
    }
  }

  throw new Error("AssemblyAI transcription timed out after 3 minutes");
}

/**
 * Transcribes audio using OpenAI Whisper (or Groq Whisper) API.
 */
export async function transcribeWithWhisper(
  audioBuffer: Buffer,
  fileName: string,
  apiKey: string,
  isGroq = false
): Promise<TranscriptionResult> {
  const endpoint = isGroq
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";

  const model = isGroq ? "whisper-large-v3" : "whisper-1";

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });
  formData.append("file", blob, fileName || "interview.mp3");
  formData.append("model", model);
  formData.append("language", "en");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper transcription failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    transcript: String(data.text || "").trim(),
    model: isGroq ? "Groq (whisper-large-v3)" : "OpenAI (whisper-1)",
  };
}

/**
 * Main dispatcher: automatically tries available Speech-to-Text services.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string
): Promise<TranscriptionResult> {
  const assemblyKey = process.env.ASSEMBLYAI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // 1. Try AssemblyAI (Native HireOS engine)
  if (assemblyKey && assemblyKey.trim()) {
    try {
      return await transcribeWithAssemblyAI(audioBuffer, assemblyKey.trim());
    } catch (e: any) {
      console.warn("AssemblyAI transcription failed, attempting fallbacks:", e.message);
    }
  }

  // 2. Try Groq Whisper (Ultra-fast & cost-efficient)
  if (groqKey && groqKey.trim()) {
    try {
      return await transcribeWithWhisper(audioBuffer, fileName, groqKey.trim(), true);
    } catch (e: any) {
      console.warn("Groq Whisper transcription failed:", e.message);
    }
  }

  // 3. Try OpenAI Whisper
  if (openAiKey && openAiKey.trim()) {
    try {
      return await transcribeWithWhisper(audioBuffer, fileName, openAiKey.trim(), false);
    } catch (e: any) {
      console.warn("OpenAI Whisper transcription failed:", e.message);
    }
  }

  throw new Error(
    "No Speech-to-Text API key configured. Please set ASSEMBLYAI_API_KEY (from HireOS) or OPENAI_API_KEY in your .env file, or use in-browser Voice Dictation."
  );
}

// ── Background jobs (interview recording analysis) ─────────────────────────
// Starting a job and checking on it are separate requests, so long calls never hit the serverless time limit
// and a recording given as a link is fetched by AssemblyAI directly instead of passing through this server.

export type TranscriptionJob =
  | { status: "processing" }
  | { status: "completed"; transcript: string; model: string; durationSeconds?: number }
  | { status: "error"; error: string };

function assemblyKey(): string {
  const key = (process.env.ASSEMBLYAI_API_KEY || "").trim();
  if (!key) throw new Error("Transcription is not configured: set ASSEMBLYAI_API_KEY.");
  return key;
}

/** Starts transcription of uploaded bytes or of a public audio URL. Returns the AssemblyAI job id. */
export async function startTranscriptionJob(source: { bytes: Uint8Array<ArrayBuffer> } | { audioUrl: string }): Promise<string> {
  const key = assemblyKey();
  let audioUrl: string;
  if ("bytes" in source) {
    const up = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/octet-stream" },
      body: source.bytes,
    });
    if (!up.ok) throw new Error(`Recording upload failed (${up.status}): ${(await up.text()).slice(0, 200)}`);
    audioUrl = (await up.json()).upload_url;
  } else {
    audioUrl = source.audioUrl;
  }

  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl,
      // Calls are often in Hindi, English or both: detect the language, fall back to the multilingual model,
      // and label speakers so the interviewer and the candidate can be told apart.
      speech_models: ["universal-3-pro", "universal-2"],
      language_detection: true,
      speaker_labels: true,
    }),
  });
  if (!res.ok) throw new Error(`Transcription request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return String((await res.json()).id);
}

export async function getTranscriptionJob(id: string): Promise<TranscriptionJob> {
  const key = assemblyKey();
  const res = await fetch(`https://api.assemblyai.com/v2/transcript/${encodeURIComponent(id)}`, { headers: { Authorization: key } });
  if (!res.ok) return { status: "error", error: `Could not check the transcription (${res.status}).` };
  const data = await res.json();
  if (data.status === "error") {
    const reason = String(data.error || "Unknown error");
    return {
      status: "error",
      error: /download|fetch|access|url/i.test(reason)
        ? `The recording could not be downloaded. If it is a Google Drive link, set sharing to "Anyone with the link". (${reason})`
        : `Transcription failed: ${reason}`,
    };
  }
  if (data.status !== "completed") return { status: "processing" };

  const utterances: Array<{ speaker: string; text: string }> = Array.isArray(data.utterances) ? data.utterances : [];
  const transcript = utterances.length
    ? utterances.map((u) => `Speaker ${u.speaker}: ${String(u.text || "").trim()}`).join("\n")
    : String(data.text || "").trim();
  return {
    status: "completed",
    transcript,
    model: `AssemblyAI (${data.speech_model_used || data.speech_model || "universal"}${data.language_code ? `, ${data.language_code}` : ""})`,
    durationSeconds: data.audio_duration,
  };
}
