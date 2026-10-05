"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { HRCalendarView, type SalonInfo } from "@/components/calendar/HRCalendarView";

export default function CalendarPage() {
  const d = useDashboard();
  const [salon, setSalon] = useState<SalonInfo | null>(null);

  // Monthly team meeting + reminder status; refreshed every minute so "last check" stays honest
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/meeting-reminders", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => { if (alive && j?.success) setSalon(j); })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <HRCalendarView
      salon={salon}
      employees={d.filteredEmployees}
      meetings={d.activeMeetings}
      birthdays={d.birthdays}
      milestones={d.milestonesAll}
      onOpenRecordMeeting={(prefill) => d.openMeeting(prefill)}
      onSelectEmployee={d.setSelectedEmployee}
    />
  );
}
