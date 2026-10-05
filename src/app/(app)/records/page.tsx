"use client";

import { useDashboard } from "@/context/DashboardContext";
import { HRRecordsSection } from "@/components/dashboard/HRRecordsSection";

export default function RecordsPage() {
  const d = useDashboard();
  return <HRRecordsSection meetings={d.meetings} onOpenAddMeeting={() => d.openMeeting()} />;
}
