"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Shell } from "@/components/layout/Shell";
import { Header } from "@/components/layout/Header";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { OverviewKPIs } from "@/components/dashboard/OverviewKPIs";
import { CelebrationsAndReviews } from "@/components/dashboard/CelebrationsAndReviews";
import { HRRecordsSection } from "@/components/dashboard/HRRecordsSection";
import { WorkforceInsights } from "@/components/dashboard/WorkforceInsights";
import { DataReadinessPanel } from "@/components/dashboard/DataReadinessPanel";
import { EmployeeDirectory } from "@/components/dashboard/EmployeeDirectory";
import { EmployeeProfileDrawer } from "@/components/drawers/EmployeeProfileDrawer";
import { MeetingModal } from "@/components/modals/MeetingModal";
import { DocumentModal } from "@/components/modals/DocumentModal";
import { StatusModal } from "@/components/modals/StatusModal";
import { AllBirthdaysModal } from "@/components/modals/AllBirthdaysModal";
import { AddEmployeeWizard } from "@/components/onboarding/AddEmployeeWizard";
import { HRCalendarView } from "@/components/calendar/HRCalendarView";
import { ActionAlertsBanner } from "@/components/dashboard/ActionAlertsBanner";
import { useToast } from "@/components/ui/Toast";
import {
  EmployeeSummary,
  MeetingRecord,
  DocumentRecord,
  StatusRecord,
  GlobalFiltersState,
  BirthdayEvent,
  ReviewEvent,
  MeetingType,
} from "@/types";
import {
  calculateBirthdays,
  calculateMilestones,
  formatAverageTenure,
  daysBetween,
  parseIsoDate,
  startOfDay,
} from "@/lib/date-utils";

export default function DashboardPage() {
  const { showToast } = useToast();

  // Primary Data State
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [statuses, setStatuses] = useState<StatusRecord[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Global Filters State
  const [filters, setFilters] = useState<GlobalFiltersState>({
    search: "",
    company: "",
    department: "",
    gender: "",
    employmentStatus: "Active", // Default Active
  });

  // Modal & Drawer States
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState<boolean>(false);
  const [meetingPrefill, setMeetingPrefill] = useState<{
    employeeKey?: string;
    milestone?: string;
    scheduledDate?: string;
    meetingType?: MeetingType;
    warningGiven?: "Yes" | "No";
    discussionNotes?: string;
  } | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState<boolean>(false);
  const [documentPrefillEmployeeKey, setDocumentPrefillEmployeeKey] = useState<string>("");
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [statusPrefillEmployeeKey, setStatusPrefillEmployeeKey] = useState<string>("");
  const [allBirthdaysModalOpen, setAllBirthdaysModalOpen] = useState<boolean>(false);
  const [showAddEmployeeWizard, setShowAddEmployeeWizard] = useState<boolean>(false);

  // Fetch Dashboard Data from API
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load dashboard data");

      setEmployees(data.employees || []);
      setMeetings(data.meetings || []);
      setDocuments(data.documents || []);
      setStatuses(data.statuses || []);
      setLastUpdated(data.generatedAt || new Date().toISOString());

      if (isRefresh) {
        showToast("Dashboard records refreshed successfully", "success");
      }
    } catch (err: any) {
      showToast(err.message || "Could not reach dashboard API", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Derived Filter Dropdown Options
  const companies = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.company).filter(Boolean))).sort();
  }, [employees]);

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort();
  }, [employees]);

  const genders = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.gender).filter(Boolean))).sort();
  }, [employees]);

  // Filter Employees
  const filteredEmployees = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return employees.filter((emp) => {
      const searchable = [
        emp.fullName,
        emp.employeeId,
        emp.designation,
        emp.department,
        emp.company,
        emp.manager,
        emp.mobile,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesCompany = !filters.company || emp.company === filters.company;
      const matchesDept = !filters.department || emp.department === filters.department;
      const matchesGender = !filters.gender || emp.gender === filters.gender;
      const matchesStatus =
        !filters.employmentStatus || emp.employmentStatus === filters.employmentStatus;

      return matchesSearch && matchesCompany && matchesDept && matchesGender && matchesStatus;
    });
  }, [employees, filters]);

  // KPI Calculations
  const today = useMemo(() => startOfDay(new Date()), []);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const newThisMonth = useMemo(() => {
    return filteredEmployees.filter((emp) => {
      const d = parseIsoDate(emp.doj);
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
  }, [filteredEmployees, currentMonth, currentYear]);

  const averageTenure = useMemo(() => {
    const tenureDays = filteredEmployees
      .map((emp) => {
        const doj = parseIsoDate(emp.doj);
        return doj ? Math.max(0, daysBetween(doj, today)) : null;
      })
      .filter((v): v is number => v !== null);

    const avg = tenureDays.length
      ? tenureDays.reduce((sum, d) => sum + d, 0) / tenureDays.length
      : 0;
    return formatAverageTenure(avg);
  }, [filteredEmployees, today]);

  const departmentCount = useMemo(() => {
    return new Set(filteredEmployees.map((e) => e.department).filter(Boolean)).size;
  }, [filteredEmployees]);

  const companyCount = useMemo(() => {
    return new Set(filteredEmployees.map((e) => e.company).filter(Boolean)).size;
  }, [filteredEmployees]);

  // Milestone and Birthday Calculations
  const birthdays = useMemo(() => calculateBirthdays(filteredEmployees, 30), [filteredEmployees]);
  const milestones7 = useMemo(() => calculateMilestones(filteredEmployees, 7), [filteredEmployees]);
  const milestones15 = useMemo(() => calculateMilestones(filteredEmployees, 15), [filteredEmployees]);
  const milestones30 = useMemo(() => calculateMilestones(filteredEmployees, 30), [filteredEmployees]);
  const milestonesAll = useMemo(() => calculateMilestones(filteredEmployees, Infinity), [filteredEmployees]);

  // Active records count
  const activeCount = useMemo(() => {
    return employees.filter((e) => e.employmentStatus === "Active").length;
  }, [employees]);

  // Handlers for Mutations
  const handleSaveMeeting = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save meeting");

      setMeetings((prev) => [data.data, ...prev.filter((m) => m.meetingId !== data.data.meetingId)]);
      showToast("Meeting record saved successfully", "success");
      return true;
    } catch (err: any) {
      showToast(err.message || "Failed to record meeting", "error");
      return false;
    }
  };

  const handleUpdateMeetingStatus = async (
    meetingId: string,
    status: "Open" | "Completed" | "Cancelled"
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, recordStatus: status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to update meeting status");

      setMeetings((prev) =>
        prev.map((m) => (m.meetingId === meetingId ? data.data : m))
      );
      showToast(`Action item marked as ${status}`, "success");
      return true;
    } catch (err: any) {
      showToast(err.message || "Failed to update action status", "error");
      return false;
    }
  };

  const handleSaveDocument = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save document");

      setDocuments((prev) => [data.data, ...prev.filter((d) => d.documentId !== data.data.documentId)]);
      showToast("Document saved and verified", "success");
      return true;
    } catch (err: any) {
      showToast(err.message || "Failed to save document", "error");
      return false;
    }
  };

  const handleSaveStatus = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/employees/${payload.employeeKey}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to update status");

      // Update statuses list
      setStatuses((prev) => [data.data, ...prev.filter((s) => s.employeeKey !== payload.employeeKey)]);

      // Update employee directly in state
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.employeeKey === payload.employeeKey
            ? { ...emp, employmentStatus: payload.employmentStatus, statusRecord: data.data }
            : emp
        )
      );

      if (selectedEmployee && selectedEmployee.employeeKey === payload.employeeKey) {
        setSelectedEmployee((prev) => (prev ? { ...prev, employmentStatus: payload.employmentStatus } : null));
      }

      showToast(`Status updated to ${payload.employmentStatus}`, "success");
      return true;
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "error");
      return false;
    }
  };

  const handleEmployeeCreated = (newEmp: EmployeeSummary) => {
    setEmployees((prev) => [newEmp, ...prev]);
    showToast(`New employee ${newEmp.fullName} created!`, "success");
  };

  const handleNavigation = (sectionId: string) => {
    if (sectionId === "add-employee") {
      setShowAddEmployeeWizard(true);
      setActiveSection("add-employee");
      return;
    }

    setShowAddEmployeeWizard(false);
    setActiveSection(sectionId);

    // Ensure DOM has mounted before scrolling
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  // Dynamic Scroll-Spy: updates sidebar active tab as user scrolls through sections
  useEffect(() => {
    if (showAddEmployeeWizard || isLoading) return;

    const sectionIds = ["overview", "calendar", "celebrations", "records", "insights", "directory"];
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible && visible.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [showAddEmployeeWizard, isLoading]);

  return (
    <Shell
      activeSection={activeSection}
      onNavigate={handleNavigation}
      mobileMenuOpen={mobileMenuOpen}
      onCloseMobileMenu={() => setMobileMenuOpen(false)}
      employeeCount={employees.length}
      activeCount={activeCount}
      recordsCount={meetings.length}
      reviewCount={milestones30.length}
    >
      <Header
        lastUpdated={lastUpdated}
        onRefresh={() => fetchDashboardData(true)}
        isRefreshing={isRefreshing}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenAddEmployee={() => setShowAddEmployeeWizard(true)}
      />

      <main className="p-4 sm:p-8 max-w-7xl mx-auto w-full flex-1">
        {showAddEmployeeWizard ? (
          <AddEmployeeWizard
            onEmployeeCreated={handleEmployeeCreated}
            onCancel={() => setShowAddEmployeeWizard(false)}
          />
        ) : (
          <>
            {/* Global Multi-Attribute Filter Bar */}
            <GlobalFilters
              filters={filters}
              onChange={setFilters}
              onClear={() =>
                setFilters({
                  search: "",
                  company: "",
                  department: "",
                  gender: "",
                  employmentStatus: "Active",
                })
              }
              companies={companies}
              departments={departments}
              genders={genders}
              filteredCount={filteredEmployees.length}
              totalCount={employees.length}
            />

            {/* Urgent HR Action Reminders & Overdue Alerts */}
            <ActionAlertsBanner
              meetings={meetings}
              employees={employees}
              onUpdateMeetingStatus={handleUpdateMeetingStatus}
              onSelectEmployee={(emp) => setSelectedEmployee(emp)}
            />

            {/* 1. Overview KPIs Section */}
            <section id="overview" className="scroll-mt-24">
              <OverviewKPIs
                totalEmployees={filteredEmployees.length}
                newThisMonth={newThisMonth}
                averageTenure={averageTenure}
                departmentCount={departmentCount}
                companyCount={companyCount}
                birthdayCount={birthdays.length}
                milestoneCount={milestones30.length}
              />
            </section>

            {/* 2. Interactive HR Calendar (Google Calendar Style) */}
            <HRCalendarView
              employees={filteredEmployees}
              meetings={meetings}
              birthdays={birthdays}
              milestones={milestonesAll}
              onOpenRecordMeeting={(prefill) => {
                setMeetingPrefill(prefill || null);
                setMeetingModalOpen(true);
              }}
              onSelectEmployee={(emp) => setSelectedEmployee(emp)}
            />

            {/* 3. Celebrations & Reviews Section */}
            <section id="celebrations" className="scroll-mt-24">
              <CelebrationsAndReviews
                birthdays={birthdays}
                milestones7={milestones7}
                milestones15={milestones15}
                milestones30={milestones30}
                milestonesAll={milestonesAll}
                onOpenRecordMeeting={(prefill) => {
                  setMeetingPrefill(prefill);
                  setMeetingModalOpen(true);
                }}
                onOpenAllBirthdays={() => setAllBirthdaysModalOpen(true)}
              />
            </section>

            {/* 3. HR Records Section */}
            <HRRecordsSection
              meetings={meetings}
              onOpenAddMeeting={() => {
                setMeetingPrefill(null);
                setMeetingModalOpen(true);
              }}
            />

            {/* 4. Workforce Insights Charts */}
            <WorkforceInsights employees={filteredEmployees} />

            {/* 5. Master Data Quality & Readiness Panel */}
            <DataReadinessPanel
              employees={filteredEmployees}
              allEmployees={employees}
            />

            {/* 6. Employee Directory */}
            <EmployeeDirectory
              employees={filteredEmployees}
              meetings={meetings}
              onSelectEmployee={(emp) => setSelectedEmployee(emp)}
            />
          </>
        )}
      </main>

      {/* Profile Slide-Over Drawer */}
      <EmployeeProfileDrawer
        employee={selectedEmployee}
        documents={documents}
        meetings={meetings}
        onClose={() => setSelectedEmployee(null)}
        onOpenMeeting={(empKey, prefill) => {
          setSelectedEmployee(null);
          setMeetingPrefill({
            employeeKey: empKey,
            meetingType: prefill?.meetingType || "General",
            ...prefill,
          });
          setMeetingModalOpen(true);
        }}
        onOpenDocument={(empKey) => {
          setSelectedEmployee(null);
          setDocumentPrefillEmployeeKey(empKey);
          setDocumentModalOpen(true);
        }}
        onOpenStatus={(empKey) => {
          setSelectedEmployee(null);
          setStatusPrefillEmployeeKey(empKey);
          setStatusModalOpen(true);
        }}
      />

      {/* Record Meeting Modal */}
      <MeetingModal
        isOpen={meetingModalOpen}
        onClose={() => {
          setMeetingModalOpen(false);
          setMeetingPrefill(null);
        }}
        employees={employees}
        prefill={meetingPrefill}
        onSave={handleSaveMeeting}
      />

      {/* Document Upload & Verification Modal */}
      <DocumentModal
        isOpen={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        employees={employees}
        prefillEmployeeKey={documentPrefillEmployeeKey}
        onSave={handleSaveDocument}
      />

      {/* Employment Status Modal */}
      <StatusModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        employees={employees}
        prefillEmployeeKey={statusPrefillEmployeeKey}
        onSave={handleSaveStatus}
      />

      {/* All Birthdays Modal */}
      <AllBirthdaysModal
        isOpen={allBirthdaysModalOpen}
        onClose={() => setAllBirthdaysModalOpen(false)}
        birthdays={birthdays}
      />
    </Shell>
  );
}
