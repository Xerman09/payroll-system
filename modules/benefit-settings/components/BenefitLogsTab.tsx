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
} from "../types";
import {
  fetchBenefitLogs,
  fetchCutoffSettings,
  cutoffLabel,
  formatMoney,
} from "../providers/benefitApi";
import {
  exportBenefitLogsPdf,
  type BenefitLogsPaperSize,
} from "./benefitLogsPdf";
import { BenefitTableSkeleton } from "./BenefitSettingsSkeleton";

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

export default function BenefitLogsTab({ users }: { users: UserData[] }) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const [cutoffs, setCutoffs] = React.useState<CutoffSetting[]>([]);
  const cutoffMap = React.useMemo(
    () => new Map(cutoffs.map((c) => [c.id, c] as const)),
    [cutoffs]
  );

  const [rows, setRows] = React.useState<BenefitLogRow[]>([]);

  // Filters
  const [q, setQ] = React.useState("");
  const [cutoffId, setCutoffId] = React.useState<string>("ALL");
  const [benefit, setBenefit] = React.useState<BenefitCode | "ALL">("ALL");
  const [type, setType] = React.useState<"ALL" | "CONTRIBUTION" | "LOAN">(
    "ALL"
  );

  // Export
  const [paper, setPaper] = React.useState<BenefitLogsPaperSize>("LETTER");

  // Summary modal
  const [summaryOpen, setSummaryOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        fetchCutoffSettings(),
        fetchBenefitLogs(),
      ]);
      setCutoffs(c);
      setRows(l);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load benefit logs.");
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
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to refresh logs.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (cutoffId !== "ALL" && String(r.cutoff_id) !== cutoffId) return false;
      if (benefit !== "ALL" && r.benefit_code !== benefit) return false;
      if (type !== "ALL" && r.log_type !== type) return false;

      if (!needle) return true;
      const name = userName(users, r.user_id).toLowerCase();
      const note = (r.note ?? "").toLowerCase();
      return (
        name.includes(needle) ||
        note.includes(needle) ||
        String(r.user_id).includes(needle)
      );
    });
  }, [rows, q, cutoffId, benefit, type, users]);

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

  const onExportPdf = React.useCallback(async () => {
    if (filtered.length === 0) {
      toast.error("No rows to export (check filters).");
      return;
    }

    setExporting(true);
    try {
      await exportBenefitLogsPdf({
        paper,
        companyName: "Vertex Technology Corps.",
        title: "Benefit Logs (Deduction Report)",
        users,
        cutoffs,
        cutoffId,
        benefit,
        type,
        search: q,
        rows: filtered, // IMPORTANT: already filtered
      });
      toast.success("PDF exported.");
    } catch (e: any) {
      // Most common failure is missing deps.
      const msg = e?.message ?? "Failed to export PDF.";
      toast.error(
        msg.includes("Cannot find module")
          ? "Missing PDF deps. Install: jspdf + jspdf-autotable"
          : msg
      );
    } finally {
      setExporting(false);
    }
  }, [filtered, paper, users, cutoffs, cutoffId, benefit, type, q]);

  return (
    <div className="space-y-4">
      {/* Filters row (modern alignment) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          {/* Left: Filters */}
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600">Search</div>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Employee or note…"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600">Cutoff</div>
              <Select value={cutoffId} onValueChange={setCutoffId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {cutoffs.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {cutoffLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600">Benefit</div>
              <Select
                value={benefit}
                onValueChange={(v) => setBenefit(v as any)}
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
              <div className="text-xs font-medium text-slate-600">Type</div>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
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
              <div className="text-xs font-medium text-slate-600">
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
              onClick={onExportPdf}
              disabled={exporting || loading || filtered.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {exporting ? "Exporting…" : "Export PDF"}
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
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Employee</TableHead>
              <TableHead>Cutoff</TableHead>
              <TableHead>Benefit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Source</TableHead>
              <TableHead className="text-right">Deducted</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead>Note</TableHead>
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
                const c = cutoffMap.get(r.cutoff_id);
                return (
                  <TableRow
                    key={r.benefit_log_id}
                    className="hover:bg-slate-50/60"
                  >
                    <TableCell className="font-medium">
                      {userName(users, r.user_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c ? cutoffLabel(c) : `Cutoff #${r.cutoff_id}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px]"
                      >
                        {r.benefit_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.log_type === "LOAN" ? (
                        <Badge variant="secondary">Loan</Badge>
                      ) : (
                        <Badge variant="outline">Contribution</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.source_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatMoney(r.deducted_amount)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      PR#{r.payroll_run_id}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {r.note || "—"}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Summary totals</DialogTitle>
            <DialogDescription>
              Totals reflect the current filters and search result.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    SSS
                  </Badge>
                  <span className="text-sm text-slate-600">Deducted</span>
                </div>
                <div className="tabular-nums font-semibold">
                  {formatMoney(totals.SSS)}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    PAGIBIG
                  </Badge>
                  <span className="text-sm text-slate-600">Deducted</span>
                </div>
                <div className="tabular-nums font-semibold">
                  {formatMoney(totals.PAGIBIG)}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    PH
                  </Badge>
                  <span className="text-sm text-slate-600">Deducted</span>
                </div>
                <div className="tabular-nums font-semibold">
                  {formatMoney(totals.PHILHEALTH)}
                </div>
              </div>

              <div className="mt-3 border-t pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="tabular-nums text-base font-bold">
                  {formatMoney(totals.ALL)}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Rows included:{" "}
              <span className="font-medium text-slate-700">
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
    </div>
  );
}
