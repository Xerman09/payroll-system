"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Search, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import EmployeeDetailsSheet from "@/modules/payroll-run/components/EmployeeDetailsSheet";
import type { PayrollComputedLine } from "@/modules/payroll-run/types";
import { format, parseISO } from "date-fns";
import PasswordDialog from "@/modules/payroll-run/components/PasswordDialog";
import * as api from "@/modules/payroll-run/providers/payrollApi";
import { getLoggedUser } from "@/lib/auth";
import { toast } from "sonner";

type OnHoldPayroll = {
  id: number;
  payroll_run_id: number;
  user_id: number;
  employee_name: string;
  position: string;
  department_name: string;
  basic_pay: number;
  total_additions: number;
  total_deductions: number;
  gross_pay: number;
  net_pay: number;
  cutoff_start: string;
  cutoff_end: string;
  run_status: string;
  cutoff_period: string;
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return format(parseISO(dateStr), "MMM dd, yyyy");
  } catch {
    return dateStr;
  }
}

export default function OnHoldPayrollReportModule() {
  const [data, setData] = useState<OnHoldPayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedCutoff, setSelectedCutoff] = useState("all");

  const [selectedItem, setSelectedItem] = useState<PayrollComputedLine | null>(null);

  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(true);

  useEffect(() => {
    if (!passwordVerified) return;
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("/api/reports/on-hold-payroll");
        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error || "Failed to fetch data");
        }
        
        setData(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [passwordVerified]);

  const handlePasswordSubmit = async (passwordInput: string) => {
    try {
      const logged = getLoggedUser();
      if (!logged) {
        toast.error("User not logged in.");
        return;
      }

      await api.verifyPassword(Number(logged.user_id), passwordInput);
      
      setPasswordVerified(true);
      setPasswordDialogOpen(false);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Error verifying password. Try again.");
    }
  };

  const departments = useMemo(() => {
    const depts = new Set(data.map((d) => d.department_name));
    return Array.from(depts).sort();
  }, [data]);

  const cutoffs = useMemo(() => {
    const cutoffSet = new Set(data.map((d) => d.cutoff_period));
    // Sort descending ideally, but alphabetical is fine since it starts with YYYY-MM-DD
    return Array.from(cutoffSet).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch =
        item.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cutoff_period.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchDept = selectedDept === "all" || item.department_name === selectedDept;
      const matchCutoff = selectedCutoff === "all" || item.cutoff_period === selectedCutoff;

      return matchSearch && matchDept && matchCutoff;
    });
  }, [data, searchTerm, selectedDept, selectedCutoff]);

  if (!passwordVerified) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center p-6">
        <PasswordDialog
          open={passwordDialogOpen}
          onOpenChange={(open) => setPasswordDialogOpen(open)}
          onSubmit={handlePasswordSubmit}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-red-500">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">On-Hold Payroll Report</h1>
          <p className="text-muted-foreground">
            Employees whose payroll is currently on hold and not yet processed.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employee or cutoff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              
              <Select value={selectedCutoff} onValueChange={setSelectedCutoff}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Cutoff Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cutoffs</SelectItem>
                  {cutoffs.map((cutoff) => (
                    <SelectItem key={cutoff} value={cutoff}>
                      {cutoff.split(" to ").map(d => formatDate(d)).join(" - ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-4 py-3">Employee Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Cutoff Period</th>
                  <th className="px-4 py-3 text-right">Gross Pay</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-center">Payroll Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-32 text-center text-muted-foreground">
                      No on-hold payroll records found.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{row.employee_name}</td>
                      <td className="px-4 py-3">{row.department_name}</td>
                      <td className="px-4 py-3">
                        {formatDate(row.cutoff_start)} - {formatDate(row.cutoff_end)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                        {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(row.gross_pay)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(row.net_pay)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">
                          {row.run_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedItem(row as unknown as PayrollComputedLine)}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <EmployeeDetailsSheet
        open={!!selectedItem}
        line={selectedItem}
        manualEntries={[]}
        isPosted={true}
        onOpenChange={(v) => !v && setSelectedItem(null)}
        onEditEntry={() => {}}
        onDeleteEntry={() => {}}
      />
    </div>
  );
}
