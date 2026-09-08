// modules/benefit-settings/BenefitSettingsModule.tsx
"use client";

import * as React from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGeneralSetting } from "./providers/benefitApi";
import PrivateBenefitSettingsModule from "./PrivateBenefitSettingsModule";
import GovernmentBenefitSettingsModule from "./government/GovernmentBenefitSettingsModule";

export default function BenefitSettingsModule() {
  const [industryLoading, setIndustryLoading] = React.useState(true);
  const [industry, setIndustry] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    async function checkIndustry() {
      try {
        const val = await fetchGeneralSetting("payroll_industry");
        if (active) {
          setIndustry(val ? val.trim() : null);
        }
      } catch (err) {
        console.error("Failed to check payroll industry setting:", err);
      } finally {
        if (active) {
          setIndustryLoading(false);
        }
      }
    }

    checkIndustry();

    return () => {
      active = false;
    };
  }, []);

  if (industryLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 p-2">
          <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // If payroll_industry is 'Government', hide the current module and render the new Government Benefit Management Module
  const isGovernment = industry?.toLowerCase() === "government";

  if (isGovernment) {
    return <GovernmentBenefitSettingsModule />;
  }

  return <PrivateBenefitSettingsModule />;
}
