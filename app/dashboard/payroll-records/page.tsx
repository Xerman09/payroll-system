// app/dashboard/payroll-records/page.tsx
import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollRecordsModule from "@/modules/payroll-records/PayrollRecordsModule";

export default function PayrollRecordsPage() {
  return (
    <DashboardLayout>
      <PayrollRecordsModule />
    </DashboardLayout>
  );
}
