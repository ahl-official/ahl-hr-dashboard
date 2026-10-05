"use client";

import { useDashboard } from "@/context/DashboardContext";
import { WorkforceInsights } from "@/components/dashboard/WorkforceInsights";
import { DataReadinessPanel } from "@/components/dashboard/DataReadinessPanel";

export default function InsightsPage() {
  const d = useDashboard();
  return (
    <>
      <WorkforceInsights employees={d.filteredEmployees} />
      <DataReadinessPanel employees={d.filteredEmployees} allEmployees={d.employees} />
    </>
  );
}
