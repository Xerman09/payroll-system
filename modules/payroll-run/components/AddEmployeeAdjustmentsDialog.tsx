// modules/payroll-run/components/AddEmployeeAdjustmentsDialog.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";

import {
  createDRPayment,
  createMultiCutoffDeductions,
  createOtherAddition,
  createOtherDeduction,
  createRetroPay,
  resolveUpcomingCutoffs,
  updateDRPayment,
  updateOtherAddition,
  updateOtherDeduction,
  updateRetroPay,
  type PayrollOtherDeductionType,
} from "../providers/payrollAdjustmentsService";
import { formatPHP } from "../utils/compute";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Kind = "ADDITION" | "DEDUCTION";
type DeductionTab = "MANUAL" | "SHORTAGE" | "DR_PAYMENT" | "INSTALLMENT";
type AdditionTab = "MANUAL_ADDITION" | "RETRO_PAY";

// Extended entry with metadata for identifying source and ID during edit
export type ManualEntryExt = {
  id?: number | string;
  __source?: "ADD" | "DED" | "DR" | "RETRO" | "COOP";
  amount: number;
  desc: string;
  type: "EARNING" | "DEDUCTION";
  category?: string;
  other_deduction_type?: string; // added this
  description?: string | null;
  delivery_receipt_number?: string | null;
  payment_date?: string | null;
  amount_paid?: number | null;
  remarks?: string | null;
  [k: string]: unknown;
};

function num(v: string) {
  const n = Number(
    String(v ?? "")
      .replaceAll(",", "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function safeFormatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const parts = d.substring(0, 10).split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return format(new Date(parts[0], parts[1] - 1, parts[2]), "MMM dd, yyyy");
    }
    return format(new Date(d), "MMM dd, yyyy");
  } catch {
    return d.substring(0, 10);
  }
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function AddEmployeeAdjustmentsDialog({
  open,
  onOpenChange,
  userId,
  cutoffStart,
  cutoffEnd,
  createdBy,
  editingEntry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  userId: number;
  cutoffStart: string;
  cutoffEnd: string;

  createdBy?: number | null;

  editingEntry?: ManualEntryExt | null;
  onSaved?: () => void;
}) {
  const [saving, setSaving] = React.useState(false);

  const [kind, setKind] = React.useState<Kind>("DEDUCTION");
  const [dedTab, setDedTab] = React.useState<DeductionTab>("MANUAL");
  const [addTab, setAddTab] = React.useState<AdditionTab>("MANUAL_ADDITION");

  // common/manual fields
  const [amount, setAmount] = React.useState<string>("" );
  const [description, setDescription] = React.useState<string>("");

  // DR payment fields
  const [drNo, setDrNo] = React.useState<string>("");
  const [drPaymentDate, setDrPaymentDate] = React.useState<string>(todayISO());
  const [drAmountPaid, setDrAmountPaid] = React.useState<string>("");
  const [drRemarks, setDrRemarks] = React.useState<string>("");

  // Multi-cutoff installment deduction fields
  const [instTotalAmount, setInstTotalAmount] = React.useState<string>("");
  const [instCutoffAmount, setInstCutoffAmount] = React.useState<string>("");
  const [instCutoffs, setInstCutoffs] = React.useState<string>("6");
  const [instDesc, setInstDesc] = React.useState<string>("");
  const [instSchedule, setInstSchedule] = React.useState<
    Array<{ start_date: string; end_date: string; label?: string }>
  >([]);
  const [loadingSchedule, setLoadingSchedule] = React.useState<boolean>(false);

  const handleTotalAmountChange = (val: string) => {
    setInstTotalAmount(val);
    const total = num(val);
    const count = Math.max(1, Math.floor(num(instCutoffs)) || 1);
    if (total > 0 && count > 0) {
      setInstCutoffAmount((Math.round((total / count) * 100) / 100).toFixed(2));
    } else {
      setInstCutoffAmount("");
    }
  };

  const handleCutoffsChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    setInstCutoffs(clean);
    const count = Math.max(1, Math.floor(num(clean)) || 1);
    const total = num(instTotalAmount);
    if (total > 0 && count > 0) {
      setInstCutoffAmount((Math.round((total / count) * 100) / 100).toFixed(2));
    } else if (num(instCutoffAmount) > 0) {
      const perCutoff = num(instCutoffAmount);
      setInstTotalAmount((Math.round(perCutoff * count * 100) / 100).toFixed(2));
    }
  };

  const handleCutoffAmountChange = (val: string) => {
    setInstCutoffAmount(val);
    const perCutoff = num(val);
    const count = Math.max(1, Math.floor(num(instCutoffs)) || 1);
    if (perCutoff > 0 && count > 0) {
      setInstTotalAmount((Math.round(perCutoff * count * 100) / 100).toFixed(2));
    }
  };

  // Fetch projected cutoff schedule whenever INSTALLMENT tab is open and number of cutoffs changes
  React.useEffect(() => {
    if (!open || dedTab !== "INSTALLMENT") return;
    const count = Math.min(Math.max(1, Math.floor(num(instCutoffs)) || 1), 60);
    let active = true;
    setLoadingSchedule(true);
    resolveUpcomingCutoffs({
      currentStart: cutoffStart,
      currentEnd: cutoffEnd,
      count,
    })
      .then((sched) => {
        if (active) setInstSchedule(sched);
      })
      .catch((err) => {
        console.warn("Failed to resolve upcoming cutoffs schedule:", err);
      })
      .finally(() => {
        if (active) setLoadingSchedule(false);
      });

    return () => {
      active = false;
    };
  }, [open, dedTab, cutoffStart, cutoffEnd, instCutoffs]);

  React.useEffect(() => {
    if (!open) return;

    if (editingEntry) {
      const src = editingEntry.__source;

      if (src === "RETRO") {
        setKind("ADDITION");
        setAddTab("RETRO_PAY");
        setAmount(String(editingEntry.amount || ""));
        setDescription(editingEntry.desc || "");
      } else if (src === "ADD") {
        setKind("ADDITION");
        setAddTab("MANUAL_ADDITION");
        setAmount(String(editingEntry.amount || ""));
        setDescription(editingEntry.desc || "");
      } else if (src === "DR") {
        setKind("DEDUCTION");
        setDedTab("DR_PAYMENT");
        setDrNo(editingEntry.delivery_receipt_number || "");
        setDrPaymentDate(editingEntry.payment_date || todayISO());
        setDrAmountPaid(String(editingEntry.amount_paid || ""));
        setDrRemarks(editingEntry.remarks || "");
      } else if (src === "DED") {
        setKind("DEDUCTION");
        const match = String(editingEntry.desc || "").match(/\((\d+)\/(\d+)\)/);
        if (match) {
          setDedTab("INSTALLMENT");
          const perCutoff = num(String(editingEntry.amount || ""));
          const count = Math.max(1, parseInt(match[2], 10) || 1);
          setInstCutoffAmount(String(perCutoff));
          setInstCutoffs(String(count));
          setInstTotalAmount(String(Math.round(perCutoff * count * 100) / 100));
          setInstDesc(String(editingEntry.desc || "").replace(/\s*\(\d+\/\d+\)\s*$/, ""));
          setAmount(String(editingEntry.amount || ""));
          setDescription(editingEntry.desc || "");
        } else {
          setDedTab((editingEntry.other_deduction_type as DeductionTab) || "MANUAL");
          setAmount(String(editingEntry.amount || ""));
          setDescription(editingEntry.desc || "");
          setInstTotalAmount("");
          setInstCutoffAmount("");
          setInstCutoffs("6");
          setInstDesc("");
        }
      } else {
        setSaving(false);
        setKind("DEDUCTION");
        setDedTab("MANUAL");
        setAddTab("MANUAL_ADDITION");
        setAmount("");
        setDescription("");
        setDrNo("");
        setDrPaymentDate(todayISO());
        setDrAmountPaid("");
        setDrRemarks("");
        setInstTotalAmount("");
        setInstCutoffAmount("");
        setInstCutoffs("6");
        setInstDesc("");
      }
    } else {
      setSaving(false);
      setKind("DEDUCTION");
      setDedTab("MANUAL");
      setAddTab("MANUAL_ADDITION");
      setAmount("");
      setDescription("");

      setDrNo("");
      setDrPaymentDate(todayISO());
      setDrAmountPaid("");
      setDrRemarks("");
      setInstTotalAmount("");
      setInstCutoffAmount("");
      setInstCutoffs("6");
      setInstDesc("");
    }
  }, [open, editingEntry]);

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);

      const entryId = editingEntry?.id ? (typeof editingEntry.id === "string" ? parseInt(editingEntry.id, 10) : editingEntry.id) : undefined;
      const entrySource = editingEntry?.__source;

      const isEditing = Boolean(editingEntry && entryId && entrySource);

      if (kind === "ADDITION") {
        const amt = num(amount);
        if (amt <= 0) throw new Error("Amount must be greater than 0.");

        // ✅ Retro Pay goes to retro_pay table
        if (addTab === "RETRO_PAY") {
          if (isEditing && entrySource === "RETRO") {
            await updateRetroPay(entryId!, {
              amount: amt,
              description: description.trim() || null,
              created_by: createdBy ?? null,
            });
            toast.success("Retro Pay updated.");
          } else {
            await createRetroPay({
              user_id: userId,
              amount: amt,
              description: description.trim() || null,
              cutoff_start: cutoffStart,
              cutoff_end: cutoffEnd,
              created_by: createdBy ?? null,
            });
            toast.success("Retro Pay saved.");
          }

          onSaved?.();
          onOpenChange(false);
          return;
        }

        // ✅ Normal manual addition goes to payroll_other_additions
        if (isEditing && entrySource === "ADD") {
          await updateOtherAddition(entryId!, {
            amount: amt,
            description: description.trim() || null,
            created_by: createdBy ?? null,
          });
          toast.success("Addition updated.");
        } else {
          await createOtherAddition({
            user_id: userId,
            amount: amt,
            description: description.trim() || null,
            cutoff_start: cutoffStart,
            cutoff_end: cutoffEnd,
            created_by: createdBy ?? null,
          });
          toast.success("Addition saved.");
        }

        onSaved?.();
        onOpenChange(false);
        return;
      }

      // kind === DEDUCTION
      if (dedTab === "DR_PAYMENT") {
        const paid = num(drAmountPaid);
        if (!drNo.trim()) throw new Error("Delivery Receipt No. is required.");
        if (!drPaymentDate.trim()) throw new Error("Payment Date is required.");
        if (paid <= 0) throw new Error("Amount Paid must be greater than 0.");

        if (isEditing && entrySource === "DR") {
          await updateDRPayment(entryId!, {
            delivery_receipt_number: drNo.trim(),
            payment_date: drPaymentDate,
            amount_paid: paid,
            remarks: drRemarks.trim() || null,
            created_by: createdBy ?? null,
          });
          toast.success("Stock purchase (DR Payment) updated.");
        } else {
          await createDRPayment({
            employee_id: userId,
            cutoff_from: cutoffStart,
            cutoff_to: cutoffEnd,
            delivery_receipt_number: drNo.trim(),
            payment_date: drPaymentDate,
            amount_paid: paid,
            payment_method: "PAYROLL_DEDUCTION",
            remarks: drRemarks.trim() || null,
            created_by: createdBy ?? null,
          });
          toast.success("Stock purchase (DR Payment) saved.");
        }

        onSaved?.();
        onOpenChange(false);
        return;
      }

      // Multi-Cutoff Installment Deduction -> scheduled across upcoming cutoffs
      if (dedTab === "INSTALLMENT") {
        const totalAmt = num(instTotalAmount);
        const count = Math.max(1, Math.floor(num(instCutoffs)) || 1);
        const perCutoffAmt =
          num(instCutoffAmount) > 0
            ? num(instCutoffAmount)
            : totalAmt > 0
              ? Math.round((totalAmt / count) * 100) / 100
              : 0;

        if (totalAmt <= 0 && perCutoffAmt <= 0) {
          throw new Error("Total deduction amount must be greater than 0.");
        }
        if (count < 1) {
          throw new Error("Number of cutoffs must be at least 1.");
        }
        if (!instDesc.trim()) {
          throw new Error("Description is required for multi-cutoff deduction.");
        }

        if (isEditing && entrySource === "DED") {
          await updateOtherDeduction(entryId!, {
            amount: perCutoffAmt,
            type: "MANUAL",
            description: instDesc.trim(),
            created_by: createdBy ?? null,
          });
          toast.success("Deduction updated.");
        } else {
          await createMultiCutoffDeductions({
            user_id: userId,
            total_amount: totalAmt > 0 ? totalAmt : perCutoffAmt * count,
            amount_per_cutoff: perCutoffAmt,
            num_cutoffs: count,
            description: instDesc.trim(),
            start_cutoff_start: cutoffStart,
            start_cutoff_end: cutoffEnd,
            created_by: createdBy ?? null,
          });
          toast.success(`Deduction scheduled across ${count} cutoff${count > 1 ? "s" : ""}.`);
        }

        onSaved?.();
        onOpenChange(false);
        return;
      }

      // Manual / Shortage -> payroll_other_deductions
      const amt = num(amount);
      if (amt <= 0) throw new Error("Amount must be greater than 0.");

      const t: PayrollOtherDeductionType = dedTab === "SHORTAGE" ? "SHORTAGE" : "MANUAL";

      if (isEditing && entrySource === "DED") {
        await updateOtherDeduction(entryId!, {
          amount: amt,
          type: t,
          description: description.trim() || null,
          created_by: createdBy ?? null,
        });
        toast.success("Deduction updated.");
      } else {
        await createOtherDeduction({
          user_id: userId,
          amount: amt,
          type: t,
          description: description.trim() || null,
          cutoff_start: cutoffStart,
          cutoff_end: cutoffEnd,
          created_by: createdBy ?? null,
        });
        toast.success("Deduction saved.");
      }

      onSaved?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      toast.error((e?.message as string) || "Failed to save adjustment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {editingEntry ? "Edit Adjustment" : "Add Adjustment"}
          </DialogTitle>
          <DialogDescription>
            Saved to the database for the selected employee and cutoff.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* KIND */}
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger>
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEDUCTION">Deduction</SelectItem>
                <SelectItem value="ADDITION">Addition</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "ADDITION" ? (
            <>
              <div className="space-y-2">
                <Label>Addition Category</Label>

                <Tabs
                  value={addTab}
                  onValueChange={(v) => setAddTab(v as AdditionTab)}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="MANUAL_ADDITION">
                      Manual Addition
                    </TabsTrigger>
                    <TabsTrigger value="RETRO_PAY">Retro Pay</TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="MANUAL_ADDITION"
                    className="mt-4 space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Optional notes / reference"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="RETRO_PAY" className="mt-4 space-y-4">
                    <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                      This will create a row in <code>retro_pay</code> and will
                      be included in payroll computation for this cutoff.
                    </div>

                    <div className="space-y-2">
                      <Label>Retro Amount</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Optional notes / reference"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : (
            <>
              {/* DEDUCTION TABS */}
              <div className="space-y-2">
                <Label>Deduction Category</Label>

                <Tabs
                  value={dedTab}
                  onValueChange={(v) => setDedTab(v as DeductionTab)}
                >
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="MANUAL">Manual</TabsTrigger>
                    <TabsTrigger value="SHORTAGE">Shortage</TabsTrigger>
                    <TabsTrigger value="DR_PAYMENT">Stock Purchase</TabsTrigger>
                    <TabsTrigger value="INSTALLMENT">Multi-Cutoff</TabsTrigger>
                  </TabsList>

                  <TabsContent value="MANUAL" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Optional notes / reference"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="SHORTAGE" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Optional notes / reference"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </TabsContent>

                  {/* MULTI-CUTOFF INSTALLMENT DEDUCTION */}
                  <TabsContent value="INSTALLMENT" className="mt-4 space-y-4">
                    <div className="rounded-lg border border-blue-200/60 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-200">
                      <p className="font-semibold mb-0.5">Loan-Style Multi-Cutoff Deduction</p>
                      <p className="text-muted-foreground dark:text-blue-300">
                        Enter the total deduction amount and select how many cutoffs to pay.
                        The system will automatically compute the per-cutoff deduction and cut down the balance across each cutoff.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Total Deduction Amount */}
                      <div className="space-y-2">
                        <Label>Total Deduction Amount (₱)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="e.g. 10000.00"
                          value={instTotalAmount}
                          onChange={(e) => handleTotalAmountChange(e.target.value)}
                        />
                      </div>

                      {/* Number of Cutoffs */}
                      <div className="space-y-2">
                        <Label>Number of Cutoffs</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="e.g. 6"
                          value={instCutoffs}
                          onChange={(e) => handleCutoffsChange(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Quick Terms selector */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground mr-1">Quick cutoffs:</span>
                      {[
                        { label: "2 cutoffs (1 mo)", val: "2" },
                        { label: "4 cutoffs (2 mos)", val: "4" },
                        { label: "6 cutoffs (3 mos)", val: "6" },
                        { label: "12 cutoffs (6 mos)", val: "12" },
                        { label: "24 cutoffs (1 yr)", val: "24" },
                      ].map((pill) => (
                        <Button
                          key={pill.val}
                          type="button"
                          size="sm"
                          variant={instCutoffs === pill.val ? "default" : "outline"}
                          className="h-6 px-2 text-[11px]"
                          onClick={() => handleCutoffsChange(pill.val)}
                        >
                          {pill.label}
                        </Button>
                      ))}
                    </div>

                    {/* Computed Deduction per Cutoff */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Deduction per Cutoff (₱)</Label>
                        <span className="text-[11px] text-muted-foreground">Auto-calculated</span>
                      </div>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={instCutoffAmount}
                        onChange={(e) => handleCutoffAmountChange(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description / Reason</Label>
                      <Textarea
                        placeholder="e.g. Tool deduction, Cash advance, Company uniform, Loan amort..."
                        value={instDesc}
                        onChange={(e) => setInstDesc(e.target.value)}
                      />
                    </div>

                    {/* Summary & Live Amortization Schedule Preview */}
                    {(num(instTotalAmount) > 0 || num(instCutoffAmount) > 0) &&
                    Math.max(1, Math.floor(num(instCutoffs)) || 1) > 0 ? (
                      (() => {
                        const count = Math.max(1, Math.floor(num(instCutoffs)) || 1);
                        const total =
                          num(instTotalAmount) > 0
                            ? num(instTotalAmount)
                            : num(instCutoffAmount) * count;
                        const perCutoff =
                          num(instCutoffAmount) > 0
                            ? num(instCutoffAmount)
                            : Math.round((total / count) * 100) / 100;

                        return (
                          <div className="rounded-xl border bg-card p-3.5 shadow-sm space-y-2.5">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Amortization Summary
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-2">
                                <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                                  Total Deduction
                                </div>
                                <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                                  {formatPHP(total)}
                                </div>
                              </div>
                              <div className="rounded-lg bg-muted/40 p-2">
                                <div className="text-[11px] text-muted-foreground">
                                  Duration
                                </div>
                                <div className="text-sm font-bold text-foreground mt-0.5">
                                  {count} Cutoffs
                                </div>
                              </div>
                              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-2">
                                <div className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                  Per Cutoff
                                </div>
                                <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                                  {formatPHP(perCutoff)}
                                </div>
                              </div>
                            </div>

                            {/* Cutdown Schedule like in a Loan */}
                            {instSchedule.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t">
                                <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                                  <span>Cutdown Schedule ({instSchedule.length} cutoffs)</span>
                                  {loadingSchedule ? (
                                    <span className="text-[10px]">Loading…</span>
                                  ) : null}
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                  {(() => {
                                    let runningBalance = total;
                                    const standardAmort = Math.round((total / count) * 100) / 100;
                                    return instSchedule.map((cs, idx) => {
                                      const isLast = idx === instSchedule.length - 1;
                                      const deductThis = isLast
                                        ? Math.round(runningBalance * 100) / 100
                                        : standardAmort;
                                      const balanceAfter = Math.max(0, Math.round((runningBalance - deductThis) * 100) / 100);
                                      runningBalance = balanceAfter;

                                      return (
                                        <div
                                          key={`${cs.start_date}-${idx}`}
                                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/30"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-[10px] text-muted-foreground w-4">
                                              #{idx + 1}
                                            </span>
                                            <span className="font-medium">
                                              {safeFormatDate(cs.start_date)} –{" "}
                                              {safeFormatDate(cs.end_date)}
                                            </span>
                                            {idx === 0 ? (
                                              <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 px-1.5 py-0.2 rounded font-medium">
                                                Current
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                              -{formatPHP(deductThis)}
                                            </span>
                                            <span className="font-mono text-[11px] text-muted-foreground">
                                              Bal: {formatPHP(balanceAfter)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : null}
                  </TabsContent>

                  {/* DR PAYMENT FIELDS */}
                  <TabsContent value="DR_PAYMENT" className="mt-4 space-y-4">
                    <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                      This will create a row in <code>dr_payment</code> with
                      payment_method set to <code>PAYROLL_DEDUCTION</code>, and
                      will be included in payroll computation for this cutoff.
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Delivery Receipt No.</Label>
                        <Input
                          placeholder="e.g. DAW12312"
                          value={drNo}
                          onChange={(e) => setDrNo(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Payment Date</Label>
                        <Input
                          type="date"
                          value={drPaymentDate}
                          onChange={(e) => setDrPaymentDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Amount Paid</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={drAmountPaid}
                          onChange={(e) => setDrAmountPaid(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Input value="PAYROLL_DEDUCTION" disabled />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Textarea
                        placeholder="Optional remarks"
                        value={drRemarks}
                        onChange={(e) => setDrRemarks(e.target.value)}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                onOpenChange(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingEntry ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
