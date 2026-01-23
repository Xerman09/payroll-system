// modules/payroll-run/components/AddEmployeeAdjustmentsDialog.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  createDRPayment,
  createOtherAddition,
  createOtherDeduction,
  updateDRPayment,
  updateOtherAddition,
  updateOtherDeduction,
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

// Extended entry with metadata for identifying source and ID during edit
export type ManualEntryExt = any & {
  id?: number | string;
  __source?: "ADD" | "DED" | "DR"; // ADD = other_addition, DED = other_deduction, DR = dr_payment
  [k: string]: any;
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

  // employee/user scope
  userId: number;

  // cutoff scope
  cutoffStart: string; // YYYY-MM-DD
  cutoffEnd: string; // YYYY-MM-DD

  // audit
  createdBy?: number | null;

  // edit mode: if provided, dialog is in edit mode for this entry
  editingEntry?: ManualEntryExt | null;

  // refresh parent after save
  onSaved?: () => void;
}) {
  const [saving, setSaving] = React.useState(false);

  const [kind, setKind] = React.useState<Kind>("DEDUCTION");
  const [dedTab, setDedTab] = React.useState<DeductionTab>("MANUAL");

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
      // Load editing entry data
      const src = (editingEntry as any)?.__source as
        | "ADD"
        | "DED"
        | "DR"
        | undefined;

      if (src === "ADD") {
        setKind("ADDITION");
        setAmount(String(editingEntry.amount || ""));
        setDescription(editingEntry.description || "");
      } else if (src === "DR") {
        setKind("DEDUCTION");
        setDedTab("DR_PAYMENT");
        setDrNo(editingEntry.delivery_receipt_number || "");
        setDrPaymentDate(editingEntry.payment_date || todayISO());
        setDrAmountPaid(String(editingEntry.amount_paid || ""));
        setDrRemarks(editingEntry.remarks || "");
      } else if (src === "DED") {
        setKind("DEDUCTION");
        setDedTab(editingEntry.type || "MANUAL");
        setAmount(String(editingEntry.amount || ""));
        setDescription(editingEntry.description || "");
      } else {
        // Fallback: reset if source unknown
        setSaving(false);
        setKind("DEDUCTION");
        setDedTab("MANUAL");
        setAmount("");
        setDescription("");
        setDrNo("");
        setDrPaymentDate(todayISO());
        setDrAmountPaid("");
        setDrRemarks("");
      }
    } else {
      // reset minimal state per open (new entry)
      setSaving(false);
      setKind("DEDUCTION");
      setDedTab("MANUAL");
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
      const entryId = (editingEntry as any)?.id as number | undefined;
      const entrySource = (editingEntry as any)?.__source as
        | "ADD"
        | "DED"
        | "DR"
        | undefined;
      const isEditing = editingEntry && entryId && entrySource;

      if (kind === "ADDITION") {
        const amt = num(amount);
        if (amt <= 0) throw new Error("Amount must be greater than 0.");

        if (isEditing && entrySource === "ADD") {
          // Update existing addition
          await updateOtherAddition(entryId, {
            amount: amt,
            description: description.trim() || null,
          });
          toast.success("Addition updated.");
        } else {
          // Create new addition
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
          // Update existing DR payment
          await updateDRPayment(entryId, {
            delivery_receipt_number: drNo.trim(),
            payment_date: drPaymentDate,
            amount_paid: paid,
            remarks: drRemarks.trim() || null,
          });
          toast.success("Stock purchase (DR Payment) updated.");
        } else {
          // Create new DR payment
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

      const t: PayrollOtherDeductionType = dedTab; // "MANUAL" | "SHORTAGE"

      if (isEditing && entrySource === "DED") {
        // Update existing deduction
        await updateOtherDeduction(entryId, {
          amount: amt,
          type: t,
          description: description.trim() || null,
        });
        toast.success("Deduction updated.");
      } else {
        // Create new deduction
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
    } catch (err: any) {
      toast.error(err?.message || "Failed to save adjustment.");
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

                  {/* DR PAYMENT FIELDS (aligned to dr_payment table) */}
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
