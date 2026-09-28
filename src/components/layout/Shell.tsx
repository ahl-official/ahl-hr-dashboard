"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  PartyPopper,
  FileText,
  BarChart3,
  Users,
  UserPlus,
  X,
  ShieldCheck,
  Building2,
  Calendar,
} from "lucide-react";

interface ShellProps {
  children: React.ReactNode;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  employeeCount: number;
  activeCount: number;
  recordsCount?: number;
  alertCount?: number;
  reviewCount?: number;
}

export function Shell({
  children,
  activeSection,
  onNavigate,
  mobileMenuOpen,
  onCloseMobileMenu,
  employeeCount,
  activeCount,
  recordsCount = 0,
  alertCount = 0,
  reviewCount = 0,
}: ShellProps) {
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "calendar", label: "HR Calendar", icon: Calendar },
    {
      id: "celebrations",
      label: "Celebrations & Reviews",
      icon: PartyPopper,
      badge: reviewCount > 0 ? `${reviewCount}` : undefined,
      badgeColor: "bg-indigo-500/20 text-indigo-300",
    },
    {
      id: "records",
      label: "HR Records",
      icon: FileText,
      badge: recordsCount > 0 ? `${recordsCount}` : undefined,
      badgeColor: "bg-slate-700 text-slate-300",
    },
    { id: "insights", label: "Insights", icon: BarChart3 },
    {
      id: "directory",
      label: "Employee Directory",
      icon: Users,
      badge: employeeCount > 0 ? `${employeeCount}` : undefined,
      badgeColor: "bg-slate-700 text-slate-300",
    },
    {
      id: "add-employee",
      label: "Add Employee",
      icon: UserPlus,
      badge: "+",
      badgeColor: "bg-emerald-500/30 text-emerald-300 font-bold",
    },
  ];

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        onCloseMobileMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, onCloseMobileMenu]);

  return (
    <div className="min-h-screen flex bg-canvas text-navy-DEFAULT antialiased">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-navy-800 text-white shrink-0 border-r border-slate-700/50 min-h-screen sticky top-0 h-screen select-none">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-700/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-900/40">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-base">AHL HR OS</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Command Center</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-6 px-3.5 space-y-1 overflow-y-auto">
          <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2">
            Workforce Portal
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isActive ? "bg-white/20 text-white" : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Statistics */}
        <div className="p-4 m-3 rounded-2xl bg-slate-900/60 border border-slate-700/50 text-xs">
          <div className="flex items-center justify-between text-slate-300 mb-1.5">
            <span className="font-medium text-slate-400">Total Workforce</span>
            <span className="font-bold text-white text-sm">{employeeCount}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="font-medium text-slate-400">Active Records</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {activeCount} active
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Secure HR Portal
            </span>
            <span className="text-[10px] text-slate-400">v7.2</span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-navy-900/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobileMenu}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85%] bg-navy-800 text-white flex flex-col h-full shadow-2xl z-10">
            <div className="p-5 border-b border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="font-bold text-white text-sm">AHL HR OS</span>
                  <p className="text-[11px] text-slate-400">Command Center</p>
                </div>
              </div>
              <button
                onClick={onCloseMobileMenu}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onCloseMobileMenu();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isActive ? "bg-white/20 text-white" : item.badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-700/60 text-xs text-slate-400">
              <p>American Hairline Group</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Encrypted Workforce Hub</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen">
        {children}
      </div>
    </div>
  );
}
