"use client";

import * as React from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  Pencil,
  Trash2,
  Plus,
  Wallet,
  PiggyBank,
  BadgePercent,
  Clock,
  Layers,
  CircleDollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
  Coins,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono tabular-nums">{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: "default" | "good" | "bad";
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm",
        tone === "good" && "border-emerald-200/60",
        tone === "bad" && "border-red-200/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-xl font-bold">{value}</div>
          {sublabel ? (
            <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
          ) : null}
        </div>

        {icon ? (
          <div className="rounded-xl border bg-muted/30 p-2 text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-muted/20" />
    </div>
  );
}

function Section({
  title,
  icon,
  right,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ? (
            <div className="rounded-xl border bg-muted/30 p-2 text-muted-foreground">
              {icon}
            </div>
          ) : null}
          <div className="text-sm font-semibold">{title}</div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <Separator className="my-3" />
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "good" | "bad";
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-muted/10 px-3 py-2",
        tone === "good" && "border-emerald-200/60",
        tone === "bad" && "border-red-200/60",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <span className="font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-mono text-xs font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function upper(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function entryCategory(e: unknown): string {
  const row = e as Record<string, unknown>;
  const cat =
    row?.category ??
    row?.deduction_type ??
    row?.deductionType ??
    row?.other_deduction_type ??
    row?.otherDeductionType ??
    row?.deduction_kind ??
    row?.deductionKind ??
    row?.type_kind ??
    row?.typeKind ??
    row?.kind ??
    null;

  if (cat != null && String(cat).trim() !== "") return upper(cat);

  const t = upper(row?.type);
  if (t && t !== "EARNING" && t !== "DEDUCTION") return t;

  return "";
}

function readAmount(e: unknown): number {
  const row = e as Record<string, unknown>;
  const v = row?.amount ?? row?.amount_paid ?? row?.amountPaid ?? 0;
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatEntryAmount(e: ManualEntry) {
  const row = e as unknown as Record<string, unknown>;
  const amt = readAmount(e);
  if (upper(row?.type) === "DEDUCTION") return `(${formatPHP(amt)})`;
  return formatPHP(amt);
}

function safeId(e: unknown) {
  const row = e as Record<string, unknown>;
  const id =
    row?.id ??
    row?.retro_id ??
    row?.retroId ??
    row?.dr_payment_id ??
    row?.drPaymentId ??
    row?.coop_savings_membership_id ??
    row?.coopSavingsMembershipId ??
    row?.savings_id ??
    row?.savingsId ??
    null;

  return id == null ? "noid" : String(id);
}

function extractDrReceiptNo(desc: string): string {
  const s = String(desc ?? "").trim();
  const prefix = /^DR\s*PAYMENT\s*:\s*/i;
  return s.replace(prefix, "").trim();
}

function entryDesc(e: unknown): string {
  const row = e as Record<string, unknown>;
  // ✅ DR FIRST: never return raw "DR PAYMENT: ..." desc
  if (isDRPaymentEntry(e)) {
    const drNo = drReceiptNoFromEntry(e); // already strips prefix via extractDrReceiptNo()
    return drNo ? drNo : "DR Payment";
  }

  const d = row?.desc ?? row?.description ?? "";
  if (String(d).trim()) return String(d);

  if (isShortageEntry(e)) return "Shortage";
  if (isRetroPayEntry(e)) return "Retro Pay";
  if (isSavingsEntry(e)) return "Savings";

  return "";
}

// ===== Itemized detectors =====
function isDRPaymentEntry(e: unknown): boolean {
  const row = e as Record<string, unknown>;
  const cat = entryCategory(e);
  if (cat === "DR_PAYMENT") return true;

  if (row?.dr_payment_id != null) return true;
  if (row?.delivery_receipt_number) return true;

  if (upper(row?.source) === "DR_PAYMENT" || upper(row?.source) === "DR")
    return true;

  const desc = String(row?.desc ?? row?.description ?? "");
  if (/^DR\s*PAYMENT\s*:/i.test(desc)) return true;

  return false;
}

function isShortageEntry(e: unknown): boolean {
  const row = e as Record<string, unknown>;
  const cat = entryCategory(e);
  if (cat === "SHORTAGE") return true;

  const desc = String(row?.desc ?? row?.description ?? "").toLowerCase();
  return desc.includes("shortage");
}

function isRetroPayEntry(e: unknown): boolean {
  const row = e as Record<string, unknown>;
  const cat = entryCategory(e);
  if (cat === "RETRO_PAY" || cat === "RETROPAY") return true;

  if (upper(row?.source) === "RETRO_PAY") return true;

  // Directus row from retro_pay table
  if (row?.retro_id != null || row?.retroId != null) return true;

  const desc = String(row?.desc ?? row?.description ?? "").toLowerCase();
  return desc.includes("retro");
}

function isSavingsEntry(e: unknown): boolean {
  const row = e as Record<string, unknown>;
  const cat = entryCategory(e);
  if (cat === "COOP_SAVINGS_MEMBERSHIP" || cat === "SAVINGS") return true;

  if (upper(row?.source) === "COOP_SAVINGS_MEMBERSHIP") return true;

  const desc = String(row?.desc ?? row?.description ?? "").toLowerCase();
  return desc.includes("savings") || desc.includes("coop savings");
}

function drReceiptNoFromEntry(e: unknown): string {
  const row = e as Record<string, unknown>;
  if (row?.delivery_receipt_number) return String(row.delivery_receipt_number);
  const desc = String(row?.desc ?? row?.description ?? "");
  const fromDesc = extractDrReceiptNo(desc);
  return fromDesc || "";
}


function drPostedFromEntry(e: unknown): boolean {
  const row = e as Record<string, unknown>;
  const v =
    row?.is_posted_to_payroll ??
    row?.isPostedToPayroll ??
    (row?.meta as Record<string, unknown>)?.is_posted_to_payroll ??
    (row?.meta as Record<string, unknown>)?.isPostedToPayroll ??
    0;
  return Boolean(Number(v) === 1 || v === true);
}

function resolvePayrollId(line: PayrollComputedLine | null): string {
  const row = line as unknown as Record<string, unknown>;
  const v =
    row?.payroll_run_employee_id ??
    row?.payrollRunEmployeeId ??
    row?.pre_id ??
    row?.id ??
    "";
  const s = String(v ?? "").trim();
  return s || "—";
}


function prettyPayCycle(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  return s.replaceAll("_", " ").toLowerCase();
}

function MoneyPill({
  amount,
  kind,
  accent,
}: {
  amount: string;
  kind: "EARNING" | "DEDUCTION";
  accent?: "retro" | "savings" | "none";
}) {
  if (accent === "retro") {
    return (
      <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-2.5 py-1 font-mono text-xs tabular-nums text-amber-800">
        {amount}
      </div>
    );
  }

  if (accent === "savings") {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-xs tabular-nums text-primary">
        {amount}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-2.5 py-1 font-mono text-xs tabular-nums",
        kind === "DEDUCTION"
          ? "border-red-200/60 bg-red-50/40 text-destructive"
          : "border-emerald-200/60 bg-emerald-50/40 text-emerald-700",
      )}
    >
      {amount}
    </div>
  );
}

/**
 * ✅ IMPORTANT: enrich entries so Edit/Delete knows the correct table
 *  - Retro Pay -> __source: "RETRO" and id: retro_id
 *  - DR Payment -> __source: "DR" and id: dr_payment_id
 *  - Coop Savings -> __source: "COOP" and id: source_id
 *  - Normal earning -> __source: "ADD"
 *  - Normal deduction -> __source: "DED"
 */
function normalizeEntry(e: unknown): Record<string, unknown> {
  if (!e || typeof e !== "object") return e as Record<string, unknown>;

  const row = e as Record<string, unknown>;
  const retroId = row?.retro_id ?? row?.retroId ?? null;
  const drId = row?.dr_payment_id ?? row?.drPaymentId ?? null;
  const coopId = row?.source_id ?? row?.sourceId ?? null;

  if (isRetroPayEntry(e) && retroId != null) {
    return { ...row, __source: "RETRO", id: Number(retroId), type: "EARNING" };
  }
  if (isDRPaymentEntry(e) && drId != null) {
    return { ...row, __source: "DR", id: Number(drId), type: "DEDUCTION" };
  }
  if (isSavingsEntry(e) && coopId != null) {
    return { ...row, __source: "COOP", id: Number(coopId), type: "DEDUCTION" };
  }

  const t = upper(row?.type);
  if (t === "EARNING")
    return { ...row, __source: "ADD", id: Number(row?.id ?? 0) || (row?.id as number | string) };
  if (t === "DEDUCTION")
    return { ...row, __source: "DED", id: Number(row?.id ?? 0) || (row?.id as number | string) };

  // fallback
  return { ...row, __source: (row?.__source as string) ?? undefined };
}

/** ✅ Holiday label helper (handles Holiday + Rest Day) */
function holidayItemLabel(h: unknown): string {
  const row = h as Record<string, unknown>;
  const flag = String(row?.holiday ?? "").toUpperCase();
  const base =
    flag === "REGULAR"
      ? "Regular Holiday"
      : flag === "SPECIAL"
        ? "Special Holiday"
        : "Holiday";

  const isRest = Boolean(row?.is_rest_day);
  const desc = String(row?.description ?? "").trim();

  return `${base}${isRest ? " + Rest Day" : ""}${desc ? ` · ${desc}` : ""}`;
}

function MinimalAdjustmentRow({
  entry,
  onEdit,
  onDelete,
  isPosted = false,
}: {
  entry: ManualEntry;
  onEdit: (e: ManualEntry) => void;
  onDelete: (e: ManualEntry) => void;
  isPosted?: boolean;
}) {
  const e = normalizeEntry(entry) as unknown as ManualEntry;

  const isDR = isDRPaymentEntry(e);
  const retro = isRetroPayEntry(e);
  const shortage = isShortageEntry(e);
  const savings = isSavingsEntry(e);

  const desc = entryDesc(e) || "—";

  const typeLabel = retro
    ? "RETRO PAY"
    : savings
      ? "COOP SAVINGS"
      : isDR
        ? "DR PAYMENT"
        : shortage
          ? "SHORTAGE"
          : upper(e?.type) === "EARNING"
            ? "ADDITION"
            : "DEDUCTION";

  const kind: "EARNING" | "DEDUCTION" =
    upper(e?.type) === "DEDUCTION" ? "DEDUCTION" : "EARNING";

  const accent: "retro" | "savings" | "none" = retro
    ? "retro"
    : savings
      ? "savings"
      : "none";

  // Disable edit/delete if posted OR if DR payment is already posted to payroll
  const disableEditDelete = isPosted || (isDR && drPostedFromEntry(e));

  return (
    <div className="group flex items-center justify-between gap-3 border-b px-0 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {typeLabel}
          </span>
          <span className="truncate text-sm">{desc}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <MoneyPill amount={formatEntryAmount(e)} kind={kind} accent={accent} />

        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              onEdit(e);
            }}
            disabled={disableEditDelete}
            title={
              isPosted
                ? "Cannot edit adjustments for posted employees"
                : disableEditDelete
                  ? "Cannot edit posted DR payments"
                  : "Edit"
            }
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              onDelete(e);
            }}
            disabled={disableEditDelete}
            title={
              isPosted
                ? "Cannot delete adjustments for posted employees"
                : disableEditDelete
                  ? "Cannot delete posted DR payments"
                  : "Delete"
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmployeeDetailsSheet({
  open,
  line,
  manualEntries,
  isPosted = false,
  onOpenAdjust,
  onEditEntry,
  onDeleteEntry,
  onOpenChange,
}: {
  open: boolean;
  line: PayrollComputedLine | null;
  manualEntries: ManualEntry[];
  isPosted?: boolean;

  onOpenAdjust?: (() => void) | null;

  onEditEntry: (entry: ManualEntry) => void;
  onDeleteEntry: (entry: ManualEntry) => void;

  onOpenChange: (v: boolean) => void;
}) {
  const breakdown = line?.breakdown_json;

  const allowanceItems = (breakdown?.earnings?.allowance_items as Record<string, unknown>[]) ?? [];

  const coopSavingsItemsFromBreakdown = (breakdown?.deductions?.coop_savings_items as Record<string, unknown>[]) ?? [];

  const retroItemsFromBreakdown = (breakdown?.earnings?.retro_items as Record<string, unknown>[]) ?? [];

  // ✅ Holiday itemization from compute.ts
  const holidayItems = (breakdown?.earnings?.holiday_items as Record<string, unknown>[]) ?? [];

  const holidayPaidItems = holidayItems.filter(
    (x) => Number(x?.total ?? 0) > 0,
  );

  const [holidayOpen, setHolidayOpen] = React.useState(false);

  // ✅ Rest Day itemization from compute.ts
  const restDayItems = (breakdown?.earnings?.rest_day_items as Record<string, unknown>[]) ?? [];

  const restDayPaidItems = restDayItems.filter(
    (x) => Number(x?.total ?? 0) > 0,
  );

  const [restDayOpen, setRestDayOpen] = React.useState(false);

  const rawEntries = Array.isArray(manualEntries) ? manualEntries : [];
  const entries = rawEntries.map((e) => normalizeEntry(e) as unknown as ManualEntry);

  const retroEntries = entries.filter((e) => isRetroPayEntry(e));
  const savingsEntries = entries.filter((e) => isSavingsEntry(e));

  const allRetroEntries = [
    ...retroEntries,
    ...retroItemsFromBreakdown.map((item) => ({
      ...item,
      retro_id: (item.source_id as string | number) ?? (item.retro_id as string | number) ?? item.id,
      amount: item.amount as number,
      description: (item.description ?? item.label) as string,
      type: "EARNING" as const,
      __source: "RETRO",
    }) as unknown as ManualEntry),
  ];

  const allSavingsEntries = [
    ...savingsEntries,
    ...coopSavingsItemsFromBreakdown.map((item) => ({
      ...item,
      id: (item.source_id as string | number) ?? item.id,
      amount: item.amount as number,
      description: (item.description ?? item.label ?? "COOP Savings Membership") as string,
      type: "DEDUCTION" as const,
      category: "COOP_SAVINGS_MEMBERSHIP",
      __source: "COOP",
    }) as unknown as ManualEntry),
  ];

  const nonRetroEarningEntries = entries.filter((e) => {
    const t = upper(e?.type);
    if (t === "EARNING" && !isRetroPayEntry(e)) return true;
    return false;
  }) as unknown as ManualEntry[];

  const deductionEntries = entries.filter((e) => {
    const t = upper(e?.type);
    if (t === "DEDUCTION") return true;
    if (isDRPaymentEntry(e)) return true;
    if (isShortageEntry(e)) return true;
    if (isSavingsEntry(e)) return true;
    return false;
  }) as unknown as ManualEntry[];

  const allDeductionEntries = [...deductionEntries, ...allSavingsEntries].filter(
    (e) => !isSavingsEntry(e),
  );

  const retroTotal = allRetroEntries.reduce(
    (sum, e) => sum + readAmount(e),
    0,
  );

  const manualAddsTotal = nonRetroEarningEntries.reduce(
    (sum, e) => sum + readAmount(e),
    0,
  );

  const savingsTotal = allSavingsEntries.reduce(
    (sum, e) => sum + readAmount(e),
    0,
  );

  const allowancesTotal = allowanceItems.reduce(
    (sum, a) => sum + Number(a?.amount_this_cutoff ?? 0),
    0,
  );

  const additionEntries = [...allRetroEntries, ...nonRetroEarningEntries];
  const additionsTotal = additionEntries.reduce(
    (sum, e) => sum + readAmount(e),
    0,
  );

  const deductionsAdjTotal = allDeductionEntries.reduce(
    (sum, e) => sum + readAmount(e),
    0,
  );

  const employeeMeta = [
    line?.position ?? "—",
    line?.department_name ?? "—",
  ].filter(Boolean);

  const totalsGross = formatPHP(line?.gross_pay ?? 0);
  const totalsDed = formatPHP(line?.total_deductions ?? 0);
  const totalsNet = formatPHP(line?.net_pay ?? 0);

  const payrollId = resolvePayrollId(line);

  const openAdjust = React.useCallback(() => {
    if (typeof onOpenAdjust === "function") {
      onOpenAdjust();
      return;
    }
    console.warn(
      "[EmployeeDetailsSheet] onOpenAdjust is not a function. Fix parent prop wiring.",
      { onOpenAdjust },
    );
  }, [onOpenAdjust]);

  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 sm:max-w-[1040px]"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex max-h-[86vh] flex-col">
          {/* Header */}
          <div className="border-b bg-muted/20 px-6 py-4">
            <DialogHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3 pr-10">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="truncate">
                      {line?.employee_name ?? "Employee Details"}
                    </DialogTitle>

                    <Badge variant="outline" className="font-mono">
                      Payroll ID: {payrollId}
                    </Badge>

                    {line?.variance_flag ? (
                      <Badge variant="destructive">Variance Alert</Badge>
                    ) : null}

                    {line?.variance_pct != null ? (
                      <Badge variant="secondary" className="font-mono">
                        {line.variance_pct > 0 ? "+" : ""}
                        {Number(line.variance_pct).toFixed(1)}%
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

                  <div className="mt-3 flex flex-wrap gap-2">
                    <MiniStat
                      label="Allowances"
                      value={formatPHP(allowancesTotal)}
                      icon={<Wallet className="h-4 w-4" />}
                    />
                    <MiniStat
                      label="Adj. Additions"
                      value={formatPHP(additionsTotal)}
                      tone="good"
                      icon={<ArrowUpRight className="h-4 w-4" />}
                    />
                    <MiniStat
                      label="Adj. Deductions"
                      value={formatPHP(deductionsAdjTotal)}
                      tone="bad"
                      icon={<ArrowDownRight className="h-4 w-4" />}
                    />
                    {retroTotal > 0 ? (
                      <MiniStat
                        label="Retro Pay"
                        value={formatPHP(retroTotal)}
                        tone="good"
                        icon={<Sparkles className="h-4 w-4" />}
                      />
                    ) : null}
                    {savingsTotal > 0 ? (
                      <MiniStat
                        label="Savings"
                        value={formatPHP(savingsTotal)}
                        icon={<PiggyBank className="h-4 w-4" />}
                      />
                    ) : null}
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
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

                <div className="hidden sm:flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openAdjust();
                    }}
                    disabled={!line || isPosted}
                    title={isPosted ? "Cannot add adjustments to posted employees" : "Add Adjustment"}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Adjustment
                  </Button>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard
                label="Gross Pay"
                value={formatPHP(line?.gross_pay ?? 0)}
                icon={<CircleDollarSign className="h-5 w-5" />}
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
                icon={<ArrowDownRight className="h-5 w-5" />}
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
                icon={<Wallet className="h-5 w-5" />}
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

            <div className="mt-5">
              <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="itemizations" disabled={isPosted}>
                    Earnings Itemization
                  </TabsTrigger>
                  <TabsTrigger value="adjustments" disabled={isPosted}>
                    Manual Adjustments
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  <div className="space-y-4">
                    {/* Top Row: Key Metrics */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Section
                        title="Rates"
                        icon={<Layers className="h-5 w-5" />}
                      >
                        <div className="space-y-2">
                          <Row
                            label="Daily"
                            value={formatPHP(line?.daily_rate ?? 0)}
                          />
                          <Row
                            label="Hourly"
                            value={formatPHP(line?.hourly_rate ?? 0)}
                          />
                          <Row
                            label="Monthly"
                            value={formatPHP(line?.monthly_rate ?? 0)}
                          />
                        </div>
                      </Section>

                      <Section
                        title="Attendance Totals"
                        icon={<Clock className="h-5 w-5" />}
                      >
                        <div className="space-y-2">
                          <Row
                            label="Days Worked"
                            value={line?.total_days_worked ?? 0}
                          />
                          <Row
                            label="Hours Worked"
                            value={round2(
                              (line?.total_work_minutes ?? 0) / 60,
                            ).toFixed(2)}
                          />
                          <Row
                            label="Late Minutes"
                            value={line?.late_minutes ?? 0}
                          />
                          <Row
                            label="Undertime Minutes"
                            value={line?.undertime_minutes ?? 0}
                          />
                        </div>
                      </Section>

                      <Section
                        title="Extra Time"
                        icon={<Clock className="h-5 w-5" />}
                      >
                        <div className="space-y-2">
                          <Row
                            label="OT Minutes"
                            value={line?.overtime_minutes ?? 0}
                          />
                          <Row
                            label="Night Diff Minutes"
                            value={line?.night_diff_minutes ?? 0}
                          />
                          <Row
                            label="Holiday Days"
                            value={round2(line?.holiday_days ?? 0).toFixed(0)}
                          />
                          <Row label="—" value="—" />
                        </div>
                      </Section>
                    </div>

                    {/* Middle Row: Earnings + Loans (left) / Deductions (right) */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* LEFT COLUMN */}
                      <div className="space-y-4">
                        <Section
                          title="Earnings Breakdown"
                          icon={<ArrowUpRight className="h-5 w-5" />}
                        >
                          <div className="space-y-2">
                            <Row
                              label="Basic Pay"
                              value={formatPHP(line?.basic_pay ?? 0)}
                            />
                            <Row
                              label="OT Amount"
                              value={formatPHP(line?.ot_amount ?? 0)}
                            />

                            {/* ✅ DROPDOWN: Holiday Pay (shows holiday items) */}
                            <Collapsible
                              open={holidayOpen}
                              onOpenChange={setHolidayOpen}
                            >
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <CollapsibleTrigger asChild>
                                  <button
                                    type="button"
                                    className="group inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                                  >
                                    <span>Holiday Pay</span>
                                    {holidayPaidItems.length > 0 ? (
                                      <span className="text-[11px] text-muted-foreground">
                                        ({holidayPaidItems.length})
                                      </span>
                                    ) : null}
                                    <ChevronDown
                                      className={cn(
                                        "h-4 w-4 transition-transform",
                                        holidayOpen && "rotate-180",
                                      )}
                                    />
                                  </button>
                                </CollapsibleTrigger>

                                <div className="font-mono tabular-nums">
                                  {formatPHP(line?.holiday_pay ?? 0)}
                                </div>
                              </div>

                              <CollapsibleContent className="pt-2">
                                {holidayItems.length === 0 ? (
                                  <div className="pl-6 text-xs text-muted-foreground">
                                    No holiday items recorded for this cutoff.
                                  </div>
                                ) : (
                                  <div className="space-y-3 pl-6">
                                    {holidayItems.map((hIn: unknown, idx: number) => {
                                      const h = hIn as Record<string, unknown>;
                                      const total = Number(h?.total ?? 0);
                                      const basePay = Number(h?.pay ?? total);
                                      const otPay = Number(h?.ot_pay ?? 0);
                                      const hasOT = otPay > 0;
                                      const isZero = !(total > 0);
                                      return (
                                        <div key={`hol-container-${h?.date ?? idx}-${idx}`} className="flex flex-col gap-1.5">
                                          <div
                                            className={cn(
                                              "flex items-start justify-between gap-3 rounded-xl border bg-muted/10 px-3 py-2",
                                              isZero && "opacity-70",
                                            )}
                                          >
                                            <div className="min-w-0">
                                              <div className="truncate text-sm font-medium">
                                                {holidayItemLabel(h)}
                                              </div>

                                              <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                <span className="font-mono">
                                                  {String(h?.date ?? "—")}
                                                </span>
                                                {h?.pay_type ? (
                                                  <>
                                                    {" "}
                                                    •{" "}
                                                    <span className="font-mono">
                                                      {String(h.pay_type)}
                                                    </span>
                                                  </>
                                                ) : null}
                                                {h?.base_mult != null ? (
                                                  <>
                                                    {" "}
                                                    •{" "}
                                                    <span className="font-mono">
                                                      Base x
                                                      {Number(h.base_mult).toFixed(2)}
                                                    </span>
                                                  </>
                                                ) : null}
                                                {!hasOT && h?.ot_mult != null ? (
                                                  <>
                                                    {" "}
                                                    •{" "}
                                                    <span className="font-mono">
                                                      OT x
                                                      {Number(h.ot_mult).toFixed(2)}
                                                    </span>
                                                  </>
                                                ) : null}
                                              </div>

                                              {isZero && h?.rule ? (
                                                <div className="mt-1 text-[11px] text-muted-foreground">
                                                  {String(h.rule)}
                                                </div>
                                              ) : null}
                                            </div>

                                            <div className="shrink-0 font-mono text-xs tabular-nums">
                                              {formatPHP(hasOT ? basePay : total)}
                                            </div>
                                          </div>

                                          {hasOT ? (
                                            <div className="ml-6 flex items-start justify-between gap-3 rounded-xl border border-dashed bg-muted/5 px-3 py-2">
                                              <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-muted-foreground">
                                                  ↳ Holiday Overtime
                                                </div>
                                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                  {" "}
                                                  {h?.ot_mult != null ? (
                                                    <span className="font-mono">
                                                      OT x{Number(h.ot_mult).toFixed(2)}
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <div className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                                {formatPHP(otPay)}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Collapsible
                              open={restDayOpen}
                              onOpenChange={setRestDayOpen}
                              className="group/rest"
                            >
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <CollapsibleTrigger asChild>
                                  <button
                                    type="button"
                                    className="group inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                                  >
                                    <span>Rest Day Amount</span>
                                    {restDayPaidItems.length > 0 ? (
                                      <span className="text-[11px] text-muted-foreground">
                                        ({restDayPaidItems.length})
                                      </span>
                                    ) : null}
                                    <ChevronDown
                                      className={cn(
                                        "h-4 w-4 transition-transform",
                                        restDayOpen && "rotate-180",
                                      )}
                                    />
                                  </button>
                                </CollapsibleTrigger>

                                <div className="font-mono tabular-nums">
                                  {formatPHP(line?.rest_day_amount ?? 0)}
                                </div>
                              </div>
                              <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                                {restDayPaidItems.length > 0 && (
                                  <div className="mt-2 space-y-2 pb-3">
                                    {restDayPaidItems.map((hIn: unknown, i: number) => {
                                      const h = hIn as Record<string, unknown>;
                                      const total = Number(h?.total ?? h?.amount ?? h?.pay_amount ?? 0);
                                      const basePay = Number(h?.pay ?? total);
                                      const otPay = Number(h?.ot_pay ?? 0);
                                      const hasOT = otPay > 0;
                                      const isZero = !(total > 0);

                                      return (
                                        <div key={i} className="flex flex-col gap-1.5 border-l-2 border-primary/20 pl-3">
                                          <div
                                            className={cn(
                                              "flex items-start justify-between gap-3 rounded-xl border bg-muted/10 px-3 py-2",
                                              isZero && "opacity-70",
                                            )}
                                          >
                                            <div className="min-w-0">
                                              <div className="truncate text-sm font-medium">
                                                Rest Day
                                              </div>
                                              <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                <span className="font-mono">
                                                  {(h as Record<string, unknown>).date && String((h as Record<string, unknown>).date).length >= 10
                                                    ? String((h as Record<string, unknown>).date).slice(5, 10)
                                                    : (h as Record<string, unknown>)?.holiday_date
                                                      ? String((h as Record<string, unknown>).holiday_date).slice(5, 10)
                                                      : "—"}
                                                </span>
                                                {(h as Record<string, unknown>)?.base_mult != null ? (
                                                  <>
                                                    •{" "}
                                                    <span className="font-mono">
                                                      Base x
                                                      {Number(h.base_mult).toFixed(2)}
                                                    </span>
                                                  </>
                                                ) : null}
                                                {h?.ot_mult != null ? (
                                                  <>
                                                    •{" "}
                                                    <span className="font-mono">
                                                      OT x
                                                      {Number(h.ot_mult).toFixed(2)}
                                                    </span>
                                                  </>
                                                ) : null}
                                              </div>
                                            </div>

                                            <div className="shrink-0 font-mono text-xs tabular-nums">
                                              {formatPHP(hasOT ? basePay : total)}
                                            </div>
                                          </div>

                                          {hasOT ? (
                                            <div className="ml-6 flex items-start justify-between gap-3 rounded-xl border border-dashed bg-muted/5 px-3 py-2">
                                              <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-muted-foreground">
                                                  ↳ Rest Day Overtime
                                                </div>
                                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                  {" "}
                                                  {h?.ot_mult != null ? (
                                                    <span className="font-mono">
                                                      OT x{Number(h.ot_mult).toFixed(2)}
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <div className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                                {formatPHP(otPay)}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Row
                              label="Night Diff Amount"
                              value={formatPHP(line?.night_diff_amount ?? 0)}
                            />

                            <Separator className="my-2" />

                            <Row
                              label="Allowance"
                              value={formatPHP(line?.allowance ?? 0)}
                            />
                            <Row
                              label="Manual Additions"
                              value={formatPHP(line?.manual_additions ?? 0)}
                            />
                            {retroTotal > 0 ? (
                              <Row
                                label="Retro Pay"
                                value={formatPHP(retroTotal)}
                              />
                            ) : null}

                            <Separator className="my-2" />
                            <Row
                              label="Total Earnings"
                              value={
                                <span className="font-bold text-emerald-700">
                                  {formatPHP(line?.gross_pay ?? 0)}
                                </span>
                              }
                            />
                          </div>
                        </Section>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Section
                            title="Employee Loans"
                            icon={<Wallet className="h-5 w-5" />}
                          >
                            <div className="space-y-2">
                              <Row
                                label="Vale"
                                value={formatPHP(line?.loan_vale ?? 0)}
                              />
                              <Row
                                label="Car Loan"
                                value={formatPHP(line?.loan_car ?? 0)}
                              />
                              <Row
                                label="Coop Loan"
                                value={formatPHP(line?.loan_coop ?? 0)}
                              />
                              <Separator className="my-2" />
                              <Row
                                label="Total"
                                value={formatPHP(line?.loan_total ?? 0)}
                              />
                            </div>
                          </Section>

                          <Section
                            title="Benefit Loans"
                            icon={<PiggyBank className="h-5 w-5" />}
                          >
                            <div className="space-y-2">
                              <Row
                                label="SSS Loan"
                                value={formatPHP(line?.benefit_loan_sss ?? 0)}
                              />
                              <Row
                                label="PAGIBIG Loan"
                                value={formatPHP(
                                  line?.benefit_loan_pagibig ?? 0,
                                )}
                              />
                              <Separator className="my-2" />
                              <Row
                                label="Total"
                                value={formatPHP(line?.benefit_loan_total ?? 0)}
                              />
                              <Row label="—" value="—" />
                            </div>
                          </Section>
                        </div>
                      </div>

                      {/* RIGHT COLUMN */}
                      <Section
                        title="Deductions Breakdown"
                        icon={<ArrowDownRight className="h-5 w-5" />}
                      >
                        <div className="space-y-2">
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
                            value={formatPHP((line as unknown as Record<string, unknown>)?.dr_deduction as number ?? 0)}
                          />
                          <Row
                            label="Other Deductions"
                            value={formatPHP(line?.other_deductions ?? 0)}
                          />

                          <Separator className="my-2" />

                          <Row
                            label="Benefits (SSS)"
                            value={formatPHP(line?.benefit_sss ?? 0)}
                          />
                          <Row
                            label="Benefits (PhilHealth)"
                            value={formatPHP(line?.benefit_philhealth ?? 0)}
                          />
                          <Row
                            label="Benefits (PAGIBIG)"
                            value={formatPHP(line?.benefit_pagibig ?? 0)}
                          />

                          <Separator className="my-2" />

                          <Row
                            label="SSS Loan"
                            value={formatPHP(line?.benefit_loan_sss ?? 0)}
                          />
                          <Row
                            label="PAGIBIG Loan"
                            value={formatPHP(line?.benefit_loan_pagibig ?? 0)}
                          />
                          <Row
                            label="Benefit Loans Total"
                            value={
                              <span className="font-semibold">
                                {formatPHP(line?.benefit_loan_total ?? 0)}
                              </span>
                            }
                          />

                          <Separator className="my-2" />

                          <Row
                            label="Vale"
                            value={formatPHP(line?.loan_vale ?? 0)}
                          />
                          <Row
                            label="Car Loan"
                            value={formatPHP(line?.loan_car ?? 0)}
                          />
                          <Row
                            label="Coop Loan"
                            value={formatPHP(line?.loan_coop ?? 0)}
                          />
                          <Row
                            label="Employee Loans Total"
                            value={
                              <span className="font-semibold">
                                {formatPHP(line?.loan_total ?? 0)}
                              </span>
                            }
                          />

                          <Separator className="my-2" />

                          {savingsTotal > 0 ? (
                            <Row
                              label="Coop Savings"
                              value={formatPHP(savingsTotal)}
                            />
                          ) : null}

                          <Separator className="my-2" />

                          <Row
                            label="Total Deductions"
                            value={
                              <span className="font-bold text-destructive">
                                {formatPHP(line?.total_deductions ?? 0)}
                              </span>
                            }
                          />
                        </div>
                      </Section>
                    </div>
                  </div>
                </TabsContent>

                {/* ✅ UPDATED: 3 columns (Allowances / Retro Pay / Manual Adjustments) */}
                <TabsContent value="itemizations" className="mt-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Allowances */}
                    <Section
                      title="Allowances"
                      icon={<Wallet className="h-5 w-5" />}
                      right={
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {allowanceItems.length} item(s)
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            {formatPHP(allowancesTotal)}
                          </Badge>
                        </div>
                      }
                    >
                      {allowanceItems.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No allowance items for this cutoff.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {allowanceItems.map((aIn: unknown, idx: number) => {
                            const a = aIn as Record<string, unknown>;
                            const aid = a.allowance_id ?? a.source_id;
                            const keyStr = aid ? String(aid) : `allowance-idx-${idx}`;
                            const meta = (a.meta as Record<string, unknown>) ?? {};
                            const payCycle = a.pay_cycle ?? meta.pay_cycle;
                            
                            return (
                            <div
                              key={keyStr}
                              className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/10 p-3"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">
                                  {(a.description as string) ||
                                    `Allowance #${aid}`}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {prettyPayCycle(payCycle)}
                                  </Badge>
                                  {aid != null ? (
                                    <span className="font-mono">
                                      ID: {String(aid)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <MoneyPill
                                amount={formatPHP(
                                  Number(a.amount ?? a.amount_this_cutoff ?? 0),
                                )}
                                kind="EARNING"
                              />
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </Section>

                    {/* Retro Pay */}
                    <Section
                      title="Retro Pay"
                      icon={<Coins className="h-5 w-5" />}
                      right={
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {allRetroEntries.length} item(s)
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            {formatPHP(retroTotal)}
                          </Badge>
                        </div>
                      }
                    >
                      {allRetroEntries.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No retro pay for this cutoff.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {allRetroEntries.map((eIn: unknown) => {
                            const e = eIn as ManualEntry;
                            const desc = entryDesc(e);
                            return (
                              <div
                                key={`retro-${safeId(eIn)}-${String(desc)}`}
                                className={cn(
                                  "flex items-start justify-between gap-3 rounded-2xl border p-3",
                                  "border-amber-200/70 bg-amber-50/20",
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate text-sm font-semibold">
                                      {desc || "Retro Pay"}
                                    </div>
                                  </div>
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    <span className="font-mono">
                                      Retro ID:{" "}
                                      {String((e as unknown as Record<string, unknown>)?.retro_id ?? (e as unknown as Record<string, unknown>)?.id ?? "—")}
                                    </span>
                                  </div>
                                </div>

                                <MoneyPill
                                  amount={formatEntryAmount(e)}
                                  kind="EARNING"
                                  accent="retro"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Section>

                    {/* Manual Additions */}
                    <Section
                      title="Manual Additions"
                      icon={<BadgePercent className="h-5 w-5" />}
                      right={
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {nonRetroEarningEntries.length} item(s)
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            {formatPHP(manualAddsTotal)}
                          </Badge>
                        </div>
                      }
                    >
                      {nonRetroEarningEntries.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No manual additions for this cutoff.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {nonRetroEarningEntries.map((eIn: unknown) => {
                            const e = eIn as ManualEntry;
                            const desc = entryDesc(e);
                            return (
                              <div
                                key={`addonly-${safeId(eIn)}-${String(desc)}`}
                                className="flex items-start justify-between gap-3 rounded-2xl border bg-muted/10 p-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate text-sm font-semibold">
                                      {desc || "Addition"}
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      Earning Adjustment
                                    </Badge>
                                  </div>
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    <span className="font-mono">
                                      Ref: {safeId(e)}
                                    </span>
                                  </div>
                                </div>

                                <MoneyPill
                                  amount={formatEntryAmount(e)}
                                  kind="EARNING"
                                  accent="none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Section>
                  </div>
                </TabsContent>

                {/* Manual Adjustments */}
                <TabsContent value="adjustments" className="mt-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">
                          Manual Adjustments
                        </div>
                        <Badge variant="secondary" className="text-[11px]">
                          {entries.length +
                            coopSavingsItemsFromBreakdown.length +
                            retroItemsFromBreakdown.length}{" "}
                          item(s)
                        </Badge>
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px]"
                        >
                          +{formatPHP(additionsTotal)} / -
                          {formatPHP(deductionsAdjTotal)}
                        </Badge>
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Showing only: type, description, amount — totals are
                        grouped per column.
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openAdjust();
                      }}
                      disabled={!line}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {/* ADDITIONS */}
                    <div className="border bg-background">
                      <div className="flex items-center justify-between px-4 py-2">
                        <div className="text-sm font-bold">ADDITIONS</div>
                        <div className="font-mono text-sm font-bold text-emerald-700">
                          {formatPHP(additionsTotal)}
                        </div>
                      </div>

                      <div className="px-4">
                        {additionEntries.length === 0 ? (
                          <div className="py-3 text-sm text-muted-foreground">
                            No additions.
                          </div>
                        ) : (
                          <div>
                            {additionEntries.map((e) => (
                              <MinimalAdjustmentRow
                                key={`earn-flat-${safeId(e)}-${entryDesc(e)}`}
                                entry={e}
                                onEdit={onEditEntry}
                                onDelete={onDeleteEntry}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Total Additions
                        </span>
                        <span className="font-mono text-sm font-bold text-emerald-700">
                          {formatPHP(additionsTotal)}
                        </span>
                      </div>
                    </div>

                    {/* DEDUCTIONS */}
                    <div className="border bg-background">
                      <div className="flex items-center justify-between px-4 py-2">
                        <div className="text-sm font-bold">DEDUCTIONS</div>
                        <div className="font-mono text-sm font-bold text-destructive">
                          {formatPHP(deductionsAdjTotal)}
                        </div>
                      </div>

                      <div className="px-4">
                        {allDeductionEntries.length === 0 ? (
                          <div className="py-3 text-sm text-muted-foreground">
                            No deductions.
                          </div>
                        ) : (
                          <div>
                            {allDeductionEntries.map((e) => (
                              <MinimalAdjustmentRow
                                key={`ded-flat-${safeId(e)}-${entryDesc(e)}`}
                                entry={e}
                                onEdit={onEditEntry}
                                onDelete={onDeleteEntry}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Total Deductions
                        </span>
                        <span className="font-mono text-sm font-bold text-destructive">
                          {formatPHP(deductionsAdjTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-background px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Totals:{" "}
                <span className="font-mono font-semibold">
                  Gross {totalsGross}
                </span>{" "}
                •{" "}
                <span className="font-mono font-semibold text-destructive">
                  Deductions {totalsDed}
                </span>{" "}
                •{" "}
                <span className="font-mono font-semibold">Net {totalsNet}</span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openAdjust();
                  }}
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

export default EmployeeDetailsSheet;
