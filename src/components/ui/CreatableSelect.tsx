"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  DropdownOption,
  OTHER_OPTION_VALUE,
  mergeDropdownOptions,
  normalizeDropdownValue,
} from "@/lib/custom-dropdown-rules";

type DropdownMap = Record<string, string[]>;

let sharedOptionsCache: DropdownMap | null = null;
let inFlightFetch: Promise<DropdownMap> | null = null;
const subscribers = new Set<(data: DropdownMap) => void>();

function notifySubscribers(data: DropdownMap) {
  sharedOptionsCache = data;
  subscribers.forEach((fn) => fn(data));
}

async function fetchSharedDropdowns(): Promise<DropdownMap> {
  if (sharedOptionsCache) return sharedOptionsCache;
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = fetch("/api/meta/dropdowns", { cache: "no-store" })
    .then((r) => r.json())
    .then((json) => {
      const data: DropdownMap = json?.success && json?.data && typeof json.data === "object" ? json.data : {};
      notifySubscribers(data);
      return data;
    })
    .catch(() => ({}))
    .finally(() => {
      inFlightFetch = null;
    });

  return inFlightFetch;
}

export function useCustomDropdownOptions(category: string): string[] {
  const [map, setMap] = useState<DropdownMap>(() => sharedOptionsCache || {});

  useEffect(() => {
    const listener = (next: DropdownMap) => setMap({ ...next });
    subscribers.add(listener);
    if (!sharedOptionsCache) {
      fetchSharedDropdowns();
    } else {
      setMap({ ...sharedOptionsCache });
    }
    return () => {
      subscribers.delete(listener);
    };
  }, []);

  return map[category] || [];
}

export interface CreatableSelectProps {
  category: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly DropdownOption[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  otherLabel?: string;
  customPlaceholder?: string;
}

export function CreatableSelect({
  category,
  value,
  onChange,
  options,
  placeholder,
  className = "",
  required = false,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  otherLabel = "+ Other (Add custom...)",
  customPlaceholder = "Type new option & click Add",
}: CreatableSelectProps) {
  const customOptions = useCustomDropdownOptions(category);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const mergedOptions = useMemo(
    () => mergeDropdownOptions(options, customOptions, value),
    [options, customOptions, value]
  );

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleSaveCustom = async () => {
    const clean = normalizeDropdownValue(draft);
    if (!clean) {
      setError("Please enter a value.");
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/meta/dropdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, value: clean }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Could not save option");
      }

      const savedValue: string = json?.data?.value || clean;
      const updatedList: string[] = Array.isArray(json?.data?.options)
        ? json.data.options
        : [...(sharedOptionsCache?.[category] || []), savedValue];

      notifySubscribers({
        ...(sharedOptionsCache || {}),
        [category]: updatedList,
      });

      onChange(savedValue);
      setDraft("");
      setIsAdding(false);
    } catch (err: any) {
      setError(err?.message || "Failed to save custom entry");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft("");
    setError("");
    setIsAdding(false);
  };

  if (isAdding && !disabled) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={draft}
            disabled={saving}
            onChange={(e) => {
              setError("");
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleSaveCustom();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                handleCancel();
              }
            }}
            placeholder={customPlaceholder}
            aria-label={ariaLabel ? `${ariaLabel} custom entry` : "Custom dropdown entry"}
            className={`${className} flex-1 min-w-0`}
          />
          <button
            type="button"
            onClick={handleSaveCustom}
            disabled={saving}
            title="Save option to dropdown"
            className="inline-flex items-center gap-1 px-2.5 h-9 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 shrink-0 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Add</span>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            title="Cancel"
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-borderline bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-60 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {error && <p className="text-[11px] font-medium text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value}
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => {
        if (e.target.value === OTHER_OPTION_VALUE) {
          setIsAdding(true);
          setDraft("");
          setError("");
        } else {
          onChange(e.target.value);
        }
      }}
      className={className}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {mergedOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {!disabled && <option value={OTHER_OPTION_VALUE}>{otherLabel}</option>}
    </select>
  );
}
