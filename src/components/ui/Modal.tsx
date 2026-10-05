"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Buttons for the fixed footer. Use <button type="submit" form="..."> to submit a form in the body. */
  footer?: React.ReactNode;
  busy?: boolean;
  size?: "md" | "lg";
  children: React.ReactNode;
}

/**
 * Pop-up with a fixed header and footer; only the middle scrolls, so the title and the Save button can
 * never be cropped. On phones it becomes a full-height bottom sheet.
 */
export function Modal({ isOpen, onClose, title, subtitle, footer, busy = false, size = "md", children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind must not scroll
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-navy-900/60" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 bg-surface w-full ${size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[100dvh] sm:max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-xl border border-borderline shadow-lg`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-borderline shrink-0">
          <div>
            <h2 className="text-base font-semibold text-navy-DEFAULT">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="p-1.5 -mr-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-borderline bg-slate-50/60 flex items-center justify-end gap-3 shrink-0 sm:rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}
