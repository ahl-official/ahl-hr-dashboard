"use client";

import React from "react";
import Link from "next/link";
import { RefreshCw, Menu, UserPlus } from "lucide-react";
import { formatDateTime } from "@/lib/date-utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showAdd?: boolean;
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenMobileMenu: () => void;
}

export function Header({
  title,
  subtitle,
  showAdd = true,
  lastUpdated,
  onRefresh,
  isRefreshing,
  onOpenMobileMenu,
}: HeaderProps) {
  return (
    <header className="bg-surface border-b border-borderline sticky top-0 z-30 h-16 px-4 sm:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-md text-slate-600 hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-navy-DEFAULT tracking-tight truncate">
            {title}
          </h1>
          {subtitle && <p className="hidden sm:block text-xs text-muted truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {lastUpdated && (
          <span className="hidden md:block text-xs text-muted">
            Synced <span className="font-medium text-slate-700">{formatDateTime(lastUpdated)}</span>
          </span>
        )}

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center h-9 w-9 sm:w-auto sm:px-3 gap-2 rounded-md text-sm font-medium border border-borderline bg-surface text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          title="Refresh records from database"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
          <span className="hidden sm:inline">{isRefreshing ? "Refreshing" : "Refresh"}</span>
        </button>

        {showAdd && (
        <Link
          href="/add-employee"
          className="inline-flex items-center gap-2 h-9 px-3 sm:px-4 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Employee</span>
          <span className="sm:hidden">Add</span>
        </Link>
        )}
      </div>
    </header>
  );
}
