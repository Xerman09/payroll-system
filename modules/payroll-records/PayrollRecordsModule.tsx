// modules/payroll-records/PayrollRecords.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

import type { CutoffHistoryRow, Department, Employee } from "./types";
import {
  fetchEmployees,
  fetchDepartments,
  fetchCutoffs,
} from "./providers/payrollRecordsApi";
import { parseCutoffValue } from "./utils/cutoff";
import { buildPayrollSummaryPdf } from "./utils/payrollSummaryPdf";

import EmployeesTab from "./components/EmployeesTab";
import TapSheetTab from "./components/TapSheetTab";

export default function PayrollRecordsModule() {
  const [activeTab, setActiveTab] = React.useState<"employees" | "top-sheet">(
    "employees",
  );

  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [cutoffs, setCutoffs] = React.useState<CutoffHistoryRow[]>([]);
  const [selectedCutoff, setSelectedCutoff] = React.useState<string>("");
  const [deptId, setDeptId] = React.useState<number | null>(-1);
  const [loading, setLoading] = React.useState(true);
  const [generatingSummary, setGeneratingSummary] = React.useState(false);

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
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const handleDownloadSummary = async () => {
    const cutoff = parseCutoffValue(selectedCutoff);
    if (!cutoff?.start || !cutoff?.end) {
      toast.error("Please select a cutoff first.");
      return;
    }
    
    setGeneratingSummary(true);
    try {
      const res = await fetch(`/api/payroll-records?type=summary&cutoff_start=${cutoff.start}&cutoff_end=${cutoff.end}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error || "Failed to fetch summary data");

      await buildPayrollSummaryPdf({
        data: json.data,
        meta: json.meta
      });
      toast.success("Payroll Summary generated.");
    } catch (err) {
      console.error("Summary error:", err);
      toast.error("Failed to generate payroll summary: " + (err as Error).message);
    } finally {
      setGeneratingSummary(false);
    }
  };

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
              : "Generate a final Top Sheet per department and cutoff."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "top-sheet" && (
            <Button
              variant="default"
              size="lg"
              className="font-bold shadow-md"
              onClick={handleDownloadSummary}
              disabled={generatingSummary || !selectedCutoff || deptId !== -1}
            >
              {generatingSummary ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                "Payroll Summary"
              )}
            </Button>
          )}
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
              <TabsTrigger value="top-sheet">Top Sheet</TabsTrigger>
            </TabsList>

            <TabsContent value="employees" className="mt-0">
              <EmployeesTab loading={loading} employees={employees} departments={departments} />
            </TabsContent>

            <TabsContent value="top-sheet" className="mt-0">
              <TapSheetTab
                loading={loading}
                employees={employees}
                departments={departments}
                cutoffs={cutoffs}
                selectedCutoff={selectedCutoff}
                setSelectedCutoff={setSelectedCutoff}
                deptId={deptId}
                setDeptId={setDeptId}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
