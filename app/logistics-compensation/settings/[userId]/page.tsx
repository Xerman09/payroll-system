import { Metadata } from "next";
import CompensationSettingsModule from "@/modules/compensation-settings/CompensationSettingsModule";

export const metadata: Metadata = {
  title: "Logistics Compensation Settings | HR and Payroll System",
};

export default function CompensationSettingsPage() {
  return <CompensationSettingsModule />;
}
