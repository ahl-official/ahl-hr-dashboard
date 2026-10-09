"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { COMPANY_LOGOS } from "@/lib/brand";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Clock,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Edit3,
  Send,
  Sparkles,
  Play,
  Square,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  FileText,
  Check,
  Loader2,
  Award,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface TestQuestion {
  id: number;
  category: string;
  question: string;
  candidateAnswer?: string;
}

interface TestData {
  candidateId: string;
  name: string;
  position: string;
  status: "Pending" | "Completed";
  score: number | null;
  timeLimit: number;
  tabSwitches: number;
  questions: TestQuestion[];
}

export default function CandidateTestPage() {
  const { id } = useParams<{ id: string }>();

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testData, setTestData] = useState<TestData | null>(null);

  // Flow step: "welcome" | "interview" | "submitting" | "completed"
  const [flowStep, setFlowStep] = useState<"welcome" | "interview" | "submitting" | "completed">("welcome");

  // Mic & Audio System Check states
  const [micTested, setMicTested] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micTestVolume, setMicTestVolume] = useState(0);
  const [isAiVoiceTesting, setIsAiVoiceTesting] = useState(false);

  // Active Exam states
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(15 * 60);

  // Question interaction states: "speaking_prompt" | "ready_to_record" | "recording" | "transcribing" | "review_transcript"
  const [interactionState, setInteractionState] = useState<
    "speaking_prompt" | "ready_to_record" | "recording" | "transcribing" | "review_transcript"
  >("ready_to_record");

  // Voice recording & transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [currentEditableAnswer, setCurrentEditableAnswer] = useState("");
  const [isAiSpeakingQuestion, setIsAiSpeakingQuestion] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  // Submission results
  const [submissionResult, setSubmissionResult] = useState<{ score: number; aiSummary: string } | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeAnimRef = useRef<number | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // ─────────────────────────────────────────────────────────────
  // 1. INITIAL FETCH
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/recruitment/test/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          const data: TestData = json.data;
          setTestData(data);
          const limitSeconds = (Number(data.timeLimit) || 15) * 60;
          setTimeRemaining(limitSeconds);

          // Populate existing answers if any
          const initialAns: Record<number, string> = {};
          (data.questions || []).forEach((q) => {
            if (q.candidateAnswer) {
              initialAns[q.id] = q.candidateAnswer;
            }
          });
          setAnswers(initialAns);

          if (data.status === "Completed") {
            setSubmissionResult({
              score: data.score || 0,
              aiSummary: "Your assessment has already been submitted and evaluated.",
            });
            setFlowStep("completed");
          }
        } else {
          setError(json.message || "Assessment link not found or invalid.");
        }
      })
      .catch(() => setError("Unable to load assessment. Please check your internet connection."))
      .finally(() => setLoading(false));
  }, [id]);

  // Check speech synthesis support
  useEffect(() => {
    if (typeof window !== "undefined" && !("speechSynthesis" in window)) {
      setVoiceSupported(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 2. AUDIT LOGGING
  // ─────────────────────────────────────────────────────────────
  const logAudit = useCallback(
    (eventType: string, details: string) => {
      if (!id) return;
      fetch("/api/recruitment/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: id, eventType, details }),
      }).catch(() => {});
    },
    [id]
  );

  // ─────────────────────────────────────────────────────────────
  // 3. PROCTORING: TAB SWITCH & BLUR DETECTION
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (flowStep !== "interview") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches((prev) => {
          const next = prev + 1;
          logAudit("TAB_SWITCH", `Tab switch #${next} detected during interview`);
          return next;
        });
        setShowTabWarning(true);
      }
    };

    const handleBlur = () => {
      setTabSwitches((prev) => {
        const next = prev + 1;
        logAudit("WINDOW_BLUR", `Window blur #${next} detected during interview`);
        return next;
      });
      setShowTabWarning(true);
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleCopyPaste = (e: ClipboardEvent) => e.preventDefault();

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopyPaste);
    window.addEventListener("paste", handleCopyPaste);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopyPaste);
      window.removeEventListener("paste", handleCopyPaste);
    };
  }, [flowStep, logAudit]);

  // ─────────────────────────────────────────────────────────────
  // 4. SESSION COUNTDOWN TIMER
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (flowStep !== "interview") return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [flowStep]);

  const handleAutoSubmitTimeUp = () => {
    alert("Time limit reached! Submitting your assessment now.");
    performFinalSubmit();
  };

  // ─────────────────────────────────────────────────────────────
  // 5. AI VOICE (TTS) QUESTION PROMPTING
  // ─────────────────────────────────────────────────────────────
  const speakText = useCallback(
    (text: string, onEnd?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        onEnd?.();
        return;
      }

      window.speechSynthesis.cancel();
      setIsAiSpeakingQuestion(true);

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();

      // Preferred natural voices
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.toLowerCase().includes("natural") ||
            v.name.toLowerCase().includes("samantha") ||
            v.name.toLowerCase().includes("aria") ||
            v.name.toLowerCase().includes("jenny") ||
            v.name.toLowerCase().includes("google"))
      );
      if (preferred) utterance.voice = preferred;

      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        setIsAiSpeakingQuestion(false);
        onEnd?.();
      };
      utterance.onerror = () => {
        setIsAiSpeakingQuestion(false);
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsAiSpeakingQuestion(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 6. SYSTEM CHECK: MIC TEST & AI VOICE TEST
  // ─────────────────────────────────────────────────────────────
  const handleTestMic = async () => {
    setMicTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let count = 0;
      const checkInterval = setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        const vol = Math.min(100, Math.round((avg / 128) * 100));
        setMicTestVolume(vol);
        count++;
        if (count > 25) {
          clearInterval(checkInterval);
          stream.getTracks().forEach((t) => t.stop());
          ctx.close().catch(() => {});
          setMicTesting(false);
          setMicTested(true);
        }
      }, 100);
    } catch (e) {
      alert("Microphone permission was denied. Please allow microphone access in your browser settings to continue.");
      setMicTesting(false);
    }
  };

  const handleTestAiVoice = () => {
    setIsAiVoiceTesting(true);
    speakText(
      "Hello! I am your AI interviewer from American Hairline. I will speak each question clearly, and you will respond using your microphone.",
      () => setIsAiVoiceTesting(false)
    );
  };

  // ─────────────────────────────────────────────────────────────
  // 7. AUDIO RECORDING & LIVE SPEECH-TO-TEXT
  // ─────────────────────────────────────────────────────────────
  const startVolumeAnalysis = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setVolumeLevel(Math.min(100, (avg / 128) * 100));
        volumeAnimRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (e) {
      console.warn("AudioContext error:", e);
    }
  };

  const handleStartSpeaking = async () => {
    stopSpeaking();
    setLiveTranscript("");
    setCurrentEditableAnswer("");
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      startVolumeAnalysis(stream);

      // Start MediaRecorder
      const supportedType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const mr = new MediaRecorder(stream, { mimeType: supportedType });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = mr;
      mr.start();

      // Start Web Speech API Recognition for instantaneous live words
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        let accumulatedTranscript = "";

        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              accumulatedTranscript += " " + event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const fullText = (accumulatedTranscript + " " + interim).trim();
          setLiveTranscript(fullText);
          setCurrentEditableAnswer(fullText);
        };

        recognition.onerror = (e: any) => {
          console.warn("SpeechRecognition error:", e);
        };

        try {
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {}
      }

      setIsRecording(true);
      setInteractionState("recording");

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone access is required to speak your answer. Please grant permission and try again.");
    }
  };

  const handleStopSpeaking = async () => {
    setIsRecording(false);
    setInteractionState("transcribing");

    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (volumeAnimRef.current) cancelAnimationFrame(volumeAnimRef.current);

    // Stop Speech Recognition
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    // Release audio tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }

    // Server-side transcription fallback if browser speech didn't catch text
    setTimeout(async () => {
      let finalSpeechText = currentEditableAnswer.trim() || liveTranscript.trim();

      // If browser SpeechRecognition was empty but we have recorded audio chunks, try backend Whisper
      if (!finalSpeechText && audioChunksRef.current.length > 0) {
        try {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", blob, `ans_q${currentIdx + 1}.webm`);
          const res = await fetch("/api/recruitment/audio/transcribe", {
            method: "POST",
            body: formData,
          });
          const json = await res.json();
          if (json.success && json.data?.text) {
            finalSpeechText = json.data.text.trim();
          }
        } catch (e) {
          console.warn("Backend audio transcribe fallback error:", e);
        }
      }

      setCurrentEditableAnswer(finalSpeechText);
      setInteractionState("review_transcript");
    }, 800);
  };

  const handleReRecord = () => {
    setCurrentEditableAnswer("");
    setLiveTranscript("");
    setInteractionState("ready_to_record");
  };

  // ─────────────────────────────────────────────────────────────
  // 8. TRANSCRIPTION EDIT & CONFIRMATION
  // ─────────────────────────────────────────────────────────────
  const currentQ = testData?.questions[currentIdx];

  const handleConfirmAndNext = () => {
    if (!currentQ) return;
    const cleaned = currentEditableAnswer.trim();
    if (!cleaned) {
      const confirmEmpty = window.confirm(
        "You haven't recorded or entered an answer for this question. Do you want to continue without answering?"
      );
      if (!confirmEmpty) return;
    }

    // Save answer
    setAnswers((prev) => ({ ...prev, [currentQ.id]: cleaned }));

    // Advance to next question or complete
    if (testData && currentIdx < testData.questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      const nextQ = testData.questions[nextIdx];
      const existing = answers[nextQ.id] || "";
      setCurrentEditableAnswer(existing);
      setLiveTranscript("");
      setInteractionState(existing ? "review_transcript" : "ready_to_record");

      // Auto speak next question prompt
      setTimeout(() => {
        speakText(nextQ.question);
      }, 400);
    } else {
      // Last question reached
      handlePromptFinalSubmission();
    }
  };

  const handlePromptFinalSubmission = () => {
    const totalQ = testData?.questions.length || 0;
    const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length + (currentEditableAnswer.trim() ? 1 : 0);
    const confirmSub = window.confirm(
      `You have completed ${answeredCount} of ${totalQ} questions. Are you ready to submit your assessment for AI evaluation?`
    );
    if (confirmSub) {
      performFinalSubmit();
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 9. FINAL SUBMIT TO SERVER & AI EVALUATION
  // ─────────────────────────────────────────────────────────────
  const performFinalSubmit = async () => {
    if (!testData || !id) return;
    stopSpeaking();
    setFlowStep("submitting");

    // Include the current question's edited answer
    const finalAnswersObj = { ...answers };
    if (currentQ && currentEditableAnswer.trim()) {
      finalAnswersObj[currentQ.id] = currentEditableAnswer.trim();
    }

    const answersPayload = (testData.questions || []).map((q) => ({
      id: q.id,
      answer: finalAnswersObj[q.id] || "",
    }));

    try {
      const res = await fetch("/api/recruitment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: id,
          answers: answersPayload,
          tabSwitches,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSubmissionResult({
          score: json.data.score || 0,
          aiSummary: json.data.aiSummary || "AI interview completed and evaluated successfully.",
        });
        setFlowStep("completed");
      } else {
        alert(json.message || "Failed to submit assessment.");
        setFlowStep("interview");
      }
    } catch (err: any) {
      alert("Error submitting test. Please check your connection and retry.");
      setFlowStep("interview");
    }
  };

  // Time format helper
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER: LOADING / ERROR
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d131f] flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-10 h-10 text-[#136573] animate-spin mb-4" />
        <h2 className="text-base font-semibold tracking-wide">Loading AI Assessment...</h2>
        <p className="text-xs text-slate-400 mt-1">Configuring audio pipelines and candidate interview profile</p>
      </div>
    );
  }

  if (error || !testData) {
    return (
      <div className="min-h-screen bg-[#0d131f] flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-[#161f30] border border-red-500/30 rounded-2xl p-6 text-center shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Assessment Unavailable</h2>
          <p className="text-xs text-slate-300 mb-6">{error || "Interview link not found."}</p>
          <p className="text-[11px] text-slate-500">
            Please contact the American Hairline HR Recruitment Team if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  const ahlLogo = COMPANY_LOGOS["american hairline (ahl)"];

  // ─────────────────────────────────────────────────────────────
  // RENDER: WELCOME & SYSTEM CHECK
  // ─────────────────────────────────────────────────────────────
  if (flowStep === "welcome") {
    return (
      <div className="min-h-screen bg-[#0a0f18] text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        {/* Top Header */}
        <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#136573] to-[#0d454f] flex items-center justify-center font-bold text-white shadow-md overflow-hidden">
              {ahlLogo ? (
                <img
                  src={ahlLogo.src}
                  alt={ahlLogo.alt}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                "AHL"
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#2298ab]">American Hairline</span>
              <h1 className="text-sm font-bold text-white">AI interview</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-[#2298ab]" />
            <span>Duration: <strong>{testData.timeLimit || 15} Mins</strong></span>
          </div>
        </header>

        {/* Main Content Card */}
        <main className="max-w-4xl mx-auto w-full my-8 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Candidate Info & Format */}
          <div className="md:col-span-7 bg-[#111827] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#136573]/20 border border-[#136573]/40 text-[#2298ab] text-[11px] font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Preliminary Screening</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Welcome, {testData.name}!
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                You are about to begin your technical assessment for the{" "}
                <span className="text-white font-semibold">{testData.position}</span> position at American Hairline.
              </p>
            </div>

            {/* Assessment Format Details */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Interview Workflow:</h3>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#136573]/30 text-[#2298ab] flex items-center justify-center shrink-0 text-xs font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Question Presentation</h4>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      The AI interviewer presents and reads each question aloud. You can replay the voice at any time.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#136573]/30 text-[#2298ab] flex items-center justify-center shrink-0 text-xs font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Speak Your Response</h4>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Speak clearly into your microphone. Our speech engine captures and transcribes your words in real time.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" />
                      Editable Transcription
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-normal">
                      After speaking, your transcribed answer appears on screen. <strong>You can edit, fix typos, or add details</strong> before confirming and moving to the next question.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Proctoring Banner */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                <strong>Anti-Cheating Monitoring Active:</strong> Do not switch tabs or minimize the browser window. All browser focus shifts are audited.
              </span>
            </div>
          </div>

          {/* Right Column: Pre-Interview System Check */}
          <div className="md:col-span-5 bg-[#111827] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Hardware & Audio Check</h3>
              <p className="text-xs text-slate-400">Verify your microphone and speakers prior to starting.</p>

              {/* Mic Test Card */}
              <div className="mt-5 p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-[#2298ab]" />
                    Microphone Input
                  </span>
                  {micTested && (
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Ready
                    </span>
                  )}
                </div>

                {micTesting ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Speak into mic to test volume...</span>
                      <span className="font-mono text-emerald-400">{micTestVolume}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-100"
                        style={{ width: `${micTestVolume}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleTestMic}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 text-[#2298ab]" />
                    {micTested ? "Re-Test Microphone" : "Test Microphone Permission"}
                  </button>
                )}
              </div>

              {/* AI Voice Speaker Test Card */}
              <div className="mt-3 p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-[#2298ab]" />
                    Interviewer Voice (Audio Output)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleTestAiVoice}
                  disabled={isAiVoiceTesting}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Play className="w-3.5 h-3.5 text-[#2298ab]" />
                  {isAiVoiceTesting ? "Playing AI Voice..." : "Test AI Audio Voice"}
                </button>
              </div>

              {/* Summary Stats */}
              <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Questions</span>
                  <span className="text-base font-bold text-white">{testData.questions.length}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Time Limit</span>
                  <span className="text-base font-bold text-white">{testData.timeLimit || 15} Mins</span>
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <button
              type="button"
              onClick={() => {
                setFlowStep("interview");
                if (testData?.questions?.[0]) {
                  setTimeout(() => {
                    speakText(testData.questions[0].question);
                  }, 600);
                }
              }}
              className="w-full py-3.5 bg-gradient-to-r from-[#136573] to-[#1c8193] hover:from-[#177888] hover:to-[#2298ab] text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#136573]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Begin AI Interview Now
            </button>
          </div>
        </main>

        <footer className="max-w-4xl mx-auto w-full text-center text-[11px] text-slate-500 pt-4 border-t border-white/5">
          American Hairline HR Department • Confidential Candidate Technical Screening
        </footer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: SUBMITTING / AI AUTO-GRADING
  // ─────────────────────────────────────────────────────────────
  if (flowStep === "submitting") {
    return (
      <div className="min-h-screen bg-[#0a0f18] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#136573]/20 border border-[#136573]/40 flex items-center justify-center mb-6 animate-pulse">
          <Loader2 className="w-10 h-10 text-[#2298ab] animate-spin" />
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2">Analyzing Responses...</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Evaluating technical depth, clarity, problem-solving, and role maturity against American Hairline criteria.
        </p>
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#136573] to-[#2298ab] animate-pulse w-3/4 rounded-full" />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: COMPLETED SCREEN
  // ─────────────────────────────────────────────────────────────
  if (flowStep === "completed") {
    return (
      <div className="min-h-screen bg-[#0a0f18] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-lg w-full bg-[#111827] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block mb-1">
              Assessment Completed
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">Thank you, {testData.name}!</h2>
            <p className="text-xs text-slate-400 mt-1">
              Your responses for the <strong className="text-white">{testData.position}</strong> position have been recorded and evaluated.
            </p>
          </div>

          {/* Score Badge */}
          {submissionResult?.score !== undefined && submissionResult.score !== null && (
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Preliminary Evaluation Score
              </span>
              <div className="text-3xl font-black text-[#2298ab]">
                {submissionResult.score} <span className="text-sm font-semibold text-slate-500">/ 100</span>
              </div>
            </div>
          )}

          {/* AI Summary */}
          {submissionResult?.aiSummary && (
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                Executive Evaluation Summary:
              </span>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{submissionResult.aiSummary}"
              </p>
            </div>
          )}

          <div className="text-[11px] text-slate-500 leading-normal">
            The American Hairline recruitment team will review your complete audio recording, editable transcripts, and evaluation score. We will contact you via WhatsApp or Email regarding next steps.
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: ACTIVE INTERVIEW SESSION
  // ─────────────────────────────────────────────────────────────
  const isTimeCritical = timeRemaining < 180; // under 3 minutes

  return (
    <div className="min-h-screen bg-[#0a0f18] text-slate-100 flex flex-col justify-between">
      {/* ── TOP APP BAR ────────────────────────────────────── */}
      <header className="px-4 sm:px-8 py-3.5 bg-[#111827]/90 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Brand & Candidate */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#136573] to-[#0d454f] flex items-center justify-center font-bold text-white text-xs shadow-sm overflow-hidden">
              {ahlLogo ? (
                <img
                  src={ahlLogo.src}
                  alt={ahlLogo.alt}
                  className="w-full h-full object-contain p-0.5"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                "AHL"
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{testData.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-medium">
                  {testData.position}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Question {currentIdx + 1} of {testData.questions.length}</span>
            </div>
          </div>

          {/* Timer & Anti-Cheat Badge */}
          <div className="flex items-center gap-3">
            {tabSwitches > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Switches: {tabSwitches}</span>
              </div>
            )}

            {/* Countdown Clock */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-xs transition-all ${
                isTimeCritical
                  ? "bg-red-500/15 border-red-500/40 text-red-400 animate-pulse"
                  : "bg-white/5 border-white/10 text-slate-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-[#2298ab]" />
              <span>{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/5 h-1 mt-3">
          <div
            className="bg-gradient-to-r from-[#136573] to-[#2298ab] h-full transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / testData.questions.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Tab Switch Warning Banner */}
      {showTabWarning && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-2 text-center text-xs text-red-300 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>
            <strong>Proctoring Alert:</strong> Tab switch or window blur detected ({tabSwitches} total). Please remain on this screen.
          </span>
          <button
            onClick={() => setShowTabWarning(false)}
            className="ml-3 text-[10px] uppercase font-bold text-red-200 hover:text-white underline"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* ── MAIN INTERACTION VIEW ────────────────────────────── */}
      <main className="max-w-4xl mx-auto w-full flex-1 px-4 sm:px-6 py-6 sm:py-8 flex flex-col justify-center min-h-0 space-y-6">
        {/* QUESTION DISPLAY CARD */}
        {currentQ && (
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-5 sm:p-7 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#136573]/20 border border-[#136573]/40 text-[#2298ab] text-[10px] font-bold uppercase tracking-widest">
                  Question {currentIdx + 1} of {testData.questions.length}
                </span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                  {currentQ.category || "Technical Competency"}
                </span>
              </div>

              {/* TTS Speaker Button */}
              <button
                type="button"
                onClick={() => {
                  if (isAiSpeakingQuestion) stopSpeaking();
                  else speakText(currentQ.question);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Speak question aloud"
              >
                {isAiSpeakingQuestion ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                    <span>Stop Voice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-[#2298ab]" />
                    <span>Listen to AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Prompt Text */}
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 leading-relaxed tracking-tight">
              "{currentQ.question}"
            </h2>
          </div>
        )}

        {/* ── CORE INTERACTION STATES ───────────────────── */}

        {/* STATE 1: READY TO SPEAK */}
        {interactionState === "ready_to_record" && (
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 sm:p-12 text-center shadow-xl space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#136573]/20 border border-[#136573]/40 text-[#2298ab] flex items-center justify-center mx-auto shadow-inner">
              <Mic className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Ready for your response</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Click below to start recording. Speak clearly at normal conversational volume. Your answer will be transcribed and displayed on screen for you to edit.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={handleStartSpeaking}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-[#136573] to-[#2298ab] hover:from-[#177888] hover:to-[#27abc1] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#136573]/20 transition-all cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                Start Speaking Now (Record)
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: LIVE RECORDING IN PROGRESS */}
        {interactionState === "recording" && (
          <div className="bg-[#111827] border border-red-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-xl space-y-6 border-dashed">
            {/* Live Indicator & Timer */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-red-400 animate-pulse text-xs font-bold uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                Live Microphone Active
              </div>
              <div className="font-mono text-sm font-bold text-white bg-black/40 px-2.5 py-1 rounded border border-white/10">
                {formatTime(recordingSeconds)}
              </div>
            </div>

            {/* Dynamic Waveform Visualizer */}
            <div className="py-6 flex items-end justify-center gap-1.5 h-28">
              {[...Array(24)].map((_, i) => {
                const seed = [
                  0.3, 0.7, 0.4, 0.9, 0.2, 0.6, 0.8, 1.0, 0.5, 0.85, 0.35, 0.95, 0.4, 0.75, 0.25, 0.9, 0.5,
                  0.3, 0.8, 0.6, 0.4, 0.7, 0.2, 0.5,
                ][i];
                const dynamicHeight = Math.max(15, Math.min(100, 15 + (volumeLevel / 100) * (seed * 85 + 15)));
                return (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-gradient-to-t from-[#136573] to-[#2298ab] transition-all duration-75"
                    style={{ height: `${dynamicHeight}%` }}
                  />
                );
              })}
            </div>

            {/* Live Streaming Transcript */}
            <div className="p-4 bg-black/40 border border-white/5 rounded-xl text-left max-h-32 overflow-y-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Live Transcription Stream:
              </span>
              <p className="text-xs text-slate-200 italic leading-relaxed">
                {liveTranscript ? `"${liveTranscript}"` : "Listening for voice..."}
              </p>
            </div>

            {/* Stop Button */}
            <button
              type="button"
              onClick={handleStopSpeaking}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-900/30 transition-all cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              Done Speaking (Stop & Review Transcript)
            </button>
          </div>
        )}

        {/* STATE 3: TRANSCRIBING SPINNER */}
        {interactionState === "transcribing" && (
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-12 text-center shadow-xl space-y-4">
            <Loader2 className="w-10 h-10 text-[#2298ab] animate-spin mx-auto" />
            <h3 className="text-base font-bold text-white">Finalizing Speech Transcription...</h3>
            <p className="text-xs text-slate-400">Formatting your spoken words into an editable transcript</p>
          </div>
        )}

        {/* STATE 4: THE USER REQUIREMENT -> EDITABLE TRANSCRIPTION REVIEW */}
        {interactionState === "review_transcript" && (
          <div className="bg-[#111827] border border-[#136573]/50 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
            {/* Banner Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Speech Transcribed • Editable
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Review and edit your response below before confirming. Correct any misrecognized words or add technical details.
                  </p>
                </div>
              </div>

              {/* Re-record Option */}
              <button
                type="button"
                onClick={handleReRecord}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all self-start sm:self-auto cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Re-record Answer</span>
              </button>
            </div>

            {/* Editable Text Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span className="flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5 text-[#2298ab]" />
                  Your Editable Answer:
                </span>
                <span>
                  {currentEditableAnswer.trim().split(/\s+/).filter(Boolean).length} words • {currentEditableAnswer.length} chars
                </span>
              </div>

              <textarea
                rows={6}
                value={currentEditableAnswer}
                onChange={(e) => setCurrentEditableAnswer(e.target.value)}
                placeholder="Your transcribed spoken answer will appear here. You can click here to edit, fix typos, or add technical explanation..."
                className="w-full text-sm sm:text-base p-4 rounded-xl border border-white/15 bg-black/50 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2298ab]/50 focus:border-[#2298ab] leading-relaxed transition-all font-sans"
              />
            </div>

            {/* Confirmation & Next Question Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-slate-500">
                Clicking confirm locks this answer and moves forward.
              </p>

              <button
                type="button"
                onClick={handleConfirmAndNext}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#136573] to-[#2298ab] hover:from-[#177888] hover:to-[#27abc1] text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-[#136573]/20 transition-all cursor-pointer"
              >
                {currentIdx < testData.questions.length - 1 ? (
                  <>
                    <span>Confirm Answer & Next Question</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm Final Answer & Submit Assessment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM PROGRESS & NAVIGATION ─────────────────────── */}
      <footer className="px-4 sm:px-8 py-3 bg-[#111827]/80 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {testData.questions.map((q, idx) => {
              const isAnswered = Boolean(answers[q.id]?.trim());
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    if (isRecording) return;
                    stopSpeaking();
                    // Save current if on review
                    if (currentQ && currentEditableAnswer.trim()) {
                      setAnswers((prev) => ({ ...prev, [currentQ.id]: currentEditableAnswer.trim() }));
                    }
                    setCurrentIdx(idx);
                    const targetAns = answers[q.id] || "";
                    setCurrentEditableAnswer(targetAns);
                    setInteractionState(targetAns ? "review_transcript" : "ready_to_record");
                  }}
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-[#2298ab] text-white shadow-md ring-2 ring-[#2298ab]/40"
                      : isAnswered
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-white/5 text-slate-500 hover:bg-white/10"
                  }`}
                  title={`Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 hidden sm:block">
            American Hairline Recruitment Portal • AI Interview
          </div>
        </div>
      </footer>
    </div>
  );
}
