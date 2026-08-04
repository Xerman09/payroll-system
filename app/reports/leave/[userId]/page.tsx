import React from "react";
import LeaveReportModule from "@/modules/reports/leave/LeaveReportModule";
import DashboardLayout from "@/components/layout/DashboardLayout";

export const metadata = {
  title: "Leave Report",
};

export default function LeaveReportPage() {
  return (
    <DashboardLayout>
      <LeaveReportModule />
    </DashboardLayout>
  );
}
