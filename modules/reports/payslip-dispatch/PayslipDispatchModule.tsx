"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Search, Filter, Send, MailCheck } from "lucide-react";
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
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import PasswordDialog from "@/modules/payroll-run/components/PasswordDialog";
import * as api from "@/modules/payroll-run/providers/payrollApi";
import { getLoggedUser } from "@/lib/auth";

type PayslipEmployee = {
  id: number;
  payroll_run_id: number;
  user_id: number;
  employee_name: string;
  position: string;
  department_name: string;
  department_name_snapshot?: string;
  basic_pay: number;
  gross_pay: number;
  net_pay: number;
  cutoff_start: string;
  cutoff_end: string;
  cutoff_period: string;
  is_payslip_sent: number | boolean | null;
  payslip_sent_at: string | null;
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return format(parseISO(dateStr), "MMM dd, yyyy");
  } catch {
    return dateStr;
  }
}

export default function PayslipDispatchModule() {
  const [data, setData] = useState<PayslipEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedCutoff, setSelectedCutoff] = useState("all");

  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!passwordVerified) return;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/reports/payslip-dispatch");
        if (!res.ok) {
          throw new Error("Failed to fetch processed payroll data");
        }
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch (err: any) {
        setError(err.message);
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

  const handleSendEmail = async (empIds: number[]) => {
    if (empIds.length === 0) return;
    try {
      setSending(true);
      const res = await fetch("/api/reports/payslip-dispatch/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empIds, sentBy: getLoggedUser()?.user_id })
      });
      const json = await res.json();
      
      if (!res.ok) {
        toast.error(json.error || "Failed to send emails");
        return;
      }

      const successful = json.results?.filter((r: any) => r.success).length || 0;
      const failed = json.results?.filter((r: any) => !r.success) || [];

      if (successful > 0) {
        toast.success(`Successfully sent ${successful} emails.`);
      }

      if (failed.length > 0) {
        // Show the first error as an example
        toast.error(`${failed.length} emails failed to send. Error: ${failed[0].error}`);
      }
      
      // Update local state to show sent
      setData(prev => prev.map(emp => {
        const result = json.results?.find((r: any) => r.id === emp.id);
        if (result && result.success) {
          return { ...emp, is_payslip_sent: 1, payslip_sent_at: new Date().toISOString() };
        }
        return emp;
      }));

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const departments = useMemo(() => {
    const deptSet = new Set<string>();
    data.forEach((d) => {
      const dept = d.department_name || d.department_name_snapshot;
      if (dept) deptSet.add(dept);
    });
    return Array.from(deptSet).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const cutoffs = useMemo(() => {
    const cutoffSet = new Set(data.map((d) => d.cutoff_period));
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
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payslip Dispatch</h1>
          <p className="text-muted-foreground">
            Send processed payslips to employee corporate emails
          </p>
        </div>
        
        <Button 
          onClick={() => handleSendEmail(filteredData.filter(d => !d.is_payslip_sent).map(d => d.id))}
          disabled={loading || sending || filteredData.filter(d => !d.is_payslip_sent).length === 0}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Bulk Send Unsent ({filteredData.filter(d => !d.is_payslip_sent).length})
        </Button>
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b p-4 md:flex-row md:items-center md:justify-between bg-muted/20">
            <div className="flex items-center gap-2 w-full md:w-96">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employee name or cutoff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full bg-background"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              
              <Select value={selectedCutoff} onValueChange={setSelectedCutoff}>
                <SelectTrigger className="w-[220px]">
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

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Employee</th>
                  <th className="px-4 py-3 text-left font-medium">Department</th>
                  <th className="px-4 py-3 text-left font-medium">Cutoff Period</th>
                  <th className="px-4 py-3 text-right font-medium">Net Pay</th>
                  <th className="px-4 py-3 text-center font-medium">Email Status</th>
                  <th className="px-4 py-3 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-32 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-32 text-center text-muted-foreground">
                      No processed payroll found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{row.employee_name}</div>
                        <div className="text-xs text-muted-foreground">{row.position}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.department_name || row.department_name_snapshot || "Unknown Department"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(row.cutoff_start)} - {formatDate(row.cutoff_end)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(row.net_pay)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.is_payslip_sent ? (
                          <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                            <MailCheck className="h-3 w-3" />
                            Sent
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600">
                            Unsent
                          </div>
                        )}
                        {row.payslip_sent_at && (
                           <div className="text-[10px] text-muted-foreground mt-0.5">
                              {format(parseISO(row.payslip_sent_at), "MMM d, p")}
                           </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendEmail([row.id])}
                          disabled={sending}
                          title={row.is_payslip_sent ? "Resend" : "Send"}
                        >
                          {row.is_payslip_sent ? "Resend" : "Send"}
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
    </div>
  );
}
