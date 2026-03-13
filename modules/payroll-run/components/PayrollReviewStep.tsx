// modules/payroll-run/components/PayrollReviewStep.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import type {
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollWorkspace,
} from "../types";

import { formatPHP } from "../utils/compute";
import { getDepartmentLookups } from "../providers/directusMasterData";
import {
  fetchPayrollRunEmployeesForPrint,
  rowsHaveBreakdown,
} from "../providers/payslipPrintProvider";
import { downloadPayslipsPdf, buildPayslipsPdf } from "../utils/payslipPdf";
import { Eye, FileDown, Loader2, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function n(v: any): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function resolveLines(props: any): PayrollComputedLine[] {
  const direct =
    props?.lines ??
    props?.computedLines ??
    props?.computed ??
    props?.results ??
    props?.rows ??
    props?.workspace?.lines ??
    props?.workspace?.computedLines ??
    props?.workspace?.computed ??
    props?.workspace?.results ??
    props?.workspace?.employees ??
    [];

  return Array.isArray(direct) ? (direct as PayrollComputedLine[]) : [];
}

type PayrollReviewStepProps = {
  run?: PayrollRunHeader | null;
  workspace?: PayrollWorkspace | any | null;

  lines?: PayrollComputedLine[];
  computedLines?: PayrollComputedLine[];
  computed?: PayrollComputedLine[];
  results?: PayrollComputedLine[];
  rows?: PayrollComputedLine[];

  summary?: any;

  isBusy?: boolean;

  onBack?: () => void;
  onFinalize?: () => void;
  onExport?: () => void;

  onBackToAdjust?: () => void;
  onStartOver?: () => void;
  onPost?: () => Promise<void>;
};

function getRowId(r: any): string {
  return String(r?.user_id ?? r?.userId ?? r?.employeeId ?? r?.id ?? "");
}

function getRowName(r: any): string {
  return (
    r?.employee_name ??
    r?.employeeName ??
    r?.full_name ??
    r?.name ??
    (getRowId(r) ? `Employee #${getRowId(r)}` : "Employee")
  );
}

function getGross(r: any): number {
  return n(r?.gross_pay ?? r?.grossPay ?? r?.gross ?? r?.gross_amount);
}

function getDeductions(r: any): number {
  return n(
    r?.total_deductions ??
      r?.totalDeductions ??
      r?.deductions ??
      r?.deductions_total,
  );
}

function getNet(r: any): number {
  return n(r?.net_pay ?? r?.netPay ?? r?.net ?? r?.net_amount);
}

function getOnHold(r: any): boolean {
  return Boolean(r?.on_hold ?? r?.onHold);
}

function getVariancePct(r: any): number | null {
  const v =
    r?.variancePct ??
    r?.variance_pct ??
    r?.variance_percent ??
    r?.variancePercent ??
    null;

  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function getVarianceAlert(r: any): boolean {
  return Boolean(r?.varianceAlert ?? r?.variance_alert ?? r?.variance_flag);
}

function getIsProrated(r: any): boolean {
  return Boolean(r?.isProrated ?? r?.is_prorated);
}

function getProratedDetails(r: any): any | null {
  return r?.proratedDetails ?? r?.prorated_details ?? null;
}

function VarianceCell({ row }: { row: any }) {
  const pct = getVariancePct(row);

  if (pct === null) {
    return (
      <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-900">
        New Hire
      </span>
    );
  }

  const isNegative = pct < 0;
  const baseClass = getVarianceAlert(row)
    ? "font-bold text-destructive"
    : isNegative
      ? "text-destructive"
      : "text-emerald-700";

  return (
    <span className={cn("font-mono text-xs", baseClass)}>
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function ProrationDetails({ row }: { row: any }) {
  const isProrated = getIsProrated(row);
  const d = getProratedDetails(row);

  if (!isProrated || !d) return null;

  return (
    <div className="mt-2 inline-block rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] leading-5 text-blue-900">
      <div className="font-semibold">Wage Change Detected</div>
      <div>
        • {n(d.daysOnOldRate)} days @{" "}
        <span className="line-through opacity-70">
          {formatPHP(n(d.oldBasic))}
        </span>
      </div>
      <div>
        • {n(d.daysOnNewRate)} days @{" "}
        <span className="font-semibold">{formatPHP(n(d.newBasic))}</span>
      </div>
    </div>
  );
}

function payslipKeyClient(r: any): string | null {
  const primary =
    r?.id ?? r?.payroll_run_employee_id ?? r?.payrollRunEmployeeId ?? null;
  if (
    primary !== null &&
    primary !== undefined &&
    String(primary).trim() !== ""
  ) {
    return `pre:${String(primary)}`;
  }

  const run = r?.payroll_run_id ?? r?.payrollRunId ?? null;
  const user = r?.user_id ?? r?.userId ?? null;

  if (
    run !== null &&
    run !== undefined &&
    String(run).trim() !== "" &&
    user !== null &&
    user !== undefined &&
    String(user).trim() !== ""
  ) {
    return `ru:${String(run)}-${String(user)}`;
  }

  return null;
}

function dedupeRowsClient(rows: any[]) {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const k = payslipKeyClient(r);
    if (!k) {
      out.push(r);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function PayrollReviewStep(props: PayrollReviewStepProps) {
  const lines = React.useMemo(() => resolveLines(props), [props]);

  const [isPosting, setIsPosting] = React.useState(false);
  const [isPostSuccess, setIsPostSuccess] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePostPayroll = async () => {
    if (!props.onPost) return;
    try {
      setIsPosting(true);
      await props.onPost();
      setIsPosting(false);
      setIsPostSuccess(true);
      
      // Delay before proceeding (redirect/finalize)
      setTimeout(() => {
        window.scrollTo(0, 0);
        if (props.onFinalize) {
          props.onFinalize();
        } else if (props.onStartOver) {
          props.onStartOver();
        }
      }, 1500);
    } catch (e: any) {
      setIsPosting(false);
      toast.error(e?.message || "Failed to post payroll");
    }
  };

  const [deptLookups, setDeptLookups] = React.useState<{
    deptNameByDeptId: Record<string, string>;
    deptNameByUserId: Record<string, string>;
  }>({ deptNameByDeptId: {}, deptNameByUserId: {} });

  const [deptLoadError, setDeptLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const lookups = await getDepartmentLookups();
        if (!alive) return;
        setDeptLookups(lookups);
        setDeptLoadError(null);
      } catch (e: any) {
        if (!alive) return;
        setDeptLoadError(e?.message || "Failed to load department lookups");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const getDeptNameForLine = React.useCallback(
    (r: any): string | null => {
      const direct =
        r?.department_name ?? r?.departmentName ?? r?.department ?? null;
      if (typeof direct === "string" && direct.trim()) return direct;

      const deptId =
        r?.department_id ??
        r?.departmentId ??
        r?.user_department ??
        r?.userDepartment ??
        null;

      if (deptId != null) {
        const name = deptLookups.deptNameByDeptId[String(deptId)];
        if (name) return name;
      }

      const userId = r?.user_id ?? r?.userId ?? r?.employeeId ?? r?.id ?? null;
      if (userId != null) {
        const name = deptLookups.deptNameByUserId[String(userId)];
        if (name) return name;
      }

      return null;
    },
    [deptLookups.deptNameByDeptId, deptLookups.deptNameByUserId],
  );

  const displayLines = React.useMemo(() => {
    return lines.map((r: any) => {
      const dept = getDeptNameForLine(r);
      return {
        ...r,
        department_name: dept ?? r?.department_name ?? null,
        departmentName: dept ?? r?.departmentName ?? null,
      };
    });
  }, [lines, getDeptNameForLine]);

  const summary = React.useMemo(() => {
    const s = (props as any)?.summary ?? null;
    if (s && typeof s === "object") {
      return {
        count: Number.isFinite(Number(s.count))
          ? Number(s.count)
          : displayLines.length,
        totalGross: round2(
          n(s.totalGross ?? s.total_gross ?? s.total_gross_pay),
        ),
        totalDeductions: round2(
          n(s.totalDeductions ?? s.total_deductions ?? s.total_deduction),
        ),
        totalNet: round2(n(s.totalNet ?? s.total_net ?? s.total_payout)),
        onHoldCount: Number.isFinite(Number(s.onHoldCount ?? s.on_hold_count))
          ? Number(s.onHoldCount ?? s.on_hold_count)
          : displayLines.reduce((c, r: any) => c + (getOnHold(r) ? 1 : 0), 0),
        varianceFlagCount: Number.isFinite(
          Number(s.varianceFlagCount ?? s.varianceAlerts ?? s.variance_alerts),
        )
          ? Number(s.varianceFlagCount ?? s.varianceAlerts ?? s.variance_alerts)
          : displayLines.reduce(
              (c, r: any) => c + (getVarianceAlert(r) ? 1 : 0),
              0,
            ),
      };
    }

    const totalGross = round2(
      displayLines.reduce((sum, r: any) => sum + getGross(r), 0),
    );
    const totalDeductions = round2(
      displayLines.reduce((sum, r: any) => sum + getDeductions(r), 0),
    );
    const totalNet = round2(
      displayLines.reduce((sum, r: any) => sum + getNet(r), 0),
    );

    const onHoldCount = displayLines.reduce(
      (c, r: any) => c + (getOnHold(r) ? 1 : 0),
      0,
    );
    const varianceFlagCount = displayLines.reduce(
      (c, r: any) => c + (getVarianceAlert(r) ? 1 : 0),
      0,
    );

    return {
      count: displayLines.length,
      totalGross,
      totalDeductions,
      totalNet,
      onHoldCount,
      varianceFlagCount,
    };
  }, [displayLines, props]);

  const cutoffLabel =
    (props as any)?.cutoffLabel ??
    (props as any)?.run?.cutoff_label ??
    (props as any)?.run?.cutoffLabel ??
    null;

  const cutoffRange =
    (props as any)?.run?.cutoff_start && (props as any)?.run?.cutoff_end
      ? `${String((props as any).run.cutoff_start).slice(0, 10)} to ${String(
          (props as any).run.cutoff_end,
        ).slice(0, 10)}`
      : null;

  const payrollPeriodLabel =
    cutoffLabel ?? (cutoffRange ? `Cutoff: ${cutoffRange}` : "Cutoff");

  const [isPrinting, setIsPrinting] = React.useState(false);

  const runId =
    (props as any)?.run?.payroll_run_id ??
    (props as any)?.run?.payrollRunId ??
    (props as any)?.payroll_run_id ??
    (props as any)?.payrollRunId ??
    null;

  const onDownloadPayslipsPdf = React.useCallback(async () => {
    try {
      if (summary.count === 0) {
        toast.error("No payroll rows to export.");
        return;
      }

      setIsPrinting(true);

      let rowsToPrint: any[] = [...displayLines];
      let companyName: string | undefined = (props as any)?.summary?.companyName || "";

      // Ensure breakdown_json is present for itemized lists
      if (!rowsHaveBreakdown(rowsToPrint) && runId != null) {
        const res = await fetchPayrollRunEmployeesForPrint(Number(runId));
        rowsToPrint = res.rows;
        companyName = res.companyName;
      }

      if (!Array.isArray(rowsToPrint) || rowsToPrint.length === 0) {
        toast.error("No payroll rows available for exporting.");
        setIsPrinting(false);
        return;
      }

      rowsToPrint = dedupeRowsClient(rowsToPrint);

      rowsToPrint.sort((a, b) => {
        // Sort by Payment Method (Bank=1 first, Cash=0 last)
        const isCardA = n(
          a?.is_card ?? (a as any)?.isCard ?? a?.breakdown_json?.is_card ?? 0,
        );
        const isCardB = n(
          b?.is_card ?? (b as any)?.isCard ?? b?.breakdown_json?.is_card ?? 0,
        );
        if (isCardA !== isCardB) return isCardB - isCardA; // 1 -> 0

        // Then by last name
        const getSortName = (r: any) => {
          const ln = String(r?.last_name ?? "").trim();
          if (ln) return ln.toLowerCase();

          // Fallback: parse from full name if last_name is missing
          const full = String(getRowName(r)).trim();
          const parts = full.split(/\s+/);
          if (parts.length > 1) {
            // Assume the last part is the last name (simplistic but works for most cases)
            return parts[parts.length - 1].toLowerCase();
          }
          return full.toLowerCase();
        };

        const sortA = getSortName(a);
        const sortB = getSortName(b);

        if (sortA !== sortB) return sortA.localeCompare(sortB);

        // Finally by first name or full name as secondary
        return String(getRowName(a)).localeCompare(String(getRowName(b)));
      });

      const doc = await buildPayslipsPdf({
        rows: rowsToPrint,
        payrollPeriodLabel,
        pageSize: "LEGAL",
        payrollRefNo: (props as any)?.run?.payroll_ref_no,
        postedAt: (props as any)?.run?.posted_at,
        companyName,
      });

      const blob = doc.output("blob");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
      setIsPrinting(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate payslips PDF");
      setIsPrinting(false);
    }
  }, [summary.count, displayLines, runId, payrollPeriodLabel, previewUrl]);

  const backHandler = props.onBack ?? props.onBackToAdjust;
  const finalizeHandler =
    props.onFinalize ??
    (props.onPost ? () => void props.onPost?.() : undefined);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Net Pay</div>
          <div className="mt-1 text-2xl font-bold text-primary">
            {formatPHP(summary.totalNet)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {summary.count} employee(s)
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Gross Pay</div>
          <div className="mt-1 text-2xl font-bold">
            {formatPHP(summary.totalGross)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Before deductions
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-yellow-400">
          <div className="text-sm text-muted-foreground">Alerts</div>
          <div className="mt-1 text-sm">
            <span className="font-semibold">
              On hold: {summary.onHoldCount}
            </span>{" "}
            •{" "}
            <span className="font-semibold text-destructive">
              Variance flagged: {summary.varianceFlagCount}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Variance is based on previous cutoff (when available)
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">Payroll Run Review</div>
            <div className="text-xs text-muted-foreground">
              {cutoffLabel ? (
                <span>Cutoff: {cutoffLabel}</span>
              ) : cutoffRange ? (
                <span>Cutoff: {cutoffRange}</span>
              ) : (
                <span>Cutoff: (not set)</span>
              )}
            </div>
            {deptLoadError ? (
              <div className="text-xs text-destructive">
                Department join disabled: {deptLoadError}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={onDownloadPayslipsPdf}
              disabled={props.isBusy || isPrinting || summary.count === 0}
            >
              {isPrinting
                ? "Generating Preview..."
                : "Download Payslips"}
              <Eye className="ml-2 h-4 w-4" />
            </Button>

            {props.onExport ? (
              <Button
                variant="secondary"
                onClick={props.onExport}
                disabled={props.isBusy || summary.count === 0}
              >
                Export
              </Button>
            ) : null}

            {props.onStartOver ? (
              <Button
                variant="outline"
                onClick={props.onStartOver}
                disabled={props.isBusy}
              >
                Start Over
              </Button>
            ) : null}

            {backHandler ? (
              <Button
                variant="outline"
                onClick={backHandler}
                disabled={props.isBusy}
              >
                Back
              </Button>
            ) : null}

            {finalizeHandler ? (
              <Button
                onClick={handlePostPayroll}
                disabled={props.isBusy || summary.count === 0 || isPostSuccess || isPosting}
                className={props.onPost ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
              >
                {isPosting ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Posting...
                   </>
                ) : props.onPost ? "Post Payroll" : "Finalize"}
              </Button>
            ) : null}
          </div>
        </div>

        <Separator className="my-4" />

        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pb-2">
            <CardTitle className="text-base">Employees</CardTitle>
          </CardHeader>

          <CardContent className="px-0 pt-0">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayLines.map((row: any) => {
                    const id =
                      getRowId(row) || Math.random().toString(16).slice(2);
                    const name = getRowName(row);
                    const dept =
                      row?.department_name ?? row?.departmentName ?? null;

                    const gross = getGross(row);
                    const ded = getDeductions(row);
                    const net = getNet(row);

                    const onHold = getOnHold(row);

                    return (
                      <TableRow key={String(id)}>
                        <TableCell className="align-top">
                          <div className="font-semibold">{name}</div>
                          <ProrationDetails row={row} />
                        </TableCell>

                        <TableCell className="align-top">
                          <div className="text-sm">
                            {dept ? (
                              dept
                            ) : (
                              <span className="text-muted-foreground">
                                (unknown)
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-mono text-sm">
                          {formatPHP(gross)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-sm text-destructive">
                          ({formatPHP(ded)})
                        </TableCell>

                        <TableCell className="text-right font-mono text-sm font-bold">
                          {formatPHP(net)}
                        </TableCell>

                        <TableCell className="text-right">
                          <VarianceCell row={row} />
                        </TableCell>

                        <TableCell className="text-center">
                          {onHold ? (
                            <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-900">
                              On hold
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                              Ready
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {displayLines.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No computed payroll lines found for this run.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              Tip: Variance compares Net Pay against the previous cutoff when
              available.
            </div>
          </CardContent>
        </Card>
      </Card>

      <Dialog open={isPosting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" showCloseButton={false}>
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
              </div>
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-bold tracking-tight">Posting Payroll</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Finalizing the register and archiving this payroll run.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPostSuccess} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" showCloseButton={false}>
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <div className="relative">
               <div className="rounded-full bg-green-100 p-4">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
               </div>
               <div className="absolute -top-1 -right-1">
                  <div className="h-4 w-4 animate-ping rounded-full bg-green-400 opacity-75" />
               </div>
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-bold text-green-700 tracking-tight">Payroll Posted!</DialogTitle>
              <p className="text-sm text-muted-foreground">
                The register is now locked. Redirecting to workspace...
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
               <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-green-500 animate-[loading-bar_1.5s_ease-in-out]" />
               </div>
               Please wait
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={previewOpen} 
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open && previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="w-full max-w-[95vw] sm:max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="pl-6 pr-12 py-4 border-b bg-background">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-lg">Payslips PDF Preview</DialogTitle>
                <div className="text-xs text-muted-foreground">
                  Review the generated payslips before downloading.
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <Button variant="default" size="sm" asChild>
                    <a href={previewUrl} download="Payslips-Legal.pdf">
                      <FileDown className="mr-2 h-4 w-4" />
                      Download PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-muted/20 w-full h-full relative">
            {previewUrl ? (
              <iframe
                title="Payslips PDF Preview"
                src={`${previewUrl}#toolbar=0&view=FitH`}
                className="w-full h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No preview available.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PayrollReviewStep;
