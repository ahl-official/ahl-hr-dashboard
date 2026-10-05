"use client";

import React, { useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Users,
  X,
  ShieldCheck,
  Calendar,
  Plug,
  type LucideIcon,
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

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
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
  reviewCount = 0,
}: ShellProps) {
  const groups: NavGroup[] = [
    {
      title: "Workforce",
      items: [
        { id: "overview", label: "Overview & Employees", icon: LayoutDashboard, badge: reviewCount > 0 ? `${reviewCount}` : undefined },
        { id: "calendar", label: "HR Calendar", icon: Calendar },
      ],
    },
    {
      title: "People Operations",
      items: [
        { id: "records", label: "HR Records", icon: FileText, badge: recordsCount > 0 ? `${recordsCount}` : undefined },
        { id: "insights", label: "Insights", icon: BarChart3 },
      ],
    },
  ];

  // Mobile bottom bar: the four most-used destinations
  const bottomNav = [...groups[0].items, ...groups[1].items];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) onCloseMobileMenu();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, onCloseMobileMenu]);

  const brand = (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[13px] font-bold tracking-tight">
        AHL
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">HR Command Center</div>
        <div className="text-[11px] text-slate-400">American Hairline</div>
      </div>
    </div>
  );

  const navList = (closeAfter: boolean) => (
    <nav className="flex-1 py-4 px-3 overflow-y-auto" aria-label="Primary">
      {groups.map((group) => (
        <div key={group.title} className="mb-5">
          <p className="px-3 mb-1.5 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onNavigate(item.id);
                      if (closeAfter) onCloseMobileMenu();
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative w-full flex items-center justify-between gap-2 pl-3 pr-2.5 py-2 rounded-md text-[13px] font-medium transition-colors ${
                      isActive
                        ? "bg-white/[0.07] text-white"
                        : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-indigo-400" />}
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-300" : "text-slate-500"}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">{item.badge}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mb-5">
        <p className="px-3 mb-1.5 text-[11px] font-medium tracking-wide text-slate-500 uppercase">Platforms</p>
        <div
          className="flex items-center justify-between pl-3 pr-2.5 py-2 rounded-md text-[13px] font-medium text-slate-600 cursor-not-allowed"
          title="HireOS and other platform integrations will appear here"
        >
          <span className="flex items-center gap-2.5">
            <Plug className="w-4 h-4 text-slate-600" />
            Integrations
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-px">
            Soon
          </span>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-canvas text-navy-DEFAULT antialiased">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[248px] bg-navy-800 shrink-0 sticky top-0 h-screen select-none">
        <div className="h-16 px-4 flex items-center border-b border-white/[0.06]">{brand}</div>
        {navList(false)}
        <div className="px-4 py-3 border-t border-white/[0.06] text-[11px] text-slate-400 space-y-1.5">
          <div className="flex justify-between">
            <span>Workforce</span>
            <span className="font-mono text-slate-200">{employeeCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Active</span>
            <span className="font-mono text-slate-200">{activeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1.5 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5" /> Secure HR portal
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-navy-900/60" onClick={onCloseMobileMenu} aria-hidden="true" />
          <div className="relative w-72 max-w-[85%] bg-navy-800 flex flex-col h-full z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.06]">
              {brand}
              <button
                onClick={onCloseMobileMenu}
                className="p-2 -mr-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navList(true)}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-16 lg:pb-0">{children}</div>

      {/* Mobile bottom bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-borderline grid grid-cols-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Quick navigation"
      >
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-medium ${
                isActive ? "text-indigo-700" : "text-slate-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label.split(" ").pop()}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
