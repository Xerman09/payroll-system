import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollReportModule from "@/modules/reports/payroll/PayrollReportModule";

export default function PayrollReportPage() {
  return (
    <DashboardLayout>
      <PayrollReportModule />
    </DashboardLayout>
  );
}
