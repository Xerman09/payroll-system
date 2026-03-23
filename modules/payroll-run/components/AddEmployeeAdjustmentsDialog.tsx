// modules/payroll-run/components/AddEmployeeAdjustmentsDialog.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  createDRPayment,
  createOtherAddition,
  createOtherDeduction,
  createRetroPay,
  updateDRPayment,
  updateOtherAddition,
  updateOtherDeduction,
  updateRetroPay,
  type PayrollOtherDeductionType,
} from "../providers/payrollAdjustmentsService";

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
type DeductionTab = "MANUAL" | "SHORTAGE" | "DR_PAYMENT";
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
  const [amount, setAmount] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");

  // DR payment fields
  const [drNo, setDrNo] = React.useState<string>("");
  const [drPaymentDate, setDrPaymentDate] = React.useState<string>(todayISO());
  const [drAmountPaid, setDrAmountPaid] = React.useState<string>("");
  const [drRemarks, setDrRemarks] = React.useState<string>("");

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
        setDedTab((editingEntry.other_deduction_type as DeductionTab) || "MANUAL");
        setAmount(String(editingEntry.amount || ""));
        setDescription(editingEntry.desc || "");
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

      // Manual / Shortage -> payroll_other_deductions
      const amt = num(amount);
      if (amt <= 0) throw new Error("Amount must be greater than 0.");

      const t: PayrollOtherDeductionType = dedTab;

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
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="MANUAL">Manual</TabsTrigger>
                    <TabsTrigger value="SHORTAGE">Shortage</TabsTrigger>
                    <TabsTrigger value="DR_PAYMENT">Stock Purchase</TabsTrigger>
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
