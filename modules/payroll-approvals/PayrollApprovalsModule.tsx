"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FileSearch, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

import { getLoggedUser } from "@/lib/auth";
import * as svc from "@/modules/payroll-run/providers/payrollRunService";
import * as api from "@/modules/payroll-run/providers/payrollApi";
import { PayrollRunHeader } from "@/modules/payroll-run/types";
import { PayrollReviewStep } from "@/modules/payroll-run/components/PayrollReviewStep";

// Minimal local status styling
function statusBadge(status: string) {
  if (status === "PENDING_CHECKER") {
    return <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-semibold">Pending Checker</span>;
  }
  if (status === "PENDING_APPROVER") {
    return <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-xs font-semibold">Pending Approver</span>;
  }
  return <span className="rounded-full bg-gray-100 text-gray-800 px-2.5 py-0.5 text-xs font-semibold">{status}</span>;
}

export default function PayrollApprovalsModule() {
  const [runs, setRuns] = useState<PayrollRunHeader[]>([]);
  const [loading, setLoading] = useState(true);

  // Review mode
  const [selectedRun, setSelectedRun] = useState<PayrollRunHeader | null>(null);
  const [computedLines, setComputedLines] = useState<any[]>([]);
  const [computedSummary, setComputedSummary] = useState<any>(null);
  const [loadingRun, setLoadingRun] = useState(false);

  // User role details
  const [isChecker, setIsChecker] = useState(false);
  const [isApprover, setIsApprover] = useState(false);

  const loggedUser = getLoggedUser();

  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchQueue() {
    try {
      setLoading(true);

      // 1. Fetch user roles from settings
      let checker = false;
      let approver = false;
      
      const res = await fetch("/api/payroll-settings");
      if (res.ok) {
        const json = await res.json();
        const settings = Array.isArray(json.data) ? json.data[0] : json.data;
        if (settings && loggedUser?.user_id) {
          checker = Number(settings.checker_id) === Number(loggedUser.user_id);
          approver = Number(settings.approver_id) === Number(loggedUser.user_id);
        }
      }
      
      setIsChecker(checker);
      setIsApprover(approver);

      // 2. Fetch pending runs based on role
      const allowedStatuses: string[] = [];
      if (checker) allowedStatuses.push("PENDING_CHECKER");
      if (approver) allowedStatuses.push("PENDING_APPROVER");

      if (allowedStatuses.length === 0) {
        setRuns([]);
        setLoading(false);
        return;
      }

      const rows = await api.listItems<PayrollRunHeader>("payroll_run", {
        "filter[status][_in]": allowedStatuses.join(","),
        sort: "-payroll_run_id",
      });
      setRuns(rows || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load approval queue.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRunDetails(run: PayrollRunHeader) {
    setSelectedRun(run);
    setLoadingRun(true);
    try {
      // Load computed lines and summary for review
      const lines = await svc.loadPersistedLines(run.payroll_run_id);
      setComputedLines(lines);

      // Summary is derived from the header
      setComputedSummary({
        headcount: run.headcount,
        total_gross: run.total_gross,
        total_deductions: run.total_deductions,
        total_net: run.total_net,
        alerts: run.variance_alert_count,
      });

    } catch (e: any) {
      toast.error(e.message || "Failed to load run details");
      setSelectedRun(null);
    } finally {
      setLoadingRun(false);
    }
  }

  async function handleVerify() {
    if (!selectedRun || !loggedUser) return;
    try {
      await svc.verifyRun({
        payrollRunId: selectedRun.payroll_run_id,
        verifiedBy: Number(loggedUser.user_id),
      });
      toast.success("Payroll run verified and sent to Approver.");
      setSelectedRun(null);
      fetchQueue();
    } catch (e: any) {
      toast.error(e.message || "Failed to verify run");
    }
  }

  async function handleReject() {
    if (!selectedRun || !loggedUser) return;
    const reason = window.prompt("Reason for rejection:");
    if (!reason) return; // cancelled or empty

    try {
      await svc.rejectRun({
        payrollRunId: selectedRun.payroll_run_id,
        rejectedBy: Number(loggedUser.user_id),
        remarks: reason,
      });
      toast.success("Payroll run rejected back to Draft.");
      setSelectedRun(null);
      fetchQueue();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject run");
    }
  }

  // --- Render logic ---

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // If viewing a specific run
  if (selectedRun) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedRun(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Queue
            </Button>
            <div>
              <h2 className="text-xl font-bold">Review Payroll: {selectedRun.payroll_ref_no}</h2>
              <p className="text-sm text-muted-foreground">Cutoff: {selectedRun.cutoff_start} to {selectedRun.cutoff_end}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="destructive" onClick={handleReject}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button variant="default" onClick={handleVerify} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Verify
              </Button>
            </div>
          </div>

          <Card className="p-4 sm:p-6 shadow-sm border rounded-2xl">
            {loadingRun ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <PayrollReviewStep
                run={selectedRun}
                rows={computedLines}
                summary={computedSummary}
                onBackToAdjust={() => setSelectedRun(null)}
                onStartOver={() => setSelectedRun(null)}
              />
            )}
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // List view
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Payroll Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and verify pending payroll runs.
          </p>
          {!isChecker && !isApprover && (
            <div className="mt-4 p-4 border rounded-lg bg-yellow-50 text-yellow-800">
              You are not assigned as a Checker or Approver in the system settings.
            </div>
          )}
        </div>

        <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
              <TableRow>
                <TableHead>Ref No</TableHead>
                <TableHead>Cutoff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No pending payroll runs in your queue.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((r) => (
                  <TableRow key={r.payroll_run_id}>
                    <TableCell className="font-medium">{r.payroll_ref_no}</TableCell>
                    <TableCell>
                      {r.cutoff_start} to {r.cutoff_end}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.total_net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => loadRunDetails(r)}>
                        <FileSearch className="mr-2 h-4 w-4" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
