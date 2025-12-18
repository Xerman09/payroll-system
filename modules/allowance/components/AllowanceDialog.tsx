"use client";

import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Allowance,
  FormRow,
  User,
  ALLOWANCE_TYPES,
  AllowanceType,
} from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  formEmployee: number | null;
  setFormEmployee: (id: number) => void;
  formDate: string;
  setFormDate: (d: string) => void;
  formRows: FormRow[];
  setFormRows: (rows: FormRow[]) => void;
  cutoffPreview: { start: string; end: string };
  editing: Allowance | null;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function AllowanceDialog({
  open,
  onOpenChange,
  users,
  formEmployee,
  setFormEmployee,
  formDate,
  setFormDate,
  formRows,
  setFormRows,
  cutoffPreview,
  editing,
  onSubmit,
  onCancel,
}: Props) {
  const addFormRow = () =>
    setFormRows([...formRows, { type: "Meals", other: "", amount: "" }]);
  const removeFormRow = (idx: number) =>
    setFormRows(formRows.filter((_, i) => i !== idx));
  const updateFormRow = (idx: number, patch: Partial<FormRow>) =>
    setFormRows(formRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const formatCurrency = (v: string | number) => {
    const num = typeof v === "string" ? Number(v) : v;
    if (isNaN(num)) return v;
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Allowance" : "Add Allowance(s)"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label>Employee</Label>
            <Select
              value={formEmployee ? String(formEmployee) : ""}
              onValueChange={(v) => setFormEmployee(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={String(u.user_id)}>
                    {`${u.user_fname}${
                      u.user_mname ? " " + u.user_mname : ""
                    } ${u.user_lname}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Choose date (auto compute cutoff)</Label>
            <Input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />
            <div className="text-sm text-muted-foreground mt-1">
              Cutoff preview:{" "}
              <span className="font-medium">{cutoffPreview.start}</span> →{" "}
              <span className="font-medium">{cutoffPreview.end}</span>
            </div>
          </div>

          <div>
            <Label>Allowance entries</Label>
            <div className="space-y-3 mt-2">
              {formRows.map((row, i) => (
                <div
                  key={i}
                  className="border rounded p-3 grid grid-cols-12 gap-3 items-end"
                >
                  <div className="col-span-5">
                    <Label className="text-xs">Description</Label>
                    <Select
                      value={row.type}
                      onValueChange={(v) =>
                        updateFormRow(i, {
                          type: v as AllowanceType,
                          other: "",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALLOWANCE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-4">
                    {row.type === "Others" ? (
                      <>
                        <Label className="text-xs">Specify</Label>
                        <Input
                          value={row.other}
                          onChange={(e) =>
                            updateFormRow(i, { other: e.target.value })
                          }
                        />
                      </>
                    ) : (
                      <div className="h-10" />
                    )}
                  </div>

                  <div className="col-span-2">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      value={row.amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^[0-9]*\.?[0-9]{0,2}$/.test(v) || v === "")
                          updateFormRow(i, { amount: v });
                      }}
                    />
                  </div>

                  <div className="col-span-1">
                    {formRows.length > 1 && (
                      <Button
                        variant="destructive"
                        onClick={() => removeFormRow(i)}
                        size="sm"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Button variant="outline" onClick={addFormRow}>
                + Add another allowance
              </Button>
            </div>
          </div>

          <div>
            <Label>Submission preview</Label>
            <div className="p-3 rounded border">
              <div className="text-sm mb-2">
                Employee:{" "}
                <b>
                  {formEmployee
                    ? users.find((u) => u.user_id === formEmployee)
                        ?.user_fname ?? `User ${formEmployee}`
                    : "—"}
                </b>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {formRows.map((r, i) => (
                  <div key={i} className="flex justify-between">
                    <div>{r.type === "Others" ? r.other : r.type}</div>
                    <div>{formatCurrency(r.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Cutoff: <b>{cutoffPreview.start}</b> →{" "}
                <b>{cutoffPreview.end}</b>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full justify-end">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSubmit}>
              {editing ? "Save changes" : "Create Allowance(s)"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
