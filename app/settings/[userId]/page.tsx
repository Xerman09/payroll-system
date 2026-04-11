import { SettingsModule } from "@/modules/settings/SettingsModule";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default async function SettingsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return (
    <DashboardLayout>
      <SettingsModule />
    </DashboardLayout>
  );
}
