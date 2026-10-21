"use client";

import React, { useState } from "react";
import { Briefcase, Users, GitFork, Calendar, Plus } from "lucide-react";
import RequisitionsTab from "@/components/recruitment/RequisitionsTab";
import CandidateApplicationsTab from "@/components/recruitment/CandidateApplicationsTab";
import CandidatePipelineTab from "@/components/recruitment/CandidatePipelineTab";
import TodayInterviewsTab from "@/components/recruitment/TodayInterviewsTab";
import type { FmsRequisition } from "@/types/fms";

type RecruitmentTabType = "requisitions" | "candidates" | "pipeline" | "interviews";

export default function RecruitmentPage() {
  const [activeTab, setActiveTab] = useState<RecruitmentTabType>("requisitions");
  const [targetedReqId, setTargetedReqId] = useState<string | undefined>(undefined);
  const [autoOpenAddModal, setAutoOpenAddModal] = useState<boolean>(false);

  const handleAddCandidateForReq = (req: FmsRequisition) => {
    setTargetedReqId(req.id);
    setAutoOpenAddModal(true);
    setActiveTab("candidates");
  };

  const handleSelectRequisition = (req: FmsRequisition) => {
    setTargetedReqId(req.id);
    setAutoOpenAddModal(false);
    setActiveTab("candidates");
  };

  return (
    <div className="space-y-6">
      {/* ────────────────────────────────────────────────────────── */}
      {/* RECRUITMENT WORKSPACE SUB-NAVIGATION HEADER */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-xl border border-borderline p-2 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tab 1: Job Requisitions */}
          <button
            onClick={() => setActiveTab("requisitions")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "requisitions"
                ? "bg-primary text-white shadow-xs"
                : "text-muted hover:text-navy hover:bg-canvas"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Job Requisitions</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === "requisitions" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              18
            </span>
          </button>

          {/* Tab 2: Candidate Applications & Intake */}
          <button
            onClick={() => {
              setActiveTab("candidates");
              setAutoOpenAddModal(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "candidates"
                ? "bg-primary text-white shadow-xs"
                : "text-muted hover:text-navy hover:bg-canvas"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Candidate Applications</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === "candidates" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              48
            </span>
          </button>

          {/* Tab 3: Candidate FMS Pipeline */}
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "pipeline"
                ? "bg-primary text-white shadow-xs"
                : "text-muted hover:text-navy hover:bg-canvas"
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Pipeline FMS</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === "pipeline" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              6 Stages
            </span>
          </button>

          {/* Tab 4: Today's Interviews */}
          <button
            onClick={() => setActiveTab("interviews")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "interviews"
                ? "bg-primary text-white shadow-xs"
                : "text-muted hover:text-navy hover:bg-canvas"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Today's Interviews</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "interviews" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              5
            </span>
          </button>
        </div>

        {/* Quick Action Button */}
        {activeTab === "requisitions" && (
          <button
            onClick={() => {
              setTargetedReqId(undefined);
              setAutoOpenAddModal(true);
              setActiveTab("candidates");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas border border-borderline hover:bg-slate-100 text-xs font-semibold text-navy transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>Intake Candidate</span>
          </button>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB CONTENT AREA */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "requisitions" && (
        <RequisitionsTab
          onSelectRequisition={handleSelectRequisition}
          onAddCandidateForReq={handleAddCandidateForReq}
        />
      )}

      {activeTab === "candidates" && (
        <CandidateApplicationsTab
          initialRequisitionId={targetedReqId}
          initialOpenAddModal={autoOpenAddModal}
          onClearInitialReq={() => setTargetedReqId(undefined)}
          onNavigateToRequisitions={() => setActiveTab("requisitions")}
        />
      )}

      {activeTab === "pipeline" && (
        <CandidatePipelineTab
          initialRequisitionId={targetedReqId}
          onNavigateToApplications={() => {
            setTargetedReqId(undefined);
            setActiveTab("candidates");
          }}
          onNavigateToRequisitions={() => setActiveTab("requisitions")}
        />
      )}

      {activeTab === "interviews" && (
        <TodayInterviewsTab
          onNavigateToPipeline={() => setActiveTab("pipeline")}
        />
      )}
    </div>
  );
}
