"use client";

import React, { useState, useEffect, use } from "react";
import {
  Sparkles,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Clock,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  BarChart3,
} from "lucide-react";

interface Option {
  label: "A" | "B" | "C" | "D";
  dim: "D" | "I" | "S" | "C";
  text: string;
}

interface Question {
  questionNo: number;
  question: string;
  options: Option[];
}

export default function PsychometricTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testData, setTestData] = useState<any>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [completedData, setCompletedData] = useState<any>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, "D" | "I" | "S" | "C">>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<any>(null);

  useEffect(() => {
    async function loadTest() {
      try {
        setLoading(true);
        const search = window.location.search;
        const res = await fetch(`/api/psychometric/${encodeURIComponent(id)}${search}`);
        const json = await res.json();

        if (!json.success) {
          setError(json.message || "Unable to load assessment");
          return;
        }

        if (json.alreadyCompleted) {
          setAlreadyCompleted(true);
          setCompletedData(json.data);
        } else {
          setTestData(json.data);
        }
      } catch (err: any) {
        setError(err.message || "Failed to connect to assessment service");
      } finally {
        setLoading(false);
      }
    }

    loadTest();
  }, [id]);

  const handleSelectOption = (dim: "D" | "I" | "S" | "C") => {
    if (!testData) return;
    const qNum = testData.questions[currentIndex].questionNo;
    setAnswers((prev) => ({ ...prev, [qNum]: dim }));
  };

  const handleNext = () => {
    if (testData && currentIndex < testData.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!testData) return;
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < testData.questions.length) {
      if (
        !window.confirm(
          `You have answered ${answeredCount} of ${testData.questions.length} questions. For the most accurate behavioral profile, all 20 questions are recommended. Submit now anyway?`
        )
      ) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/psychometric/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: testData.entityType,
          answers,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        alert(json.message || "Submission failed. Please try again.");
        return;
      }

      setSubmittedResult(json.data);
    } catch (err) {
      alert("Network error submitting assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#136573] mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading Assessment...</p>
        <p className="text-xs text-slate-400 mt-1">Preparing your behavioral profile questions</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Assessment Unavailable</h2>
          <p className="text-xs text-slate-600">{error}</p>
          <p className="text-[11px] text-slate-400">
            Please contact American Hairline HR if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  // Already Completed Screen
  if (alreadyCompleted && completedData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg w-full shadow-xl space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Assessment Completed
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">{completedData.name}</h2>
            <p className="text-xs text-slate-500">{completedData.role} • American Hairline</p>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">DISC Behavioral Profile:</span>
              <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-[#136573] font-extrabold text-sm rounded-lg">
                {completedData.discProfile}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
              {completedData.discSummary || "Strong alignment with collaborative and goal-driven team settings."}
            </p>

            <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
              <div className="bg-rose-50 p-2 rounded border border-rose-100">
                <div className="font-bold text-rose-700 text-sm">{completedData.discD}%</div>
                <div className="text-[10px] text-rose-600 font-semibold">D (Drive)</div>
              </div>
              <div className="bg-amber-50 p-2 rounded border border-amber-100">
                <div className="font-bold text-amber-700 text-sm">{completedData.discI}%</div>
                <div className="text-[10px] text-amber-600 font-semibold">I (Influence)</div>
              </div>
              <div className="bg-emerald-50 p-2 rounded border border-emerald-100">
                <div className="font-bold text-emerald-700 text-sm">{completedData.discS}%</div>
                <div className="text-[10px] text-emerald-600 font-semibold">S (Steady)</div>
              </div>
              <div className="bg-sky-50 p-2 rounded border border-sky-100">
                <div className="font-bold text-sky-700 text-sm">{completedData.discC}%</div>
                <div className="text-[10px] text-sky-600 font-semibold">C (Detail)</div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Completed on {completedData.completedAt ? new Date(completedData.completedAt).toLocaleDateString() : "Record"}. Your profile has been saved to the HR Management System.
          </p>
        </div>
      </div>
    );
  }

  // Newly Submitted Success Screen
  if (submittedResult) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-xl w-full shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#136573] to-[#0d4b55] text-white flex items-center justify-center mx-auto shadow-md">
            <Sparkles className="w-9 h-9" />
          </div>

          <div>
            <span className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Assessment Submitted Successfully
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-3">{submittedResult.headline}</h1>
            <p className="text-xs text-slate-500 mt-1">{submittedResult.profileName}</p>
          </div>

          {/* Scores Overview */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left space-y-4">
            <p className="text-xs text-slate-700 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
              {submittedResult.summary}
            </p>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Dimension Percentages:
              </span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                  <div className="font-extrabold text-rose-700 text-base">{submittedResult.scores.D}%</div>
                  <div className="text-[10px] text-rose-600 font-semibold">Dominance</div>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                  <div className="font-extrabold text-amber-700 text-base">{submittedResult.scores.I}%</div>
                  <div className="text-[10px] text-amber-600 font-semibold">Influence</div>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                  <div className="font-extrabold text-emerald-700 text-base">{submittedResult.scores.S}%</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Steadiness</div>
                </div>
                <div className="bg-sky-50 p-2.5 rounded-lg border border-sky-100">
                  <div className="font-extrabold text-sky-700 text-base">{submittedResult.scores.C}%</div>
                  <div className="text-[10px] text-sky-600 font-semibold">Conscientious</div>
                </div>
              </div>
            </div>

            {submittedResult.strengths && (
              <div>
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Top Workplace Strengths:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {submittedResult.strengths.map((str: string, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-800"
                    >
                      ✓ {str}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs text-center">
            <strong>All Done!</strong> Your behavioral profile has been recorded in the American Hairline HR Dashboard. You may now close this tab.
          </div>
        </div>
      </div>
    );
  }

  // Active Questionnaire
  const questions: Question[] = testData?.questions || [];
  const currentQ = questions[currentIndex];
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const currentAnswer = currentQ ? answers[currentQ.questionNo] : null;
  const percentComplete = Math.round((answeredCount / total) * 100);

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans text-slate-900">
      {/* Top Brand Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#136573] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              AHL
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                American Hairline • DISC Assessment
              </h1>
              <p className="text-[11px] text-slate-500">
                {testData?.name} ({testData?.role})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#136573]">{percentComplete}% Done</span>
            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-[#136573] transition-all duration-300 rounded-full"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Question Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {currentQ && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-500">
              <span className="font-bold text-[#136573] bg-[#136573]/10 px-2.5 py-0.5 rounded-full">
                Question {currentIndex + 1} of {total}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Select the statement most true to your natural instinct
              </span>
            </div>

            {/* Prompt */}
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {currentQ.question}
            </h2>

            {/* 4 Options */}
            <div className="space-y-3 pt-2">
              {currentQ.options.map((opt, oIdx) => {
                const isSelected = currentAnswer === opt.dim;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectOption(opt.dim)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                      isSelected
                        ? "bg-[#136573]/5 border-[#136573] ring-2 ring-[#136573]/20 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                        isSelected
                          ? "bg-[#136573] text-white"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Navigation Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {currentIndex < total - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-5 py-2.5 bg-[#136573] hover:bg-[#0f525e] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all"
                  >
                    Next Question
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Scoring & Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Complete Assessment
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Question Jumper Grid */}
        <div className="mt-6 flex flex-wrap justify-center gap-1.5">
          {questions.map((q, qIdx) => {
            const hasAnswer = !!answers[q.questionNo];
            const isCurrent = currentIndex === qIdx;
            return (
              <button
                key={q.questionNo}
                type="button"
                onClick={() => setCurrentIndex(qIdx)}
                className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-[#136573] text-white ring-2 ring-[#136573]/30 scale-105"
                    : hasAnswer
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {q.questionNo}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
