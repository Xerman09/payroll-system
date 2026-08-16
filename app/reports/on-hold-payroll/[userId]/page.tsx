import DashboardLayout from "@/components/layout/DashboardLayout";
import OnHoldPayrollReportModule from "@/modules/reports/on-hold-payroll/OnHoldPayrollReportModule";

export default function OnHoldPayrollReportPage() {
  return (
    <DashboardLayout>
      <OnHoldPayrollReportModule />
    </DashboardLayout>
  );
}
