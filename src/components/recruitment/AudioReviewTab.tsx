import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  FileAudio,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ListOrdered,
  ChevronRight,
  X,
  Play,
  Download,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface AudioReview {
  id: string;
  name: string;
  role: string;
  hrNotes: string;
  audioFileName: string;
  transcript: string;
  report: {
    candidateProfile?: string;
    summary?: string;
    communicationAssessment?: string;
    roleFit?: string;
    greenFlags?: Array<{ title: string; detail: string }>;
    redFlags?: Array<{ title: string; detail: string }>;
    recommendation?: string;
    finalVerdict?: string;
  };
  recommendation: string;
  finalVerdict: string;
  status: string;
  timestamp: string;
}

export default function AudioReviewTab() {
  const [reviews, setReviews] = useState<AudioReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AudioReview | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [transcriptModel, setTranscriptModel] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const recognitionRef = useRef<any>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recruitment/audio");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setReviews(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setError("");
  };

  const handleTranscribeAudioFile = async () => {
    if (!audioFile) {
      setError("Please select an audio file first.");
      return;
    }

    setTranscribing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", audioFile);

      const res = await fetch("/api/recruitment/audio/transcribe", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to transcribe audio.");
      }

      setTranscript(json.data.transcript || "");
      setTranscriptModel(json.data.model || "AssemblyAI Universal-3-Pro");
    } catch (err: any) {
      setError(
        err.message ||
          "Could not transcribe audio. Ensure ASSEMBLYAI_API_KEY or OPENAI_API_KEY is configured in .env, or use Live Dictation."
      );
    } finally {
      setTranscribing(false);
    }
  };

  const toggleDictation = () => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognition) {
      alert("Browser Speech Recognition is not supported. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (isDictating && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onresult = (event: any) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript + " ";
        }
        setTranscript(text.trim());
        setTranscriptModel("Browser Web Speech API");
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsDictating(true);
    } catch (err: any) {
      console.error(err);
      setIsDictating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) {
      setError("Candidate name and role are required.");
      return;
    }

    if (!transcript.trim()) {
      setError("Please transcribe an audio file or paste the candidate's interview transcript.");
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/recruitment/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          hrNotes: hrNotes.trim(),
          audioFileName: audioFile?.name || "interview_audio.mp3",
          transcript: transcript.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setSuccess(true);
      setName("");
      setRole("");
      setHrNotes("");
      setTranscript("");
      setTranscriptModel("");
      setAudioFile(null);
      await fetchReviews();
    } catch (err: any) {
      setError(err.message || "Failed to process audio review.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadPdf = async (review: AudioReview) => {
    const el = document.getElementById("audio-review-report-printable");
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${review.name}-Audio-Evaluation.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Upload & Process */}
        <div className="bg-surface rounded-xl border border-borderline shadow-card p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-borderline">
            <Mic className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-navy">New Audio Interview Review</h3>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 mb-4 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              Audio review analyzed and saved to Google Sheets!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Candidate Name *</label>
              <input
                type="text"
                required
                placeholder="Candidate Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Applied Role *</label>
              <input
                type="text"
                required
                placeholder="e.g. Sales Executive / Video Editor"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-navy">Audio Recording (MP3, WAV, M4A, WEBM)</label>
                {audioFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setAudioFile(null);
                      setTranscriptModel("");
                    }}
                    className="text-[10px] text-muted hover:text-rose-600 cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="border border-dashed border-borderline rounded-xl p-3.5 bg-canvas text-center space-y-2">
                <input
                  type="file"
                  accept="audio/*"
                  id="audio-upload"
                  className="hidden"
                  onChange={handleAudioUpload}
                />
                <label
                  htmlFor="audio-upload"
                  className="text-xs text-primary font-semibold hover:underline cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileAudio className="w-4 h-4" />
                  {audioFile ? audioFile.name : "Select or Drop Audio Interview File"}
                </label>

                {audioFile && (
                  <div className="pt-2 border-t border-borderline flex items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={transcribing}
                      onClick={handleTranscribeAudioFile}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {transcribing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Transcribing with AI...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Transcribe Audio (AssemblyAI / Whisper)
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-navy">
                  Interview Transcript
                </label>
                <div className="flex items-center gap-2">
                  {transcriptModel && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                      {transcriptModel}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                      isDictating
                        ? "bg-rose-100 text-rose-700 border border-rose-200 animate-pulse"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {isDictating ? (
                      <>
                        <MicOff className="w-3 h-3 text-rose-600" />
                        Listening... Stop
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3 text-primary" />
                        Live Dictation (Mic)
                      </>
                    )}
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                required
                placeholder="Upload audio above to transcribe automatically, click 'Live Dictation' to speak, or paste interview notes..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full text-xs p-3 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">HR Interviewer Notes</label>
              <textarea
                rows={2}
                placeholder="Observations on energy, confidence, cultural fit..."
                value={hrNotes}
                onChange={(e) => setHrNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-lg border border-borderline bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              {processing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  AI Evaluating Audio...
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  Process & AI Evaluate Audio
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right List: Recent Audio Reviews */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-borderline shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-borderline">
            <h3 className="text-sm font-bold text-navy flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-primary" />
              Completed Audio Reviews ({reviews.length})
            </h3>
            <span className="text-[11px] text-muted">Click any review to open detailed report</span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted">
              No audio reviews recorded yet. Upload an audio recording on the left to evaluate.
            </div>
          ) : (
            <div className="divide-y divide-borderline max-h-[620px] overflow-y-auto">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  onClick={() => setSelectedReview(rev)}
                  className="py-3.5 px-3 hover:bg-canvas rounded-lg transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-navy group-hover:text-primary transition-colors">
                        {rev.name}
                      </span>
                      <span className="text-[10px] text-muted">• {rev.role}</span>
                    </div>
                    <div className="text-[11px] text-muted mt-1 truncate max-w-md">
                      {rev.finalVerdict || rev.recommendation || "Evaluated"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        rev.finalVerdict?.toLowerCase() === "proceed"
                          ? "bg-emerald-100 text-emerald-800"
                          : rev.finalVerdict?.toLowerCase() === "reject"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {rev.finalVerdict || "Completed"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DETAIL MODAL / DRAWER */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-navy/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-surface h-full shadow-2xl flex flex-col border-l border-borderline animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-6 border-b border-borderline flex items-center justify-between bg-canvas">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-navy">{selectedReview.name}</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-primary">
                    {selectedReview.finalVerdict || "Evaluated"}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">Applied for {selectedReview.role}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(selectedReview)}
                  className="px-3 py-1.5 bg-white border border-borderline hover:bg-slate-50 text-navy text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF Report
                </button>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="p-1.5 rounded-lg text-muted hover:text-navy hover:bg-slate-200 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div id="audio-review-report-printable" className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Executive Summary */}
              <div className="bg-canvas rounded-xl p-4 border border-borderline space-y-2">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                  Hiring Summary & Recommendation
                </span>
                <p className="text-xs text-navy leading-relaxed font-medium">
                  {selectedReview.report?.summary || selectedReview.recommendation}
                </p>
                {selectedReview.report?.recommendation && (
                  <div className="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                    💡 HR Next Step: {selectedReview.report.recommendation}
                  </div>
                )}
              </div>

              {/* Communication & Role Fit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-canvas rounded-xl p-4 border border-borderline">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                    Communication Assessment
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed">
                    {selectedReview.report?.communicationAssessment || "Professional pacing and clarity observed."}
                  </p>
                </div>

                <div className="bg-canvas rounded-xl p-4 border border-borderline">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                    Role Fit Analysis
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed">
                    {selectedReview.report?.roleFit || "Meets core job requirements for the designated profile."}
                  </p>
                </div>
              </div>

              {/* Green & Red Flags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Green Flags ({selectedReview.report?.greenFlags?.length || 0})
                  </span>
                  {(selectedReview.report?.greenFlags || []).map((f, i) => (
                    <div key={i} className="text-xs text-emerald-900">
                      <strong>• {f.title}:</strong> {f.detail}
                    </div>
                  ))}
                </div>

                <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-100 space-y-2">
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                    Red Flags ({selectedReview.report?.redFlags?.length || 0})
                  </span>
                  {(selectedReview.report?.redFlags || []).map((f, i) => (
                    <div key={i} className="text-xs text-rose-900">
                      <strong>• {f.title}:</strong> {f.detail}
                    </div>
                  ))}
                </div>
              </div>

              {/* Transcript */}
              {selectedReview.transcript && (
                <div className="bg-canvas rounded-xl p-4 border border-borderline space-y-2">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
                    Transcript & Audio Notes
                  </span>
                  <p className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {selectedReview.transcript}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
