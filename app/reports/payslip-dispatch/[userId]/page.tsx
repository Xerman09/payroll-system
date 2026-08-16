import React from "react";
import PayslipDispatchModule from "@/modules/reports/payslip-dispatch/PayslipDispatchModule";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function PayslipDispatchPage() {
  return (
    <DashboardLayout>
      <PayslipDispatchModule />
    </DashboardLayout>
  );
}
