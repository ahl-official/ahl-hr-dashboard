"use client";

import { useDashboard } from "@/context/DashboardContext";
import { ActionAlertsBanner } from "@/components/dashboard/ActionAlertsBanner";
import { OverviewKPIs } from "@/components/dashboard/OverviewKPIs";
import { CelebrationsAndReviews } from "@/components/dashboard/CelebrationsAndReviews";
import { EmployeeDirectory } from "@/components/dashboard/EmployeeDirectory";

export default function OverviewPage() {
  const d = useDashboard();
  return (
    <>
      <ActionAlertsBanner
        meetings={d.activeMeetings}
        employees={d.employees}
        onUpdateMeetingStatus={d.handleUpdateMeetingStatus}
        onSelectEmployee={d.setSelectedEmployee}
      />
      <OverviewKPIs
        totalEmployees={d.filteredEmployees.length}
        newThisMonth={d.newThisMonth}
        averageTenure={d.averageTenure}
        departmentCount={d.departmentCount}
        companyCount={d.companyCount}
        birthdayCount={d.birthdays.length}
        milestoneCount={d.milestones30.length}
      />
      <CelebrationsAndReviews
        birthdays={d.birthdays}
        milestones7={d.milestones7}
        milestones15={d.milestones15}
        milestones30={d.milestones30}
        milestonesAll={d.milestonesAll}
        onOpenRecordMeeting={(prefill) => d.openMeeting(prefill)}
        onOpenAllBirthdays={() => d.setAllBirthdaysModalOpen(true)}
      />
      <EmployeeDirectory employees={d.filteredEmployees} meetings={d.activeMeetings} onSelectEmployee={d.setSelectedEmployee} />
    </>
  );
}
