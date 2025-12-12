"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency, isoDate } from "../utils";
import type { Allowance, User } from "../types";

const BASE_API = "http://100.126.246.124:8060";

// possible descriptions
const DESCRIPTION_OPTIONS = [
  "Meals",
  "Load",
  "Motor Allowance",
  "Gas",
  "Others",
] as const;
type DescriptionOption = (typeof DESCRIPTION_OPTIONS)[number];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  initialData?: Allowance;
};

type NewAllowanceRow = {
  descriptionType: DescriptionOption | "";
  descriptionOther: string;
  amount: string; // string to manage input easier
};

export default function AddAllowanceDialog({
  open,
  onOpenChange,
  onSaved,
  initialData,
}: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  // payroll cycle => automatic cutoff: 1st or 2nd
  const [payrollCutoff, setPayrollCutoff] = useState<"1st" | "2nd">("1st");
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // dynamic rows for multiple allowances in one submit
  const [rows, setRows] = useState<NewAllowanceRow[]>([
    { descriptionType: "", descriptionOther: "", amount: "" },
  ]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch(`${BASE_API}/items/user?limit=-1`);
        const json = await res.json();
        // API sample is an array of users OR { data: [...] }
        const u = Array.isArray(json) ? json : json.data ?? [];
        setUsers(u);
        if (u.length && !selectedUser) {
          setSelectedUser(u[0].user_id);
        }
      } catch (err) {
        console.error("load users err", err);
        alert("Failed to fetch users");
      }
    }
    if (open) loadUsers();
  }, [open]);

  useEffect(() => {
    // If initialData (Edit scenario), prefill form
    if (initialData) {
      setSelectedUser(Number(initialData.user_id));
      setRows([
        {
          descriptionType:
            (DESCRIPTION_OPTIONS.includes(initialData.description as any)
              ? (initialData.description as DescriptionOption)
              : "Others") || "",
          descriptionOther: DESCRIPTION_OPTIONS.includes(
            initialData.description as any
          )
            ? ""
            : initialData.description || "",
          amount: String(Number(initialData.amount).toFixed(2)),
        },
      ]);
      // infer payroll cutoff from the dates (simple heuristic)
      const start = new Date(initialData.cutoff_start);
      if (start.getDate() <= 15) setPayrollCutoff("1st");
      else setPayrollCutoff("2nd");
      setMonthYear(
        `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
          2,
          "0"
        )}`
      );
    }
  }, [initialData]);

  const computedCutoff = useMemo(() => {
    const [y, m] = monthYear.split("-").map(Number);
    if (!y || !m) return { start: "", end: "" };
    const start = new Date(y, m - 1, payrollCutoff === "1st" ? 1 : 16);
    const end =
      payrollCutoff === "1st" ? new Date(y, m - 1, 15) : new Date(y, m, 0); // last day of month
    return { start: isoDate(start), end: isoDate(end) };
  }, [monthYear, payrollCutoff]);

  // manage dynamic rows
  const addRow = () =>
    setRows((r) => [
      ...r,
      { descriptionType: "", descriptionOther: "", amount: "" },
    ]);
  const removeRow = (idx: number) =>
    setRows((r) => r.filter((_, i) => i !== idx));

  const updateRow = (idx: number, partial: Partial<NewAllowanceRow>) => {
    setRows((r) =>
      r.map((row, i) => (i === idx ? { ...row, ...partial } : row))
    );
  };

  // Save: create one allowance record per row
  const handleSave = async () => {
    if (!selectedUser) return alert("Select an employee.");
    // validation
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.descriptionType)
        return alert(`Choose description for row ${i + 1}`);
      if (r.descriptionType === "Others" && !r.descriptionOther.trim())
        return alert(`Provide description details for row ${i + 1}`);
      if (!r.amount || Number(r.amount) <= 0)
        return alert(`Provide valid amount for row ${i + 1}`);
    }

    try {
      // create each allowance row
      for (const r of rows) {
        const payload = {
          user_id: selectedUser,
          amount: Number(r.amount).toFixed(2),
          description:
            r.descriptionType === "Others"
              ? r.descriptionOther
              : r.descriptionType,
          cutoff_start: computedCutoff.start,
          cutoff_end: computedCutoff.end,
          is_processed: 0,
        };
        const res = await fetch(`${BASE_API}/items/employee_allowance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API create failed: ${text}`);
        }
      }

      alert("Allowance(s) saved.");
      onSaved?.();
      onOpenChange(false);
      // reset rows
      setRows([{ descriptionType: "", descriptionOther: "", amount: "" }]);
    } catch (err) {
      console.error(err);
      alert("Failed to create allowance(s). Check console for details.");
    }
  };

  // For edit scenario: update single record (initialData present)
  const handleUpdate = async () => {
    if (!initialData) return;
    const r = rows[0];
    if (!r.descriptionType) return alert("Choose description.");
    if (r.descriptionType === "Others" && !r.descriptionOther.trim())
      return alert("Please provide description.");
    if (!r.amount || Number(r.amount) <= 0)
      return alert("Provide valid amount.");

    try {
      const payload = {
        user_id: selectedUser,
        amount: Number(r.amount).toFixed(2),
        description:
          r.descriptionType === "Others"
            ? r.descriptionOther
            : r.descriptionType,
        cutoff_start: computedCutoff.start,
        cutoff_end: computedCutoff.end,
      };
      const res = await fetch(
        `${BASE_API}/items/employee_allowance/${initialData.allowance_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API update failed: ${text}`);
      }
      alert("Updated");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update allowance");
    }
  };

  // render
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Allowance" : "Add Allowance(s)"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Employee</Label>
              <Select
                value={selectedUser ?? ""}
                onValueChange={(v) => setSelectedUser(Number(v))}
                className="w-full"
              >
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={String(u.user_id)}>
                    {`${u.user_fname} ${
                      u.user_mname ? u.user_mname + " " : ""
                    }${u.user_lname}`}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div>
              <Label>Payroll Cutoff</Label>
              <div className="flex gap-2">
                <Select
                  value={payrollCutoff}
                  onValueChange={(v) => setPayrollCutoff(v as any)}
                >
                  <SelectItem value="1st">1st cutoff (1–15)</SelectItem>
                  <SelectItem value="2nd">2nd cutoff (16–end)</SelectItem>
                </Select>
                <Input
                  type="month"
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  className="w-auto"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Computed Cutoff</Label>
            <div className="p-3 rounded border">
              {computedCutoff.start} — {computedCutoff.end}
            </div>
          </div>

          <div>
            <Label>Allowance entries</Label>
            <div className="space-y-4 mt-2">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="border rounded p-3 grid grid-cols-12 gap-3 items-end"
                >
                  <div className="col-span-5">
                    <Label className="text-sm">Description</Label>
                    <Select
                      value={row.descriptionType ?? ""}
                      onValueChange={(v) =>
                        updateRow(idx, {
                          descriptionType: v as DescriptionOption,
                          descriptionOther: "",
                        })
                      }
                    >
                      <SelectItem value="">Select</SelectItem>
                      {DESCRIPTION_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className="col-span-4">
                    {row.descriptionType === "Others" ? (
                      <>
                        <Label className="text-sm">Specify (Others)</Label>
                        <Input
                          value={row.descriptionOther}
                          onChange={(e) =>
                            updateRow(idx, { descriptionOther: e.target.value })
                          }
                          placeholder="Describe other allowance"
                        />
                      </>
                    ) : (
                      <div className="invisible">placeholder</div>
                    )}
                  </div>

                  <div className="col-span-2">
                    <Label className="text-sm">Amount</Label>
                    <Input
                      value={row.amount}
                      onChange={(e) => {
                        // allow only numbers + dot
                        const v = e.target.value;
                        if (/^[0-9]*\.?[0-9]{0,2}$/.test(v) || v === "")
                          updateRow(idx, { amount: v });
                      }}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="text-sm invisible">actions</Label>
                    <div className="flex flex-col gap-2">
                      {rows.length > 1 && (
                        <Button
                          variant="destructive"
                          onClick={() => removeRow(idx)}
                          size="sm"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <Button onClick={addRow} variant="outline" size="sm">
                  + Add another allowance row
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {initialData ? (
              <Button onClick={handleUpdate}>Save changes</Button>
            ) : (
              <Button onClick={handleSave}>Save Allowance(s)</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
