// modules/payroll-run/components/ManualAdjustmentDialog.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";

import type { ManualEntryType } from "../types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Mode = "create" | "edit";

type Initial = {
  type: ManualEntryType;
  desc: string;
  amount: number;
} | null;

type Props = {
  open: boolean;
  mode: Mode;
  employeeName: string;
  defaultType: ManualEntryType; // used in create mode
  initial: Initial; // used in edit mode
  onOpenChange: (v: boolean) => void;
  onSubmit: (args: {
    type: ManualEntryType;
    desc: string;
    amount: number;
  }) => Promise<void>;

  // when true, treat "desc" as DR receipt number and lock type to DEDUCTION
  drMode?: boolean;
};

function parseAmount(v: string): number {
  const n = Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function ManualAdjustmentDialog({
  open,
  mode,
  employeeName,
  defaultType,
  initial,
  onOpenChange,
  onSubmit,
  drMode = false,
}: Props) {
  const [type, setType] = useState<ManualEntryType>(defaultType);
  const [desc, setDesc] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initial) {
      setType(initial.type);
      setDesc(initial.desc ?? "");
      setAmountStr(String(initial.amount ?? ""));
    } else {
      setType(defaultType);
      setDesc("");
      setAmountStr("");
    }
  }, [open, mode, initial, defaultType]);

  useEffect(() => {
    if (open && drMode) setType("DEDUCTION");
  }, [open, drMode]);

  const amount = useMemo(() => parseAmount(amountStr), [amountStr]);
  const canSubmit = !busy && desc.trim().length > 0 && amount > 0;

  const title =
    mode === "create"
      ? `Add Adjustment — ${employeeName}`
      : drMode
        ? `Edit DR Payment — ${employeeName}`
        : `Edit Adjustment — ${employeeName}`;

  const description =
    mode === "create"
      ? "Create a manual entry for the current cutoff."
      : drMode
        ? "Update the DR receipt number and amount for this payroll deduction."
        : "Update description and amount.";

  const descLabel = drMode ? "DR Receipt No." : "Description";
  const descPlaceholder = drMode
    ? "e.g., QWE123"
    : "e.g., Incentive / penalty / adjustment";

  async function submit() {
    if (!canSubmit) return;

    setBusy(true);
    try {
      await onSubmit({
        type: drMode ? "DEDUCTION" : type,
        desc: desc.trim(),
        amount,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      modal={false}
      open={open}
      onOpenChange={(v) => {
        if (!v) setBusy(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!drMode ? (
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as ManualEntryType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EARNING">EARNING</SelectItem>
                  <SelectItem value="DEDUCTION">DEDUCTION</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Type</Label>
              <Input value="DEDUCTION (DR Payment)" readOnly />
            </div>
          )}

          <div className="grid gap-2">
            <Label>{descLabel}</Label>
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={descPlaceholder}
            />
          </div>

          <div className="grid gap-2">
            <Label>Amount</Label>
            <Input
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {busy ? "Saving..." : mode === "create" ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
