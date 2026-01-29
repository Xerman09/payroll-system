// modules/payroll-records/PayrollRecords.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import type { CutoffHistoryRow, Department, Employee } from "./types";
import {
  fetchEmployees,
  fetchDepartments,
  fetchCutoffs,
} from "./providers/payrollRecordsApi";

import EmployeesTab from "./components/EmployeesTab";
import TapSheetTab from "./components/TapSheetTab";

export default function PayrollRecords() {
  const [activeTab, setActiveTab] = React.useState<"employees" | "tap-sheet">(
    "employees",
  );

  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [cutoffs, setCutoffs] = React.useState<CutoffHistoryRow[]>([]);

  React.useEffect(() => {
    const run = async () => {
      try {
        const [emps, depts, cuts] = await Promise.all([
          fetchEmployees(),
          fetchDepartments(),
          fetchCutoffs(),
        ]);

        // remove deleted employees
        const activeEmployees = emps.filter((e) => !e.is_deleted?.data?.[0]);

        setEmployees(activeEmployees);
        setDepartments(depts);
        setCutoffs(cuts);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load payroll records data.");
      }
    };
    run();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Payroll Records
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab === "employees"
              ? "Manage employee records and payroll information."
              : "Generate a final Tap Sheet per department and cutoff."}
          </p>
        </div>
      </div>

      <Separator />

      <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <CardContent className="p-6 space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={(v: any) => setActiveTab(v)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="tap-sheet">Tap Sheet</TabsTrigger>
            </TabsList>

            <TabsContent value="employees" className="mt-0">
              <EmployeesTab employees={employees} departments={departments} />
            </TabsContent>

            <TabsContent value="tap-sheet" className="mt-0">
              <TapSheetTab
                employees={employees}
                departments={departments}
                cutoffs={cutoffs}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
