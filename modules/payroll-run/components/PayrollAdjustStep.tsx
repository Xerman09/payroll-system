// modules/payroll-run/components/PayrollAdjustStep.tsx
"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  CutoffSetting,
  Department,
  ManualEntry,
  ManualEntryType,
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollSummary,
} from "../types";
import { formatPHP } from "../utils/payroll";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { EmployeeDetailsSheet } from "./EmployeeDetailsSheet";
import { ManualAdjustmentDialog } from "./ManualAdjustmentDialog";
import { AddEmployeeAdjustmentsDialog } from "./AddEmployeeAdjustmentsDialog";

function miniLine(label: string, value: string) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <span className="truncate">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function upper(v: any): string {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function isDRPaymentEntry(e: ManualEntry) {
  return String((e as any).category ?? "").toUpperCase() === "DR_PAYMENT";
}

function extractDrReceiptNo(desc: string): string {
  const s = String(desc ?? "").trim();
  return s.replace(/^DR\s*PAYMENT\s*:\s*/i, "").trim();
}

export type OtherDeductionType = "SHORTAGE" | "MANUAL";

export function PayrollAdjustStep({
  cutoff,
  department,
  run,
  lines,
  summary,
  holdMap,
  manualEntriesMap,
  onToggleHold,
  onCreateManualEntry,
  onUpdateManualEntry,
  onDeleteManualEntry,

  onCreateDrPayment,
  onUpdateDrPayment,
  onDeleteDrPayment,

  onCreateOtherDeduction,

  onRecompute,
  onNext,
}: {
  cutoff: CutoffSetting;
  department: Department | null;
  run: PayrollRunHeader | null;
  lines: PayrollComputedLine[];
  summary: PayrollSummary;
  holdMap: Map<number, boolean>;
  manualEntriesMap: Map<number, ManualEntry[]>;

  onCreateManualEntry: (args: {
    userId: number;
    type: ManualEntryType;
    desc: string;
    amount: number;
  }) => Promise<void>;
  onUpdateManualEntry: (args: {
    userId: number;
    entryId: number;
    type: ManualEntryType;
    desc: string;
    amount: number;
  }) => Promise<void>;
  onDeleteManualEntry: (args: {
    userId: number;
    entryId: number;
    type: ManualEntryType;
  }) => Promise<void>;

  onCreateDrPayment: (args: {
    userId: number;
    desc: string;
    amount: number;
  }) => Promise<void>;

  // ✅ NEW
  onUpdateDrPayment: (args: {
    userId: number;
    entryId: number;
    drReceiptNo: string;
    amount: number;
  }) => Promise<void>;
  onDeleteDrPayment: (args: {
    userId: number;
    entryId: number;
  }) => Promise<void>;

  onCreateOtherDeduction: (args: {
    userId: number;
    type: OtherDeductionType;
    desc: string;
    amount: number;
    cutoffStart: string;
    cutoffEnd: string;
  }) => Promise<void>;

  onToggleHold: (userId: number) => void;
  onRecompute: () => void;
  onNext: () => void;
}) {
  const [q, setQ] = useState("");
  const [activeUserId, setActiveUserId] = useState<number | null>(null);

  const [adjustUserId, setAdjustUserId] = useState<number | null>(null);
  const [adjustDefaultType, setAdjustDefaultType] =
    useState<ManualEntryType>("EARNING");

  const [editEntry, setEditEntry] = useState<ManualEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<ManualEntry | null>(null);

  const [editIsDr, setEditIsDr] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return lines;
    return lines.filter((l) => l.employee_name.toLowerCase().includes(s));
  }, [q, lines]);

  const activeLine = useMemo(
    () =>
      activeUserId == null
        ? null
        : (lines.find((l) => l.user_id === activeUserId) ?? null),
    [activeUserId, lines],
  );

  const activeManualEntries = useMemo(() => {
    if (activeUserId == null) return [];
    return manualEntriesMap.get(activeUserId) ?? [];
  }, [activeUserId, manualEntriesMap]);

  const adjustLine = useMemo(() => {
    if (adjustUserId == null) return null;
    return lines.find((l) => l.user_id === adjustUserId) ?? null;
  }, [adjustUserId, lines]);

  function openAdjust(userId: number, def: ManualEntryType = "EARNING") {
    setAdjustUserId(userId);
    setAdjustDefaultType(def);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Preview & Adjustments</CardTitle>
          <CardDescription>
            Cutoff: {cutoff.start_date} → {cutoff.end_date} (
            {cutoff.cutoff_type}) • Dept: {department?.name ?? "ALL"}
          </CardDescription>

          {run ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Ref: <span className="font-mono">{run.payroll_ref_no}</span> •
              Status: <span className="font-semibold">{run.status}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            Add Employee Adjustments
          </Button>
          <Button onClick={onNext}>Process & Save →</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Headcount
            </div>
            <div className="mt-1 text-2xl font-bold">{summary.headcount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Gross
            </div>
            <div className="mt-1 text-xl font-bold text-primary">
              {formatPHP(summary.total_gross)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Deductions
            </div>
            <div className="mt-1 text-xl font-bold text-destructive">
              {formatPHP(summary.total_deductions)}
            </div>
          </Card>
          <Card className="border-l-4 border-l-yellow-400 p-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Variance Alerts
            </div>
            <div className="mt-1 text-xl font-bold">
              {summary.variance_alerts}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee..."
            className="max-w-sm"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground sm:justify-end">
            <div>
              Showing <span className="font-medium">{filtered.length}</span> of{" "}
              <span className="font-medium">{lines.length}</span>
            </div>
            <div className="hidden sm:block">
              Hold = exclude from totals and posting
            </div>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[140px]">Hold</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((l) => {
                const isHold = Boolean(holdMap.get(l.user_id));
                const adjCount = (manualEntriesMap.get(l.user_id) ?? []).length;

                return (
                  <TableRow
                    key={l.user_id}
                    className={cn(isHold && "opacity-60")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={isHold}
                          onCheckedChange={() => onToggleHold(l.user_id)}
                        />
                        <div className="text-[11px]">
                          {isHold ? (
                            <span className="font-bold text-destructive">
                              HOLD
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {l.employee_name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {l.position ?? "—"} • {l.department_name ?? "—"}
                          </div>
                        </div>

                        {adjCount > 0 ? (
                          <Badge variant="secondary" className="shrink-0">
                            {adjCount} adj
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <div className="font-mono text-sm font-semibold">
                        {formatPHP(l.gross_pay)}
                      </div>
                      <div className="mt-1 space-y-1">
                        {miniLine("Basic", formatPHP(l.basic_pay))}
                        {miniLine(
                          "OT + Hol",
                          formatPHP((l.ot_amount ?? 0) + (l.holiday_pay ?? 0)),
                        )}
                        {miniLine(
                          "Rest Day",
                          formatPHP(l.rest_day_amount ?? 0),
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <div className="font-mono text-sm font-semibold text-destructive">
                        ({formatPHP(l.total_deductions)})
                      </div>
                      <div className="mt-1 space-y-1">
                        {miniLine("Late", formatPHP(l.late_deduction ?? 0))}
                        {miniLine(
                          "Undertime",
                          formatPHP(l.undertime_deduction ?? 0),
                        )}
                        {miniLine(
                          "Shortage",
                          formatPHP(l.shortage_deduction ?? 0),
                        )}
                        {miniLine("Other", formatPHP(l.other_deductions ?? 0))}
                        {miniLine(
                          "DR",
                          formatPHP((l as any).dr_deduction ?? 0),
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <div className="font-mono text-sm font-bold">
                        {formatPHP(l.net_pay)}
                      </div>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      {l.variance_pct == null ? (
                        <Badge variant="secondary">New</Badge>
                      ) : (
                        <span
                          className={cn(
                            "font-mono text-xs",
                            l.variance_flag
                              ? "text-destructive font-bold"
                              : "text-muted-foreground",
                          )}
                        >
                          {l.variance_pct > 0 ? "+" : ""}
                          {l.variance_pct.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveUserId(l.user_id)}
                        >
                          Adjust Compensation
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No employees match your search.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <EmployeeDetailsSheet
          open={activeUserId != null}
          line={activeLine}
          manualEntries={activeManualEntries}
          onOpenAdjust={() => {
            if (activeUserId != null) openAdjust(activeUserId, "EARNING");
          }}
          onEditEntry={(entry) => {
            setEditIsDr(isDRPaymentEntry(entry));
            setEditEntry(entry);
          }}
          onDeleteEntry={(entry) => {
            setDeleteEntry(entry);
          }}
          onOpenChange={(v) => {
            if (!v) setActiveUserId(null);
          }}
        />

        <AddEmployeeAdjustmentsDialog
          open={bulkOpen}
          cutoff={cutoff}
          employees={lines.map((l) => ({
            userId: l.user_id,
            name: l.employee_name,
            dept: l.department_name ?? "—",
            position: l.position ?? "—",
          }))}
          onOpenChange={setBulkOpen}
          onCreateAddition={async ({ userId, desc, amount }) => {
            await onCreateManualEntry({
              userId,
              type: "EARNING",
              desc,
              amount,
            });
            toast.success("Addition added.");
            onRecompute();
          }}
          onCreateDrPayment={async ({ userId, desc, amount }) => {
            await onCreateDrPayment({ userId, desc, amount });
            toast.success("DR payment added.");
            onRecompute();
          }}
          onCreateOtherDeduction={async ({ userId, type, desc, amount }) => {
            await onCreateOtherDeduction({
              userId,
              type,
              desc,
              amount,
              cutoffStart: cutoff.start_date,
              cutoffEnd: cutoff.end_date,
            });
            toast.success("Deduction added.");
            onRecompute();
          }}
        />

        <ManualAdjustmentDialog
          open={adjustUserId != null}
          mode="create"
          employeeName={adjustLine?.employee_name ?? "Employee"}
          defaultType={adjustDefaultType}
          initial={null}
          onOpenChange={(v) => setAdjustUserId(v ? adjustUserId : null)}
          onSubmit={async ({ type, desc, amount }) => {
            if (adjustUserId == null) return;
            try {
              await onCreateManualEntry({
                userId: adjustUserId,
                type,
                desc,
                amount,
              });
              toast.success("Adjustment added.");
              setAdjustUserId(null);
            } catch (e: any) {
              toast.error(e?.message || "Failed to add adjustment");
            }
          }}
        />

        <ManualAdjustmentDialog
          open={editEntry != null}
          mode="edit"
          employeeName={activeLine?.employee_name ?? "Employee"}
          drMode={editIsDr}
          initial={
            editEntry
              ? {
                  type: editIsDr ? "DEDUCTION" : editEntry.type,
                  desc: editIsDr
                    ? extractDrReceiptNo(editEntry.desc)
                    : editEntry.desc,
                  amount: editEntry.amount,
                }
              : null
          }
          onOpenChange={(v) => setEditEntry(v ? editEntry : null)}
          onSubmit={async ({ type, desc, amount }) => {
            if (!editEntry?.id) return;

            try {
              if (editIsDr) {
                await onUpdateDrPayment({
                  userId: editEntry.user_id,
                  entryId: editEntry.id, // negative id
                  drReceiptNo: desc,
                  amount,
                });
                toast.success("DR payment updated.");
                setEditEntry(null);
                return;
              }

              await onUpdateManualEntry({
                userId: editEntry.user_id,
                entryId: editEntry.id,
                type,
                desc,
                amount,
              });
              toast.success("Adjustment updated.");
              setEditEntry(null);
            } catch (e: any) {
              toast.error(e?.message || "Failed to update");
            }
          }}
        />

        <AlertDialog
          open={deleteEntry != null}
          onOpenChange={(v) => setDeleteEntry(v ? deleteEntry : null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete adjustment?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the adjustment and immediately recompute totals
                for the current cutoff.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteEntry(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deleteEntry?.id) return;

                  try {
                    if (isDRPaymentEntry(deleteEntry)) {
                      await onDeleteDrPayment({
                        userId: deleteEntry.user_id,
                        entryId: deleteEntry.id,
                      });
                      toast.success("DR payment deleted.");
                      setDeleteEntry(null);
                      return;
                    }

                    await onDeleteManualEntry({
                      userId: deleteEntry.user_id,
                      entryId: deleteEntry.id,
                      type: deleteEntry.type,
                    });
                    toast.success("Adjustment deleted.");
                    setDeleteEntry(null);
                  } catch (e: any) {
                    toast.error(e?.message || "Failed to delete");
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
