import { Metadata } from "next";
import CompensationSettingsModule from "@/modules/compensation-settings/CompensationSettingsModule";

export const metadata: Metadata = {
  title: "Logistics Compensation Settings | Payroll System",
};

export default function CompensationSettingsPage() {
  return <CompensationSettingsModule />;
}
