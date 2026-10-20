"use client";

import React, { useState } from "react";
import RequisitionsTab from "@/components/recruitment/RequisitionsTab";

export default function RecruitmentPage() {
  return (
    <div className="space-y-6">
      {/* Recruitment & FMS Workspace */}
      <RequisitionsTab />
    </div>
  );
}
