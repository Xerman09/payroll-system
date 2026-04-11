// modules/benefit-settings/components/BenefitLogsTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { RefreshCcw, FileDown, Sigma } from "lucide-react";

import type {
  BenefitCode,
  BenefitLogRow,
  CutoffSetting,
  UserData,
  Department,
} from "../types";
import {
  fetchBenefitLogs,
  fetchCutoffSettings,
  fetchCompanyConfig,
  formatMoney,
} from "../providers/benefitApi";
import type {
  BenefitLogsPaperSize,
} from "../utils/benefitLogsPdf";
import { BenefitTableSkeleton } from "./BenefitSettingsSkeleton";
import BenefitExportPreviewDialog from "./BenefitExportPreviewDialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function userName(users: UserData[], userId: number) {
  const u = users.find((x) => x.user_id === userId);
  return u ? `${u.user_fname} ${u.user_lname}`.trim() : `User #${userId}`;
}

export default function BenefitLogsTab({
  users,
  departments,
}: {
  users: UserData[];
  departments: Department[];
}) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [companyName, setCompanyName] = React.useState("MEN2 MARKETING CORPORATION");

  const [cutoffs, setCutoffs] = React.useState<CutoffSetting[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cutoffMap = React.useMemo(
    () => new Map(cutoffs.map((c) => [c.id, c] as const)),
    [cutoffs]
  );

  const [rows, setRows] = React.useState<BenefitLogRow[]>([]);

  // Filters
  const [q, setQ] = React.useState("");
  const [cutoffRange, setCutoffRange] = React.useState<string>("ALL");
  const [benefit, setBenefit] = React.useState<BenefitCode | "ALL">("ALL");
  const [type, setType] = React.useState<"ALL" | "CONTRIBUTION" | "LOAN">(
    "ALL"
  );
  const [department, setDepartment] = React.useState<"ALL" | number>("ALL");

  // Build a userId → department_id lookup from the users list
  const userDeptMap = React.useMemo(() => {
    const m = new Map<number, number | null>();
    for (const u of users) m.set(u.user_id, u.user_department ?? null);
    return m;
  }, [users]);

  // Export
  const [paper, setPaper] = React.useState<BenefitLogsPaperSize>("LETTER");

  // Summary modal
  const [summaryOpen, setSummaryOpen] = React.useState(false);

  // Export Preview
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [c, l, config] = await Promise.all([
        fetchCutoffSettings(),
        fetchBenefitLogs(),
        fetchCompanyConfig(),
      ]);
      setCutoffs(c);
      setRows(l);
      if (config?.companyName) {
        setCompanyName(config.companyName);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load benefit logs.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const l = await fetchBenefitLogs();
      setRows(l);
      toast.success("Logs refreshed.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to refresh logs.";
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (cutoffRange !== "ALL") {
        if (cutoffRange === "UNKNOWN") {
          if (r.cutoff_start || r.cutoff_end) return false;
        } else {
          const key = `${r.cutoff_start}_${r.cutoff_end}`;
          if (key !== cutoffRange) return false;
        }
      }
      if (benefit !== "ALL" && r.benefit_code !== benefit) return false;
      if (type !== "ALL" && r.log_type !== type) return false;
      if (department !== "ALL") {
        const userDept = userDeptMap.get(r.user_id);
        if (userDept !== department) return false;
      }

      if (!needle) return true;
      const name = (r.employee_name || userName(users, r.user_id)).toLowerCase();
      const account = (r.account_no ?? "").toLowerCase();
      const payrollId = (r.payroll_ref_no ?? "").toLowerCase();
      const note = (r.note ?? "").toLowerCase();

      return (
        name.includes(needle) ||
        account.includes(needle) ||
        payrollId.includes(needle) ||
        note.includes(needle) ||
        String(r.user_id).includes(needle)
      );
    });
  }, [rows, q, cutoffRange, benefit, type, department, userDeptMap, users]);

  const totals = React.useMemo(() => {
    const sumBy: Record<string, number> = {
      SSS: 0,
      PAGIBIG: 0,
      PHILHEALTH: 0,
      ALL: 0,
    };
    for (const r of filtered) {
      sumBy[r.benefit_code] =
        (sumBy[r.benefit_code] || 0) + (r.deducted_amount || 0);
      sumBy.ALL += r.deducted_amount || 0;
    }
    return sumBy;
  }, [filtered]);

  const onOpenExportPreview = React.useCallback(() => {
    if (rows.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    setPreviewOpen(true);
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Filters row (modern alignment) */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          {/* Left: Filters */}
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-gray-400">Search</div>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Employee or note…"
                className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-gray-400">Department</div>
              <Select
                value={String(department)}
                onValueChange={(v) => setDepartment(v === "ALL" ? "ALL" : Number(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.department_id} value={String(d.department_id)}>
                      {d.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-gray-400">Cutoff</div>
              <Select value={cutoffRange} onValueChange={setCutoffRange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {(() => {
                    const uniqueRanges = new Map<string, string>();
                    const fmt = (dStr: string) => {
                      const d = new Date(dStr);
                      if (Number.isNaN(d.getTime())) return dStr;
                      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
                    };
                    
                    for (const r of rows) {
                      if (r.cutoff_start && r.cutoff_end) {
                        const key = `${r.cutoff_start}_${r.cutoff_end}`;
                        if (!uniqueRanges.has(key)) {
                          uniqueRanges.set(key, `${fmt(r.cutoff_start)} – ${fmt(r.cutoff_end)}`);
                        }
                      } else {
                        uniqueRanges.set("UNKNOWN", "Unknown Cutoff");
                      }
                    }

                    // Sort ranges descending by explicit date bounds
                    const sortedRanges = Array.from(uniqueRanges.entries()).sort((a, b) => b[0].localeCompare(a[0]));

                    return sortedRanges.map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-gray-400">Benefit</div>
              <Select
                value={benefit}
                onValueChange={(v) => setBenefit(v as BenefitCode | "ALL")}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="SSS">SSS</SelectItem>
                  <SelectItem value="PAGIBIG">PAGIBIG</SelectItem>
                  <SelectItem value="PHILHEALTH">PHILHEALTH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-gray-400">Type</div>
              <Select value={type} onValueChange={(v) => setType(v as "ALL" | "CONTRIBUTION" | "LOAN")}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="CONTRIBUTION">Contribution</SelectItem>
                  <SelectItem value="LOAN">Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right: Summary + export controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setSummaryOpen(true)}
            >
              <Sigma className="mr-2 h-4 w-4" />
              Summary totals
            </Button>

            <div className="min-w-[180px] space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-gray-400">
                Paper size
              </div>
              <Select
                value={paper}
                onValueChange={(v) => setPaper(v as BenefitLogsPaperSize)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LETTER">Letter</SelectItem>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="LEGAL">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="h-9"
              onClick={onOpenExportPreview}
              disabled={loading || rows.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>

            <Button
              variant="outline"
              className="h-9"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-gray-800/50">
              <TableHead>Employee</TableHead>
              <TableHead>Account #</TableHead>
              <TableHead className="text-right">Deducted</TableHead>
              <TableHead>Payroll ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Posted Date</TableHead>
              <TableHead>Benefit</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <BenefitTableSkeleton columns={8} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-slate-500"
                >
                  No logs found. (Logs appear after payroll run posting.)
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const postedDate = r.posted_at
                  ? new Date(r.posted_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })
                  : "—";

                return (
                  <TableRow
                    key={r.benefit_log_id}
                    className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 border-b dark:border-gray-800"
                  >
                    <TableCell className="font-medium dark:text-gray-200">
                      {r.employee_name || userName(users, r.user_id)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600 dark:text-gray-400">
                      {r.account_no || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-slate-900 dark:text-gray-100">
                      {formatMoney(r.deducted_amount)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-primary dark:text-primary/70">
                      {r.payroll_ref_no || "—"}
                    </TableCell>
                    <TableCell>
                      {r.log_type === "LOAN" ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"
                        >
                          Loan
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary/70 border-primary/20 dark:border-blue-900/40"
                        >
                          Contribution
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 dark:text-gray-400">
                      {postedDate}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] uppercase bg-slate-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                      >
                        {r.benefit_code}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Totals Modal */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-md dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle>Summary totals</DialogTitle>
            <DialogDescription>
              Totals reflect the current filters and search result.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
                    SSS
                  </Badge>
                  <span className="text-sm text-slate-600 dark:text-gray-400">Deducted</span>
                </div>
                <div className="tabular-nums font-semibold">
                  {formatMoney(totals.SSS)}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
                    PAGIBIG
                  </Badge>
                  <span className="text-sm text-slate-600 dark:text-gray-400">Deducted</span>
                </div>
                <div className="tabular-nums font-semibold">
                  {formatMoney(totals.PAGIBIG)}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300">
                    PH
                  </Badge>
                  <span className="text-sm text-slate-600 dark:text-gray-400">Deducted</span>
                </div>
                <div className="tabular-nums font-semibold">
                  {formatMoney(totals.PHILHEALTH)}
                </div>
              </div>

              <div className="mt-3 border-t dark:border-gray-800 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold dark:text-gray-200">Total</span>
                <span className="tabular-nums text-base font-bold dark:text-gray-100">
                  {formatMoney(totals.ALL)}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-gray-400">
              Rows included:{" "}
              <span className="font-medium text-slate-700 dark:text-gray-300">
                {filtered.length}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Preview */}
      <BenefitExportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        allRows={rows}
        users={users}
        departments={departments}
        initialCutoffRange={cutoffRange}
        initialBenefit={benefit}
        initialType={type}
        initialDepartment={department}
        initialPaper={paper}
        companyName={companyName}
      />
    </div>
  );
}
