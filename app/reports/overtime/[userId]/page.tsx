import React from "react";
import OvertimeReportModule from "@/modules/reports/overtime/OvertimeReportModule";
import DashboardLayout from "@/components/layout/DashboardLayout";

export const metadata = {
  title: "Overtime Report",
};

export default function OvertimeReportPage() {
  return (
    <DashboardLayout>
      <OvertimeReportModule />
    </DashboardLayout>
  );
}
