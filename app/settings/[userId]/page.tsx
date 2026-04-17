import { SettingsModule } from "@/modules/settings/SettingsModule";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default async function SettingsPage() {
  return (
    <DashboardLayout>
      <SettingsModule />
    </DashboardLayout>
  );
}
