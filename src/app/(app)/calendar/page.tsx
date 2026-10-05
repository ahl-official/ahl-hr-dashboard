"use client";

import { useDashboard } from "@/context/DashboardContext";
import { HRCalendarView } from "@/components/calendar/HRCalendarView";

export default function CalendarPage() {
  const d = useDashboard();
  return (
    <HRCalendarView
      employees={d.filteredEmployees}
      meetings={d.activeMeetings}
      birthdays={d.birthdays}
      milestones={d.milestonesAll}
      onOpenRecordMeeting={(prefill) => d.openMeeting(prefill)}
      onSelectEmployee={d.setSelectedEmployee}
    />
  );
}
