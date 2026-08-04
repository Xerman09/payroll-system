import React from "react";
import UndertimeReportModule from "@/modules/reports/undertime/UndertimeReportModule";
import DashboardLayout from "@/components/layout/DashboardLayout";

export const metadata = {
  title: "Undertime Report",
};

export default function UndertimeReportPage() {
  return (
    <DashboardLayout>
      <UndertimeReportModule />
    </DashboardLayout>
  );
}
