"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ManualEntry } from "../types";
import {
  createOtherAddition,
  createOtherDeduction,
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type EntrySource = "ADD" | "DED";
export type ManualEntryExt = ManualEntry & { __source?: EntrySource };

function upper(v: any): string {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

  // if provided -> edit mode
  editingEntry: ManualEntryExt | null;

  // parent will refetch and/or recompute
  onSaved: () => void;
}) {
  const isEdit = Boolean(editingEntry);

  const lockedSource: EntrySource | null = isEdit
    ? ((editingEntry as any)?.__source ??
      (upper((editingEntry as any)?.type) === "EARNING" ? "ADD" : "DED"))
    : null;

  const [kind, setKind] = React.useState<"EARNING" | "DEDUCTION">(
    lockedSource
      ? lockedSource === "ADD"
        ? "EARNING"
        : "DEDUCTION"
      : "DEDUCTION",
  );

  const [deductionType, setDeductionType] =
    React.useState<PayrollOtherDeductionType>("MANUAL");

  const [amount, setAmount] = React.useState<string>("0.00");
  const [description, setDescription] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) return;

    if (!editingEntry) {
      setKind("DEDUCTION");
      setDeductionType("MANUAL");
      setAmount("0.00");
      setDescription("");
      return;
    }

    const t = upper((editingEntry as any)?.type);
    const src: EntrySource =
      ((editingEntry as any)?.__source as any) ??
      (t === "EARNING" ? "ADD" : "DED");

    setKind(src === "ADD" ? "EARNING" : "DEDUCTION");
    setAmount(String((editingEntry as any)?.amount ?? "0.00"));
    setDescription(String((editingEntry as any)?.desc ?? ""));

    const cat =
      upper((editingEntry as any)?.category) ||
      upper((editingEntry as any)?.other_deduction_type) ||
      upper((editingEntry as any)?.deduction_type) ||
      "";

    if (src === "DED" && (cat === "SHORTAGE" || cat === "MANUAL")) {
      setDeductionType(cat as PayrollOtherDeductionType);
    } else {
      setDeductionType("MANUAL");
    }
  }, [open, editingEntry]);

  const canSwitchKind = !isEdit; // avoid moving between tables in edit mode

  async function save() {
    const amt = toNumber(amount);
    if (amt <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    try {
      if (kind === "EARNING") {
        // payroll_other_additions
        if (isEdit && lockedSource === "ADD") {
          await updateOtherAddition(Number((editingEntry as any)?.id), {
            amount: amt,
            description: description.trim() || null,
          });
        } else if (!isEdit) {
          await createOtherAddition({
            user_id: userId,
            amount: amt,
            description: description.trim() || null,
            cutoff_start: cutoffStart,
            cutoff_end: cutoffEnd,
            created_by: createdBy ?? null,
          });
        } else {
          toast.error("This entry is not an addition record.");
          return;
        }
      } else {
        // payroll_other_deductions
        if (isEdit && lockedSource === "DED") {
          await updateOtherDeduction(Number((editingEntry as any)?.id), {
            amount: amt,
            description: description.trim() || null,
            type: deductionType,
          });
        } else if (!isEdit) {
          await createOtherDeduction({
            user_id: userId,
            amount: amt,
            type: deductionType,
            description: description.trim() || null,
            cutoff_start: cutoffStart,
            cutoff_end: cutoffEnd,
            created_by: createdBy ?? null,
          });
        } else {
          toast.error("This entry is not a deduction record.");
          return;
        }
      }

      toast.success(isEdit ? "Adjustment updated." : "Adjustment created.");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save adjustment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Adjustment" : "Add Adjustment"}
          </DialogTitle>
          <DialogDescription>
            This is saved to the database for the selected employee and cutoff.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Kind</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as any)}
              disabled={!canSwitchKind}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEDUCTION">Deduction</SelectItem>
                <SelectItem value="EARNING">Addition</SelectItem>
              </SelectContent>
            </Select>
            {!canSwitchKind ? (
              <div className="text-xs text-muted-foreground">
                Kind is locked in edit mode.
              </div>
            ) : null}
          </div>

          {kind === "DEDUCTION" ? (
            <div className="grid gap-2">
              <Label>Deduction Type</Label>
              <Select
                value={deductionType}
                onValueChange={(v) =>
                  setDeductionType(v as PayrollOtherDeductionType)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">MANUAL</SelectItem>
                  <SelectItem value="SHORTAGE">SHORTAGE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>Amount</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>

          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes / reference"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{isEdit ? "Save Changes" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
