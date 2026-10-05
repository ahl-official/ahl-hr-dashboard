"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { DASHBOARD_CHANNEL } from "@/lib/channel";
import {
  EmployeeSummary,
  MeetingRecord,
  DocumentRecord,
  StatusRecord,
  GlobalFiltersState,
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

export type MeetingPrefill = {
  employeeKey?: string;
  milestone?: string;
  scheduledDate?: string;
  meetingType?: MeetingType;
  warningGiven?: "Yes" | "No";
  discussionNotes?: string;
} | null;

function useDashboardState() {
  const { showToast } = useToast();

  // Primary Data State
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [statuses, setStatuses] = useState<StatusRecord[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("") // set when data loads; a clock value here would differ between server and browser;
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
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
  const [meetingPrefill, setMeetingPrefill] = useState<MeetingPrefill>(null);
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

  // Refresh when an employee is created in the onboarding tab
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(DASHBOARD_CHANNEL);
    ch.onmessage = (e) => { if (e.data?.type === "employee-created") fetchDashboardData(true); };
    return () => ch.close();
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
  // Birthdays, reviews and alerts only make sense for people still employed, even when the
  // status filter is set to "Left" or "All".
  const currentStaff = useMemo(
    () => filteredEmployees.filter((e) => e.employmentStatus === "Active"),
    [filteredEmployees]
  );
  const activeKeys = useMemo(
    () => new Set(employees.filter((e) => e.employmentStatus === "Active").map((e) => e.employeeKey)),
    [employees]
  );
  const activeMeetings = useMemo(() => meetings.filter((m) => activeKeys.has(m.employeeKey)), [meetings, activeKeys]);

  const birthdays = useMemo(() => calculateBirthdays(currentStaff, 30), [currentStaff]);
  const milestones7 = useMemo(() => calculateMilestones(currentStaff, 7), [currentStaff]);
  const milestones15 = useMemo(() => calculateMilestones(currentStaff, 15), [currentStaff]);
  const milestones30 = useMemo(() => calculateMilestones(currentStaff, 30), [currentStaff]);
  const milestonesAll = useMemo(() => calculateMilestones(currentStaff, Infinity), [currentStaff]);

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
  return {
    employees, meetings, activeMeetings, documents, statuses, lastUpdated, isLoading, isRefreshing, mobileMenuOpen, setMobileMenuOpen,
    filters, setFilters, companies, departments, genders, filteredEmployees,
    newThisMonth, averageTenure, departmentCount, companyCount,
    birthdays, milestones7, milestones15, milestones30, milestonesAll, activeCount,
    selectedEmployee, setSelectedEmployee,
    meetingModalOpen, setMeetingModalOpen, meetingPrefill, setMeetingPrefill,
    documentModalOpen, setDocumentModalOpen, documentPrefillEmployeeKey, setDocumentPrefillEmployeeKey,
    statusModalOpen, setStatusModalOpen, statusPrefillEmployeeKey, setStatusPrefillEmployeeKey,
    allBirthdaysModalOpen, setAllBirthdaysModalOpen, showAddEmployeeWizard, setShowAddEmployeeWizard,
    fetchDashboardData, handleSaveMeeting, handleUpdateMeetingStatus, handleSaveDocument, handleSaveStatus, handleEmployeeCreated,
    openMeeting: (prefill?: MeetingPrefill) => { setMeetingPrefill(prefill || null); setMeetingModalOpen(true); },
  };
}

type DashboardValue = ReturnType<typeof useDashboardState>;
const DashboardContext = createContext<DashboardValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const value = useDashboardState();
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}
