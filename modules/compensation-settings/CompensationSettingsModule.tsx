"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

import AreaTab from './components/AreaTab';
import LocationTab from './components/LocationTab';
import StaffTab from './components/StaffTab';
import VehicleTypeTab from './components/VehicleTypeTab';

export default function CompensationSettingsModule() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams?.get("tab");
    const validTabs = ["area", "location", "vehicle", "staff"];
    if (tabParam && validTabs.includes(tabParam)) {
      return tabParam;
    }
    return "area";
  });

  // Synchronize activeTab with URL 'tab' parameter
  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    const validTabs = ["area", "location", "vehicle", "staff"];
    if (tabParam && validTabs.includes(tabParam)) {
      if (tabParam !== activeTab) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(tabParam);
      }
    }
  }, [searchParams, activeTab]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6">
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Compensation Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Manage logistics compensation configurations across different categories.
          </p>
          <Separator />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6">
            <TabsTrigger value="area" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              Area
            </TabsTrigger>
            <TabsTrigger value="location" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              Location
            </TabsTrigger>
            <TabsTrigger value="vehicle" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              Vehicle Types
            </TabsTrigger>
            <TabsTrigger value="staff" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
              Staff
            </TabsTrigger>
          </TabsList>

          <Card className="border shadow-sm bg-white dark:bg-gray-900 w-full py-0">
            <CardContent className="p-6">
              <TabsContent value="area" className="mt-0">
                <AreaTab />
              </TabsContent>

              <TabsContent value="location" className="mt-0">
                <LocationTab />
              </TabsContent>

              <TabsContent value="vehicle" className="mt-0">
                <VehicleTypeTab />
              </TabsContent>

              <TabsContent value="staff" className="mt-0">
                <StaffTab />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
