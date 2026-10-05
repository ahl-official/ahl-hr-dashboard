"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardProvider, useDashboard } from "@/context/DashboardContext";
import { Shell } from "@/components/layout/Shell";
import { Header } from "@/components/layout/Header";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { EmployeeProfileDrawer } from "@/components/drawers/EmployeeProfileDrawer";
import { MeetingModal } from "@/components/modals/MeetingModal";
import { DocumentModal } from "@/components/modals/DocumentModal";
import { StatusModal } from "@/components/modals/StatusModal";
import { AllBirthdaysModal } from "@/components/modals/AllBirthdaysModal";

const TITLES: Record<string, string> = {
  overview: "Overview & Employees",
  "add-employee": "Add Employee",
  calendar: "HR Calendar",
  records: "HR Records",
  insights: "Insights",
};

const SUBTITLES: Record<string, string> = {
  overview: "People, milestones and HR actions across the group",
  "add-employee": "Invite a new joiner to fill in their onboarding form",
  calendar: "Reviews, meetings, follow-ups and birthdays",
  records: "Meetings, warnings and follow-up records",
  insights: "Workforce analytics and data quality",
};

function Frame({ children }: { children: React.ReactNode }) {
  const d = useDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const activeSection = pathname === "/" ? "overview" : pathname.split("/")[1];

  const navigate = (id: string) => {
    router.push(id === "overview" ? "/" : `/${id}`);
  };

  return (
    <Shell
      activeSection={activeSection}
      onNavigate={navigate}
      mobileMenuOpen={d.mobileMenuOpen}
      onCloseMobileMenu={() => d.setMobileMenuOpen(false)}
      employeeCount={d.employees.length}
      activeCount={d.activeCount}
      recordsCount={d.meetings.length}
      reviewCount={d.milestones30.length}
    >
      <Header
        title={TITLES[activeSection] ?? "HR Command Center"}
        subtitle={SUBTITLES[activeSection]}
        showAdd={activeSection !== "add-employee"}
        lastUpdated={d.lastUpdated}
        onRefresh={() => d.fetchDashboardData(true)}
        isRefreshing={d.isRefreshing}
        onOpenMobileMenu={() => d.setMobileMenuOpen(true)}
      />

      <main className="p-4 sm:p-8 max-w-7xl mx-auto w-full flex-1">
        {!["records", "add-employee"].includes(activeSection) && (
          <div className="sticky top-16 z-20 bg-canvas -mx-4 sm:-mx-8 px-4 sm:px-8 pt-1 pb-3 mb-3">
            <GlobalFilters
              filters={d.filters}
              onChange={d.setFilters}
              onClear={() =>
                d.setFilters({ search: "", company: "", department: "", gender: "", employmentStatus: "Active" })
              }
              companies={d.companies}
              departments={d.departments}
              genders={d.genders}
              filteredCount={d.filteredEmployees.length}
              totalCount={d.employees.length}
            />
          </div>
        )}
        {d.isLoading ? <p className="py-20 text-center text-sm text-muted">Loading workforce data...</p> : children}
      </main>

      <EmployeeProfileDrawer
        employee={d.selectedEmployee}
        documents={d.documents}
        meetings={d.meetings}
        onClose={() => d.setSelectedEmployee(null)}
        onOpenMeeting={(empKey, prefill) => {
          d.setSelectedEmployee(null);
          d.openMeeting({ employeeKey: empKey, meetingType: prefill?.meetingType || "General", ...prefill });
        }}
        onOpenDocument={(empKey) => {
          d.setSelectedEmployee(null);
          d.setDocumentPrefillEmployeeKey(empKey);
          d.setDocumentModalOpen(true);
        }}
        onOpenStatus={(empKey) => {
          d.setSelectedEmployee(null);
          d.setStatusPrefillEmployeeKey(empKey);
          d.setStatusModalOpen(true);
        }}
      />

      <MeetingModal
        isOpen={d.meetingModalOpen}
        onClose={() => {
          d.setMeetingModalOpen(false);
          d.setMeetingPrefill(null);
        }}
        employees={d.employees}
        prefill={d.meetingPrefill}
        onSave={d.handleSaveMeeting}
      />
      <DocumentModal
        isOpen={d.documentModalOpen}
        onClose={() => d.setDocumentModalOpen(false)}
        employees={d.employees}
        prefillEmployeeKey={d.documentPrefillEmployeeKey}
        onSave={d.handleSaveDocument}
      />
      <StatusModal
        isOpen={d.statusModalOpen}
        onClose={() => d.setStatusModalOpen(false)}
        employees={d.employees}
        prefillEmployeeKey={d.statusPrefillEmployeeKey}
        onSave={d.handleSaveStatus}
      />
      <AllBirthdaysModal
        isOpen={d.allBirthdaysModalOpen}
        onClose={() => d.setAllBirthdaysModalOpen(false)}
        birthdays={d.birthdays}
      />
    </Shell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <Frame>{children}</Frame>
    </DashboardProvider>
  );
}
