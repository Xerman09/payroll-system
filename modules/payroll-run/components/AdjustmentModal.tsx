"use client";

import React, { useMemo, useState } from "react";
import type { Adjustment, AdjustmentType, EmployeeRow } from "../types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

function safeNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function AdjustmentModal({
  open,
  employee,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  employee: EmployeeRow | null;
  onOpenChange: (open: boolean) => void;
  onSave: (employeeId: number, adjustment: Adjustment) => void;
}) {
  const [type, setType] = useState<AdjustmentType>("EARNING");
  const [amountRaw, setAmountRaw] = useState<string>("");
  const [desc, setDesc] = useState<string>("");
  const [recurring, setRecurring] = useState<boolean>(false);

  const canSave = useMemo(() => {
    const amt = safeNumber(amountRaw);
    return Boolean(employee) && desc.trim().length > 0 && Number.isFinite(amt) && amt > 0;
  }, [amountRaw, desc, employee]);

  function reset() {
    setType("EARNING");
    setAmountRaw("");
    setDesc("");
    setRecurring(false);
  }

  function handleSave() {
    if (!employee) return;
    if (!canSave) return;

    const amount = safeNumber(amountRaw);
    const adjustment: Adjustment = {
      type,
      amount,
      desc: recurring ? `${desc.trim()} (Recurring)` : desc.trim(),
      recurring,
    };

    onSave(employee.id, adjustment);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add Adjustment</DialogTitle>
          <DialogDescription>Manual earning/deduction applied to the current payroll run.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employee Name</label>
            <Input value={employee?.name ?? ""} disabled />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as AdjustmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EARNING">➕ Addition</SelectItem>
                  <SelectItem value="DEDUCTION">➖ Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input placeholder="e.g. Performance Bonus" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="recurring"
              checked={recurring}
              onCheckedChange={(v) => setRecurring(Boolean(v))}
            />
            <label htmlFor="recurring" className="text-sm">
              Apply to future cutoffs? (Recurring)
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
