"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileSearch,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  Calendar,
  Users,
  Building2,
  AlertTriangle,
  Search,
  Clock,
  CheckCheck,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { getLoggedUser } from "@/lib/auth";
import * as svc from "@/modules/payroll-run/providers/payrollRunService";
import * as api from "@/modules/payroll-run/providers/payrollApi";
import { Department, PayrollRunHeader } from "@/modules/payroll-run/types";
import { PayrollReviewStep } from "@/modules/payroll-run/components/PayrollReviewStep";

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const parsed = typeof dateStr === "string" && dateStr.length === 10 ? parseISO(dateStr) : new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return format(parsed, "MMM dd, yyyy");
  } catch {
    return dateStr;
  }
}

function formatPhp(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = String(status || "").toUpperCase();

  if (s === "PENDING_APPROVER") {
    return (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 font-medium">
        <Clock className="mr-1 h-3 w-3" /> Pending Approver
      </Badge>
    );
  }
  if (s === "POSTED" || s === "APPROVED") {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-medium">
        <CheckCheck className="mr-1 h-3 w-3" /> {s === "POSTED" ? "Posted" : "Approved"}
      </Badge>
    );
  }
  if (s === "REJECTED") {
    return (
      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-medium">
        <XCircle className="mr-1 h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium">
      {status || "—"}
    </Badge>
  );
}

export default function PayrollApprovalsModule() {
  const [runs, setRuns] = useState<PayrollRunHeader[]>([]);
  const [historyRuns, setHistoryRuns] = useState<PayrollRunHeader[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Review mode
  const [selectedRun, setSelectedRun] = useState<PayrollRunHeader | null>(null);
  const [computedLines, setComputedLines] = useState<any[]>([]);
  const [computedSummary, setComputedSummary] = useState<any>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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

      // 1. Fetch user roles from settings & load departments concurrently
      let checker = false;
      let approver = false;

      const [settingsRes, deptList] = await Promise.all([
        fetch("/api/payroll-settings").catch(() => null),
        svc.listDepartments().catch(() => [] as Department[]),
      ]);

      if (settingsRes && settingsRes.ok) {
        const json = await settingsRes.json();
        const settings = Array.isArray(json.data) ? json.data[0] : json.data;
        if (settings && loggedUser?.user_id) {
          checker = Number(settings.checker_id) === Number(loggedUser.user_id);
          approver = Number(settings.approver_id) === Number(loggedUser.user_id);
        }
      }

      setIsChecker(checker);
      setIsApprover(approver);
      setDepartments(deptList || []);

      if (!approver) {
        setRuns([]);
        setHistoryRuns([]);
        setLoading(false);
        return;
      }

      // 2. Fetch pending and history runs
      const [pendingRows, historyRows] = await Promise.all([
        api.listItems<PayrollRunHeader>("payroll_run", {
          "filter[status][_in]": "PENDING_APPROVER",
          sort: "-payroll_run_id",
        }),
        api.listItems<PayrollRunHeader>("payroll_run", {
          "filter[status][_in]": "POSTED,APPROVED,REJECTED",
          sort: "-payroll_run_id",
          limit: 100,
        }),
      ]);

      setRuns(pendingRows || []);
      setHistoryRuns(historyRows || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load approval queue.");
    } finally {
      setLoading(false);
    }
  }

  const deptMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of departments) {
      if (d.id != null) map.set(Number(d.id), d.name);
    }
    return map;
  }, [departments]);

  function getDepartmentName(deptId?: number | null): string {
    if (deptId == null) return "All Departments";
    return deptMap.get(Number(deptId)) || `Department #${deptId}`;
  }

  // Filtered rows for current tab
  const activeList = activeTab === "pending" ? runs : historyRuns;

  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter((r) => {
      const refMatch = String(r.payroll_ref_no || "").toLowerCase().includes(q);
      const deptName = getDepartmentName(r.department_id).toLowerCase();
      const deptMatch = deptName.includes(q);
      const statusMatch = String(r.status || "").toLowerCase().includes(q);
      return refMatch || deptMatch || statusMatch;
    });
  }, [activeList, searchQuery, deptMap]);

  // High-level queue metrics
  const totalPendingAmount = useMemo(() => {
    return runs.reduce((sum, r) => sum + Number(r.total_net || 0), 0);
  }, [runs]);

  const totalPendingHeadcount = useMemo(() => {
    return runs.reduce((sum, r) => sum + Number(r.headcount || 0), 0);
  }, [runs]);

  async function loadRunDetails(run: PayrollRunHeader) {
    setSelectedRun(run);
    setLoadingRun(true);
    try {
      const lines = await svc.loadPersistedLines(run.payroll_run_id);
      setComputedLines(lines);

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
    if (!selectedRun || !loggedUser || isPosting) return;
    try {
      setIsPosting(true);
      await svc.postRun({
        payrollRunId: selectedRun.payroll_run_id,
        postedBy: Number(loggedUser.user_id),
        userName: [loggedUser.user_fname, loggedUser.user_lname].filter(Boolean).join(" "),
      });
      toast.success("Payroll run successfully posted!");
      setSelectedRun(null);
      fetchQueue();
    } catch (e: any) {
      toast.error(e.message || "Failed to post run");
    } finally {
      setIsPosting(false);
    }
  }

  function handleReject() {
    if (!selectedRun || !loggedUser) return;
    setRejectReason("");
    setRejectModalOpen(true);
  }

  async function confirmReject() {
    if (!selectedRun || !loggedUser || isRejecting) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }

    try {
      setIsRejecting(true);
      await svc.rejectRun({
        payrollRunId: selectedRun.payroll_run_id,
        rejectedBy: Number(loggedUser.user_id),
        remarks: rejectReason.trim(),
        userName: [loggedUser.user_fname, loggedUser.user_lname].filter(Boolean).join(" "),
      });
      toast.success("Payroll run rejected back to Draft.");
      setRejectModalOpen(false);
      setSelectedRun(null);
      fetchQueue();
    } catch (e: any) {
      toast.error(e.message || "Failed to reject run");
    } finally {
      setIsRejecting(false);
    }
  }

  // --- Render Single Run Review View ---
  if (selectedRun) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedRun(null)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Queue
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-mono tracking-tight">{selectedRun.payroll_ref_no}</h2>
                  <StatusBadge status={selectedRun.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span>Period: {formatDateSafe(selectedRun.cutoff_start)} — {formatDateSafe(selectedRun.cutoff_end)}</span>
                  <span>•</span>
                  <span>Dept: {getDepartmentName(selectedRun.department_id)}</span>
                </p>
                {selectedRun.remarks && (
                  <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 max-w-2xl whitespace-pre-wrap">
                    <span className="font-semibold">History / Remarks: </span>
                    {selectedRun.remarks}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button variant="destructive" size="sm" onClick={handleReject} disabled={isPosting}>
                <XCircle className="mr-1.5 h-4 w-4" /> Reject
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleVerify}
                disabled={isPosting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {isPosting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Posting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Post &amp; Finalize
                  </>
                )}
              </Button>
            </div>
          </div>

          <Card className="p-4 sm:p-6 shadow-sm border rounded-2xl bg-white dark:bg-gray-900">
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

          <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-rose-600">
                  <ShieldAlert className="h-5 w-5" /> Reject Payroll Run
                </DialogTitle>
                <DialogDescription>
                  Please provide a detailed reason for rejecting this payroll run. It will return to Draft status for revision.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Specify the reason or discrepancies observed..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="mt-2"
              />
              <DialogFooter className="gap-2 sm:gap-0 mt-4">
                <Button variant="outline" onClick={() => setRejectModalOpen(false)} disabled={isRejecting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmReject} disabled={isRejecting}>
                  {isRejecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting...
                    </>
                  ) : (
                    "Confirm Rejection"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // --- Render Queue / List View ---
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Payroll Approvals
              </h1>
              <Badge variant="secondary" className="font-semibold text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Approver Desk
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Final executive review, deduction authorization, and posting of verified payroll runs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4 mr-1.5" />} Refresh
            </Button>
          </div>
        </div>

        {!isApprover && !loading && (
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Approver Role Not Assigned</div>
              You are currently not designated as an Approver in the system settings. You can browse past processed runs in History, but cannot post pending runs.
            </div>
          </div>
        )}

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{runs.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Awaiting executive sign-off</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                <Clock className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Authorized Headcount</p>
                <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{totalPendingHeadcount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Employees to disburse</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                <Users className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Disbursement Amount</p>
                <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100 font-mono">
                  {formatPhp(totalPendingAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total payout appropriation</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation & Search Bar */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList className="bg-slate-100 dark:bg-gray-800/80 p-1 rounded-xl">
              <TabsTrigger value="pending" className="rounded-lg text-xs sm:text-sm font-medium">
                Pending Approval ({runs.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg text-xs sm:text-sm font-medium">
                History &amp; Archive ({historyRuns.length})
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ref no, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm rounded-xl bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800"
              />
            </div>
          </div>

          <TabsContent value="pending" className="mt-0">
            <ApprovalQueueTable
              loading={loading}
              runs={filteredRuns}
              getDepartmentName={getDepartmentName}
              onReview={loadRunDetails}
              emptyMessage={
                searchQuery
                  ? "No payroll runs awaiting approval match your search."
                  : "All caught up! There are no payroll runs awaiting executive sign-off."
              }
              actionLabel="Review & Post"
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <ApprovalQueueTable
              loading={loading}
              runs={filteredRuns}
              getDepartmentName={getDepartmentName}
              onReview={loadRunDetails}
              emptyMessage={
                searchQuery
                  ? "No historical payroll runs match your search."
                  : "No historical payroll runs found in the archive."
              }
              actionLabel="View Details"
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Sub-component for rendering clean tables
function ApprovalQueueTable({
  loading,
  runs,
  getDepartmentName,
  onReview,
  emptyMessage,
  actionLabel,
}: {
  loading: boolean;
  runs: PayrollRunHeader[];
  getDepartmentName: (id?: number | null) => string;
  onReview: (run: PayrollRunHeader) => void;
  emptyMessage: string;
  actionLabel: string;
}) {
  if (loading) {
    return (
      <Card className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-gray-800/50">
            <TableRow className="border-b border-slate-200 dark:border-gray-800">
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Reference No</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Cutoff Period</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Department</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Status</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 text-center">Headcount</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 text-right">Net Payout</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 text-center">Alerts</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              runs.map((r) => {
                const alertsCount = Number(r.variance_alert_count || 0);
                return (
                  <TableRow
                    key={r.payroll_run_id}
                    className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 transition-colors border-b border-slate-100 dark:border-gray-800/60"
                  >
                    <TableCell className="font-mono font-medium text-xs text-slate-900 dark:text-slate-100 py-3.5">
                      {r.payroll_ref_no || `RUN-#${r.payroll_run_id}`}
                    </TableCell>

                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {formatDateSafe(r.cutoff_start)} — {formatDateSafe(r.cutoff_end)}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[150px]">{getDepartmentName(r.department_id)}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>

                    <TableCell className="text-xs text-center font-medium">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {Number(r.headcount || 0)}
                      </span>
                    </TableCell>

                    <TableCell className="text-right font-mono font-semibold text-xs text-slate-900 dark:text-slate-100">
                      {formatPhp(r.total_net)}
                    </TableCell>

                    <TableCell className="text-center">
                      {alertsCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-mono">
                          {alertsCount} {alertsCount === 1 ? "Alert" : "Alerts"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onReview(r)}
                        className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                      >
                        <FileSearch className="mr-1.5 h-3.5 w-3.5" />
                        {actionLabel}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
