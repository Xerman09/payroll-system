import ThirteenthMonthModule from "@/modules/thirteenth-month";

export const metadata = {
  title: "13th Month Pay Management | HR & Payroll",
  description: "Calculate and disburse 13th month compensation based on working days and attendance",
};

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolved = await params;
  return <ThirteenthMonthModule initialUserId={resolved?.userId} />;
}
