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
  Receipt,
  PiggyBank,
  BadgePercent,
  Clock,
  CalendarDays,
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
    e?.type_kind ??
    e?.typeKind ??
    e?.kind ??
    null;

  if (cat != null && String(cat).trim() !== "") return upper(cat);

  const t = upper(e?.type);
  if (t && t !== "EARNING" && t !== "DEDUCTION") return t;

  return "";
}

function readAmount(e: any): number {
  const v = e?.amount ?? e?.amount_paid ?? e?.amountPaid ?? 0;
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatEntryAmount(e: ManualEntry) {
  const amt = readAmount(e as any);
  if (upper((e as any)?.type) === "DEDUCTION") return `(${formatPHP(amt)})`;
  return formatPHP(amt);
}

function safeId(e: any) {
  const id =
    e?.id ??
    e?.retro_id ??
    e?.retroId ??
    e?.dr_payment_id ??
    e?.drPaymentId ??
    e?.coop_savings_membership_id ??
    e?.coopSavingsMembershipId ??
    e?.savings_id ??
    e?.savingsId ??
    null;

  return id == null ? "noid" : String(id);
}

function extractDrReceiptNo(desc: string): string {
  const s = String(desc ?? "").trim();
  const prefix = /^DR\s*PAYMENT\s*:\s*/i;
  return s.replace(prefix, "").trim();
}

function entryDesc(e: any): string {
  // ✅ DR FIRST: never return raw "DR PAYMENT: ..." desc
  if (isDRPaymentEntry(e)) {
    const drNo = drReceiptNoFromEntry(e); // already strips prefix via extractDrReceiptNo()
    return drNo ? drNo : "DR Payment";
  }

  const d = e?.desc ?? e?.description ?? "";
  if (String(d).trim()) return String(d);

  if (isShortageEntry(e)) return "Shortage";
  if (isRetroPayEntry(e)) return "Retro Pay";
  if (isSavingsEntry(e)) return "Savings";

  return "";
}

// ===== Itemized detectors =====
function isDRPaymentEntry(e: any): boolean {
  const cat = entryCategory(e);
  if (cat === "DR_PAYMENT") return true;

  if (e?.dr_payment_id != null) return true;
  if (e?.delivery_receipt_number) return true;

  if (upper(e?.source) === "DR_PAYMENT" || upper(e?.source) === "DR")
    return true;

  const desc = String(e?.desc ?? e?.description ?? "");
  if (/^DR\s*PAYMENT\s*:/i.test(desc)) return true;

  return false;
}

function isShortageEntry(e: any): boolean {
  const cat = entryCategory(e);
  if (cat === "SHORTAGE") return true;

  const desc = String(e?.desc ?? e?.description ?? "").toLowerCase();
  return desc.includes("shortage");
}

function isRetroPayEntry(e: any): boolean {
  const cat = entryCategory(e);
  if (cat === "RETRO_PAY" || cat === "RETROPAY") return true;

  if (upper(e?.source) === "RETRO_PAY") return true;

  // Directus row from retro_pay table
  if (e?.retro_id != null || e?.retroId != null) return true;

  const desc = String(e?.desc ?? e?.description ?? "").toLowerCase();
  return desc.includes("retro");
}

function isSavingsEntry(e: any): boolean {
  const cat = entryCategory(e);
  if (cat === "COOP_SAVINGS_MEMBERSHIP" || cat === "SAVINGS") return true;

  if (upper(e?.source) === "COOP_SAVINGS_MEMBERSHIP") return true;

  const desc = String(e?.desc ?? e?.description ?? "").toLowerCase();
  return desc.includes("savings") || desc.includes("coop savings");
}

function drReceiptNoFromEntry(e: any): string {
  if (e?.delivery_receipt_number) return String(e.delivery_receipt_number);
  const desc = String(e?.desc ?? e?.description ?? "");
  const fromDesc = extractDrReceiptNo(desc);
  return fromDesc || "";
}

function drPaymentDateFromEntry(e: any): string {
  const v =
    e?.payment_date ??
    e?.paymentDate ??
    e?.meta?.payment_date ??
    e?.meta?.paymentDate ??
    "";
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function drPaymentMethodFromEntry(e: any): string {
  const v =
    e?.payment_method ??
    e?.paymentMethod ??
    e?.meta?.payment_method ??
    e?.meta?.paymentMethod ??
    "";
  return String(v ?? "").trim();
}

function drPostedFromEntry(e: any): boolean {
  const v =
    e?.is_posted_to_payroll ??
    e?.isPostedToPayroll ??
    e?.meta?.is_posted_to_payroll ??
    e?.meta?.isPostedToPayroll ??
    0;
  return Boolean(Number(v) === 1 || v === true);
}

function resolvePayrollId(line: PayrollComputedLine | null): string {
  const v =
    (line as any)?.payroll_run_employee_id ??
    (line as any)?.payrollRunEmployeeId ??
    (line as any)?.pre_id ??
    (line as any)?.id ??
    "";
  const s = String(v ?? "").trim();
  return s || "—";
}

function itemizedBadgesForEntry(e: any) {
  const out: Array<{
    label: string;
    variant?: "secondary" | "outline" | "destructive" | "default";
  }> = [];

  if (isDRPaymentEntry(e))
    out.push({ label: "DR_PAYMENT", variant: "secondary" });
  if (isShortageEntry(e)) out.push({ label: "SHORTAGE", variant: "secondary" });
  if (isRetroPayEntry(e))
    out.push({ label: "RETRO_PAY", variant: "secondary" });
  if (isSavingsEntry(e))
    out.push({ label: "COOP_SAVINGS_MEMBERSHIP", variant: "secondary" });

  return out;
}

function prettyPayCycle(v: any) {
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
      <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 px-2.5 py-1 font-mono text-xs tabular-nums text-blue-800">
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
function normalizeEntry(e: any): any {
  if (!e || typeof e !== "object") return e;

  const retroId = e?.retro_id ?? e?.retroId ?? null;
  const drId = e?.dr_payment_id ?? e?.drPaymentId ?? null;
  const coopId = e?.source_id ?? e?.sourceId ?? null;

  if (isRetroPayEntry(e) && retroId != null) {
    return { ...e, __source: "RETRO", id: Number(retroId), type: "EARNING" };
  }
  if (isDRPaymentEntry(e) && drId != null) {
    return { ...e, __source: "DR", id: Number(drId), type: "DEDUCTION" };
  }
  if (isSavingsEntry(e) && coopId != null) {
    return { ...e, __source: "COOP", id: Number(coopId), type: "DEDUCTION" };
  }

  const t = upper(e?.type);
  if (t === "EARNING")
    return { ...e, __source: "ADD", id: Number(e?.id ?? 0) || e?.id };
  if (t === "DEDUCTION")
    return { ...e, __source: "DED", id: Number(e?.id ?? 0) || e?.id };

  // fallback
  return { ...e, __source: e?.__source ?? undefined };
}

/** ✅ Holiday label helper (handles Holiday + Rest Day) */
function holidayItemLabel(h: any): string {
  const flag = String(h?.holiday ?? "").toUpperCase();
  const base =
    flag === "REGULAR"
      ? "Regular Holiday"
      : flag === "SPECIAL"
        ? "Special Holiday"
        : "Holiday";

  const isRest = Boolean(h?.is_rest_day);
  const desc = String(h?.description ?? "").trim();

  return `${base}${isRest ? " + Rest Day" : ""}${desc ? ` · ${desc}` : ""}`;
}

function MinimalAdjustmentRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: ManualEntry;
  onEdit: (e: ManualEntry) => void;
  onDelete: (e: ManualEntry) => void;
}) {
  const e: any = normalizeEntry(entry as any);

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

  const disableEditDelete = isDR && drPostedFromEntry(e);

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
              disableEditDelete ? "Cannot edit posted DR payments" : "Edit"
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
              disableEditDelete ? "Cannot delete posted DR payments" : "Delete"
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
  onOpenAdjust,
  onEditEntry,
  onDeleteEntry,
  onOpenChange,
}: {
  open: boolean;
  line: PayrollComputedLine | null;
  manualEntries: ManualEntry[];

  onOpenAdjust?: (() => void) | null;

  onEditEntry: (entry: ManualEntry) => void;
  onDeleteEntry: (entry: ManualEntry) => void;

  onOpenChange: (v: boolean) => void;
}) {
  const allowanceItems =
    ((line as any)?.breakdown_json?.earnings?.allowance_items as any[]) ?? [];

  const coopSavingsItemsFromBreakdown =
    ((line as any)?.breakdown_json?.deductions?.coop_savings_items as any[]) ??
    [];

  const retroItemsFromBreakdown =
    ((line as any)?.breakdown_json?.earnings?.retro_items as any[]) ?? [];

  // ✅ Holiday itemization from compute.ts
  const holidayItems =
    ((line as any)?.breakdown_json?.earnings?.holiday_items as any[]) ?? [];

  const holidayPaidItems = holidayItems.filter(
    (x: any) => Number(x?.total ?? 0) > 0,
  );

  const [holidayOpen, setHolidayOpen] = React.useState(false);

  const rawEntries = Array.isArray(manualEntries) ? manualEntries : [];
  const entries = rawEntries.map((e) => normalizeEntry(e));

  const retroEntries = entries.filter((e) => isRetroPayEntry(e as any));
  const savingsEntries = entries.filter((e) => isSavingsEntry(e as any));

  const allRetroEntries = [
    ...retroEntries,
    ...retroItemsFromBreakdown.map((item: any) => ({
      ...item,
      retro_id: item.source_id ?? item.retro_id ?? item.id,
      amount: item.amount,
      description: item.description ?? item.label,
      type: "EARNING",
      __source: "RETRO",
    })),
  ];

  const allSavingsEntries = [
    ...savingsEntries,
    ...coopSavingsItemsFromBreakdown.map((item: any) => ({
      ...item,
      id: item.source_id ?? item.id,
      amount: item.amount,
      description: item.description ?? item.label ?? "COOP Savings Membership",
      type: "DEDUCTION",
      category: "COOP_SAVINGS_MEMBERSHIP",
      __source: "COOP",
    })),
  ];

  const nonRetroEarningEntries = entries.filter((e) => {
    const t = upper((e as any)?.type);
    if (t === "EARNING" && !isRetroPayEntry(e as any)) return true;
    return false;
  });

  const deductionEntries = entries.filter((e) => {
    const t = upper((e as any)?.type);
    if (t === "DEDUCTION") return true;
    if (isDRPaymentEntry(e as any)) return true;
    if (isShortageEntry(e as any)) return true;
    if (isSavingsEntry(e as any)) return true;
    return false;
  });

  const allDeductionEntries = [...deductionEntries, ...allSavingsEntries].filter(
    (e) => !isSavingsEntry(e as any),
  );

  const retroTotal = allRetroEntries.reduce(
    (sum, e) => sum + readAmount(e as any),
    0,
  );

  const manualAddsTotal = nonRetroEarningEntries.reduce(
    (sum, e) => sum + readAmount(e as any),
    0,
  );

  const savingsTotal = allSavingsEntries.reduce(
    (sum, e) => sum + readAmount(e as any),
    0,
  );

  const allowancesTotal = allowanceItems.reduce(
    (sum: number, a: any) => sum + Number(a?.amount_this_cutoff ?? 0),
    0,
  );

  const additionEntries = [...allRetroEntries, ...nonRetroEarningEntries];
  const additionsTotal = additionEntries.reduce(
    (sum, e) => sum + readAmount(e as any),
    0,
  );

  const deductionsAdjTotal = allDeductionEntries.reduce(
    (sum, e) => sum + readAmount(e as any),
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
                    disabled={!line}
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
              <Tabs defaultValue="adjustments">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="itemizations">
                    Earnings Itemization
                  </TabsTrigger>
                  <TabsTrigger value="adjustments">
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
                                  <div className="space-y-2 pl-6">
                                    {holidayItems.map((h: any, idx: number) => {
                                      const total = Number(h?.total ?? 0);
                                      const isZero = !(total > 0);
                                      return (
                                        <div
                                          key={`hol-${h?.date ?? idx}-${idx}`}
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
                                                    {Number(
                                                      h.base_mult,
                                                    ).toFixed(2)}
                                                  </span>
                                                </>
                                              ) : null}
                                              {h?.ot_mult != null ? (
                                                <>
                                                  {" "}
                                                  •{" "}
                                                  <span className="font-mono">
                                                    OT x
                                                    {Number(h.ot_mult).toFixed(
                                                      2,
                                                    )}
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
                                            {formatPHP(total)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </CollapsibleContent>
                            </Collapsible>

                            <Row
                              label="Rest Day Amount"
                              value={formatPHP(line?.rest_day_amount ?? 0)}
                            />
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
                            value={formatPHP((line as any)?.dr_deduction ?? 0)}
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
                          {allowanceItems.map((a: any) => (
                            <div
                              key={String(a.allowance_id)}
                              className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/10 p-3"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">
                                  {a.description ||
                                    `Allowance #${a.allowance_id}`}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {prettyPayCycle(a.pay_cycle)}
                                  </Badge>
                                  {a.allowance_id != null ? (
                                    <span className="font-mono">
                                      ID: {String(a.allowance_id)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <MoneyPill
                                amount={formatPHP(
                                  Number(a.amount_this_cutoff ?? 0),
                                )}
                                kind="EARNING"
                              />
                            </div>
                          ))}
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
                          {allRetroEntries.map((e: any) => {
                            const desc = entryDesc(e);
                            return (
                              <div
                                key={`retro-${safeId(e)}-${String(desc)}`}
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
                                      {String(e?.retro_id ?? e?.id ?? "—")}
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
                          {nonRetroEarningEntries.map((e: any) => {
                            const desc = entryDesc(e);
                            return (
                              <div
                                key={`addonly-${safeId(e)}-${String(desc)}`}
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
                                key={`earn-flat-${safeId(e)}-${entryDesc(e as any)}`}
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
                                key={`ded-flat-${safeId(e)}-${entryDesc(e as any)}`}
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
