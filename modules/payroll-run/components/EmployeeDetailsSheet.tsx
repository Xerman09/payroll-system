"use client";

import React from "react";
import type { ManualEntry, PayrollComputedLine } from "../types";
import { formatPHP } from "../utils/compute";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        tone === "good" && "border-emerald-200/60",
        tone === "bad" && "border-red-200/60",
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sublabel ? (
        <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
      ) : null}
    </div>
  );
}

function upper(v: any): string {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function entryCategory(e: any): string {
  const cat =
    e?.category ??
    e?.deduction_type ??
    e?.deductionType ??
    e?.other_deduction_type ??
    e?.otherDeductionType ??
    e?.deduction_kind ??
    e?.deductionKind ??
    null;

  if (cat != null && String(cat).trim() !== "") return upper(cat);

  const t = upper(e?.type);
  if (t && t !== "EARNING" && t !== "DEDUCTION") return t;

  return "";
}

function formatEntryAmount(e: ManualEntry) {
  const amt = Number(e.amount ?? 0);
  if (upper(e.type) === "DEDUCTION") return `(${formatPHP(amt)})`;
  return formatPHP(amt);
}

function isDRPaymentEntry(e: ManualEntry) {
  return entryCategory(e) === "DR_PAYMENT";
}

function extractDrReceiptNo(desc: string): string {
  const s = String(desc ?? "").trim();
  // expected: "DR Payment: QWE123"
  const prefix = /^DR\s*PAYMENT\s*:\s*/i;
  return s.replace(prefix, "").trim();
}

function isShortageEntry(e: ManualEntry) {
  return entryCategory(e) === "SHORTAGE";
}

export function EmployeeDetailsSheet({
  open,
  line,
  manualEntries,
  onOpenAdjust,
  onEditEntry,
  onDeleteEntry,
  onOpenChange,
}: {
  open: boolean;
  line: PayrollComputedLine | null;
  manualEntries: ManualEntry[];
  onOpenAdjust: () => void;
  onEditEntry: (entry: ManualEntry) => void;
  onDeleteEntry: (entry: ManualEntry) => void;
  onOpenChange: (v: boolean) => void;
}) {
  const allowanceItems =
    ((line as any)?.breakdown_json?.earnings?.allowance_items as any[]) ?? [];

  const entries = Array.isArray(manualEntries) ? manualEntries : [];

  const additionEntries = entries.filter((e) => upper(e.type) === "EARNING");

  const employeeMeta = [
    line?.position ?? "—",
    line?.department_name ?? "—",
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-[980px]">
        <div className="flex max-h-[85vh] flex-col">
          <div className="border-b bg-muted/20 px-6 py-4">
            <DialogHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3 pr-10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="truncate">
                      {line?.employee_name ?? "Employee Details"}
                    </DialogTitle>

                    {line?.variance_flag ? (
                      <Badge variant="destructive">Variance Alert</Badge>
                    ) : null}

                    {line?.variance_pct != null ? (
                      <Badge variant="secondary" className="font-mono">
                        {line.variance_pct > 0 ? "+" : ""}
                        {line.variance_pct.toFixed(1)}%
                      </Badge>
                    ) : (
                      <Badge variant="secondary">New</Badge>
                    )}
                  </div>

                  <DialogDescription className="mt-1">
                    <span className="font-medium">
                      {employeeMeta.join(" • ") || "—"}
                    </span>
                    {line?.user_id != null ? (
                      <>
                        {" "}
                        • User ID:{" "}
                        <span className="font-mono">{line.user_id}</span>
                      </>
                    ) : null}
                  </DialogDescription>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Benefits follow{" "}
                    <span className="font-medium">benefit_cutoff_settings</span>
                    . Employee loans are{" "}
                    <span className="font-medium">50/50 per cutoff</span>.
                    Benefit loans follow{" "}
                    <span className="font-medium">amortization per cutoff</span>
                    . DR payments are pulled from{" "}
                    <span className="font-medium">dr_payment</span> when{" "}
                    <span className="font-medium">PAYROLL_DEDUCTION</span>.
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard
                label="Gross Pay"
                value={formatPHP(line?.gross_pay ?? 0)}
                sublabel={
                  <>
                    Basic {formatPHP(line?.basic_pay ?? 0)} • OT{" "}
                    {formatPHP(line?.ot_amount ?? 0)}
                  </>
                }
              />
              <StatCard
                label="Total Deductions"
                tone="bad"
                value={formatPHP(line?.total_deductions ?? 0)}
                sublabel={
                  <>
                    Late {formatPHP(line?.late_deduction ?? 0)} • Undertime{" "}
                    {formatPHP(line?.undertime_deduction ?? 0)}
                  </>
                }
              />
              <StatCard
                label="Net Pay"
                tone="good"
                value={formatPHP(line?.net_pay ?? 0)}
                sublabel={
                  line?.variance_flag ? (
                    <span className="text-destructive">
                      Review variance details before posting.
                    </span>
                  ) : (
                    "Looks normal for this cutoff."
                  )
                }
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Rates</div>
                    {line?.variance_flag ? (
                      <Badge variant="destructive">Variance</Badge>
                    ) : null}
                  </div>
                  <Separator className="my-3" />
                  <Row label="Daily" value={formatPHP(line?.daily_rate ?? 0)} />
                  <Row
                    label="Hourly"
                    value={formatPHP(line?.hourly_rate ?? 0)}
                  />
                  <Row
                    label="Monthly"
                    value={formatPHP(line?.monthly_rate ?? 0)}
                  />
                </div>

                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="text-sm font-semibold">Attendance Totals</div>
                  <Separator className="my-3" />
                  <Row
                    label="Days Worked"
                    value={line?.total_days_worked ?? 0}
                  />
                  <Row
                    label="Work Minutes"
                    value={line?.total_work_minutes ?? 0}
                  />
                  <Row label="Late Minutes" value={line?.late_minutes ?? 0} />
                  <Row
                    label="Undertime Minutes"
                    value={line?.undertime_minutes ?? 0}
                  />
                  <Row label="OT Minutes" value={line?.overtime_minutes ?? 0} />
                  <Row
                    label="Night Diff Minutes"
                    value={line?.night_diff_minutes ?? 0}
                  />
                </div>

                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Earnings Itemizations
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {allowanceItems.length + additionEntries.length} item(s)
                    </div>
                  </div>
                  <Separator className="my-3" />

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Allowances
                    </div>

                    {allowanceItems.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No allowance items for this cutoff.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allowanceItems.map((a) => (
                          <div
                            key={String(a.allowance_id)}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-muted-foreground">
                                {a.description ||
                                  `Allowance #${a.allowance_id}`}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {String(a.pay_cycle ?? "")
                                  .replaceAll("_", " ")
                                  .toLowerCase()}
                              </div>
                            </div>
                            <div className="font-mono">
                              {formatPHP(Number(a.amount_this_cutoff ?? 0))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Manual Additions
                    </div>

                    {additionEntries.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No manual additions for this cutoff.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {additionEntries.map((e) => (
                          <div
                            key={`add-${e.id ?? "noid"}-${e.desc}`}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-muted-foreground">
                                {e.desc || "Addition"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                EARNING adjustment
                              </div>
                            </div>
                            <div className="font-mono">
                              {formatPHP(Number(e.amount ?? 0))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="text-sm font-semibold">Earnings</div>
                  <Separator className="my-3" />
                  <Row
                    label="Basic Pay"
                    value={formatPHP(line?.basic_pay ?? 0)}
                  />
                  <Row
                    label="OT Amount"
                    value={formatPHP(line?.ot_amount ?? 0)}
                  />
                  <Row
                    label="Holiday Pay"
                    value={formatPHP(line?.holiday_pay ?? 0)}
                  />
                  <Row
                    label="Rest Day Amount"
                    value={formatPHP(line?.rest_day_amount ?? 0)}
                  />
                  <Row
                    label="Night Diff Amount"
                    value={formatPHP(line?.night_diff_amount ?? 0)}
                  />
                  <Row
                    label="Allowance (Total)"
                    value={formatPHP(line?.allowance ?? 0)}
                  />
                  <Row
                    label="Manual Additions (Total)"
                    value={formatPHP(line?.manual_additions ?? 0)}
                  />
                </div>

                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="text-sm font-semibold">Deductions</div>
                  <Separator className="my-3" />

                  <Row
                    label="Late Deduction"
                    value={formatPHP(line?.late_deduction ?? 0)}
                  />
                  <Row
                    label="Undertime Deduction"
                    value={formatPHP(line?.undertime_deduction ?? 0)}
                  />
                  <Row
                    label="Shortage Deduction"
                    value={formatPHP(line?.shortage_deduction ?? 0)}
                  />

                  <Row
                    label="DR Payment"
                    value={formatPHP((line as any)?.dr_deduction ?? 0)}
                  />

                  <Separator className="my-3" />
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Employee Loans (50/50 per cutoff)
                  </div>
                  <div className="mt-2 space-y-2">
                    <Row
                      label="Vale"
                      value={formatPHP((line as any)?.loan_vale ?? 0)}
                    />
                    <Row
                      label="Car Loan"
                      value={formatPHP((line as any)?.loan_car ?? 0)}
                    />
                    <Row
                      label="COOP"
                      value={formatPHP((line as any)?.loan_coop ?? 0)}
                    />
                    <Row
                      label="Loans Total"
                      value={formatPHP((line as any)?.loan_total ?? 0)}
                    />
                  </div>

                  <Separator className="my-3" />
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Benefit Loans (amortization per cutoff)
                  </div>
                  <div className="mt-2 space-y-2">
                    <Row
                      label="SSS Loan"
                      value={formatPHP((line as any)?.benefit_loan_sss ?? 0)}
                    />
                    <Row
                      label="Pag-IBIG Loan"
                      value={formatPHP(
                        (line as any)?.benefit_loan_pagibig ?? 0,
                      )}
                    />
                    <Row
                      label="Benefit Loans Total"
                      value={formatPHP((line as any)?.benefit_loan_total ?? 0)}
                    />
                  </div>

                  <Separator className="my-3" />
                  <Row label="SSS" value={formatPHP(line?.benefit_sss ?? 0)} />
                  <Row
                    label="PhilHealth"
                    value={formatPHP(line?.benefit_philhealth ?? 0)}
                  />
                  <Row
                    label="Pag-IBIG"
                    value={formatPHP(line?.benefit_pagibig ?? 0)}
                  />

                  <Row
                    label="Manual Deductions (Total)"
                    value={formatPHP(line?.manual_deductions ?? 0)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    Manual Adjustments
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entries.length} item(s)
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenAdjust}
                  disabled={!line}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              <Separator className="my-3" />

              {entries.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No manual entries for this cutoff.
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((e) => {
                    const isDR = isDRPaymentEntry(e);
                    const shortage = isShortageEntry(e);

                    return (
                      <div
                        key={`${e.type}-${e.id ?? "noid"}-${e.desc}`}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {e.desc || "Adjustment"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>
                              {isDR
                                ? "System (DR Payment)"
                                : upper(e.type) === "EARNING"
                                  ? "Addition"
                                  : shortage
                                    ? "Shortage Deduction"
                                    : "Deduction"}
                            </span>

                            {isDR ? (
                              <Badge variant="secondary">DR_PAYMENT</Badge>
                            ) : null}
                            {!isDR && shortage ? (
                              <Badge variant="secondary">SHORTAGE</Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "font-mono text-sm",
                              upper(e.type) === "DEDUCTION" &&
                                "text-destructive",
                            )}
                          >
                            {formatEntryAmount(e)}
                          </div>

                          {/* ✅ Enable edit for DR entries */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditEntry(e)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          {/* ✅ Enable delete for DR entries */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteEntry(e)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
              breakdown_json is saved for auditability. Benefits follow
              benefit_cutoff_settings; employee loans follow 50/50; benefit
              loans follow amortization per cutoff. DR payments are deducted
              from dr_payment when PAYROLL_DEDUCTION and not yet posted to
              payroll.
            </div>
          </div>

          <div className="border-t bg-background px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Totals:{" "}
                <span className="font-mono font-semibold">
                  Gross {formatPHP(line?.gross_pay ?? 0)}
                </span>{" "}
                •{" "}
                <span className="font-mono font-semibold text-destructive">
                  Deductions {formatPHP(line?.total_deductions ?? 0)}
                </span>{" "}
                •{" "}
                <span className="font-mono font-semibold">
                  Net {formatPHP(line?.net_pay ?? 0)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  variant="secondary"
                  onClick={onOpenAdjust}
                  disabled={!line}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Adjustment
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
