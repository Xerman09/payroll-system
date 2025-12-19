"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SavingsTab from "./components/SavingsTab";
import LoansTab from "./components/LoansTab";

export default function CoopModule() {
  const [activeTab, setActiveTab] = useState("savings");

  return (
    <div className="p-6">
      <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <CardHeader>
          <CardTitle>COOP Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger
                value="savings"
                className="data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white"
              >
                Savings
              </TabsTrigger>
              <TabsTrigger
                value="loans"
                className="data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white"
              >
                Loans
              </TabsTrigger>
            </TabsList>

            <TabsContent value="savings">
              <SavingsTab />
            </TabsContent>

            <TabsContent value="loans">
              <LoansTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
