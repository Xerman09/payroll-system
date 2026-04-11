import { ProfileModule } from "@/modules/profile/ProfileModule";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default async function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return (
    <DashboardLayout>
      <ProfileModule userId={userId === "me" ? "me" : userId} />
    </DashboardLayout>
  );
}
