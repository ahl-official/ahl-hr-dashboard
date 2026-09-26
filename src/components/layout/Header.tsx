"use client";

import React from "react";
import { RefreshCw, Menu, UserPlus, Sparkles } from "lucide-react";
import { formatDateTime } from "@/lib/date-utils";

interface HeaderProps {
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenMobileMenu: () => void;
  onOpenAddEmployee: () => void;
}

export function Header({
  lastUpdated,
  onRefresh,
  isRefreshing,
  onOpenMobileMenu,
  onOpenAddEmployee,
}: HeaderProps) {
  return (
    <header className="bg-surface border-b border-borderline sticky top-0 z-30 px-4 sm:px-8 py-4 sm:py-5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title area */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 rounded-lg -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-[11px] font-bold tracking-widest text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/60">
              Workforce Overview
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-navy-DEFAULT tracking-tight">
            HR Command Center
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5 max-w-xl">
            A clear view of your people, milestones and workforce mix.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 self-start md:self-center">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-muted block leading-none">Last Synced</span>
            <span className="text-xs font-semibold text-slate-700 block mt-1">
              {formatDateTime(lastUpdated)}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-borderline bg-surface text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            title="Refresh records from database"
          >
            <RefreshCw
              className={`w-4 h-4 text-slate-500 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`}
            />
            <span className="hidden xs:inline">{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          {/* Add Employee CTA */}
          <button
            onClick={onOpenAddEmployee}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>
    </header>
  );
}
