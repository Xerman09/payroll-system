// modules/allowance/components/AllowanceModal.tsx

import React, { useMemo, useState, useEffect } from "react";
import { Check, ChevronsUpDown, Info, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

// AFTER (correct)
import { ALLOWANCE_TYPES } from "../types";
import type {
  Allowance,
  AllowanceMode,
  AllowanceSaveMeta,
  AllowanceType,
  FormRow,
  PayCycle,
  User,
} from "../types";

import {
  computeCutoffFromDate,
  flagToBool,
  formatCurrency,
  fullnameFromUser,
  iso,
} from "../providers/allowanceApi";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  editing: Allowance | null;

  users: User[];
  usersLoading: boolean;

  /** When creating new, default tab mode follows parent tab */
  defaultMode: AllowanceMode;

  onSave: (
    rows: FormRow[],
    employeeId: number,
    meta: AllowanceSaveMeta
  ) => Promise<void>;
}



export default function AllowanceModal({
  open,
  onOpenChange,
  editing,
  users,
  usersLoading,
  defaultMode,
  onSave,
}: Props) {
  const [formMode, setFormMode] = useState<AllowanceMode>(defaultMode);

  const [formEmployee, setFormEmployee] = useState<number | null>(null);

  // One-time reference date -> cutoff preview
  const [formDate, setFormDate] = useState(() => iso(new Date()));

  // Recurring fields
  const [payCycle, setPayCycle] = useState<PayCycle>("PER_MONTH");
  const [startDate, setStartDate] = useState<string>(() => iso(new Date()));
  const [endDate, setEndDate] = useState<string>(""); // optional
  const [isActive, setIsActive] = useState<boolean>(true);

  const [formRows, setFormRows] = useState<FormRow[]>([
    { type: "Meals", other: "", amount: "" },
  ]);

  const [employeeOpen, setEmployeeOpen] = useState(false);

  const cutoffPreview = useMemo(
    () => computeCutoffFromDate(formDate),
    [formDate]
  );

  useEffect(() => {
    if (!open) return;

    if (editing) {
      const recurring = flagToBool(editing.is_recurring);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormMode(recurring ? "recurring" : "one_time");

       
      setFormEmployee(editing.user_id);

      // One-time defaults
       
      setFormDate(editing.cutoff_start || iso(new Date()));

      // Recurring defaults
       
      setPayCycle(editing.pay_cycle || "PER_MONTH");
       
      setStartDate(editing.start_date || iso(new Date()));
       
      setEndDate(editing.end_date || "");
       
      setIsActive(flagToBool(editing.is_active));

      const isPreset = (ALLOWANCE_TYPES as readonly string[]).includes(
        editing.description
      );
       
      setFormRows([
        {
          type: (isPreset ? editing.description : "Others") as AllowanceType,
          other: isPreset ? "" : editing.description,
          amount: String(editing.amount ?? ""),
        },
      ]);
    } else {
       
      setFormMode(defaultMode);

       
      setFormEmployee(null);
       
      setFormDate(iso(new Date()));

       
      setPayCycle("PER_MONTH");
       
      setStartDate(iso(new Date()));
       
      setEndDate("");
       
      setIsActive(true);

       
      setFormRows([{ type: "Meals", other: "", amount: "" }]);
    }
  }, [open, editing, defaultMode]);

  const addFormRow = () =>
    setFormRows((s) => [...s, { type: "Meals", other: "", amount: "" }]);

  const removeFormRow = (idx: number) =>
    setFormRows((s) => s.filter((_, i) => i !== idx));

  const updateFormRow = (idx: number, patch: Partial<FormRow>) =>
    setFormRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const validateCommon = () => {
    if (!formEmployee) {
      toast.error("Select employee.");
      return false;
    }
    for (let i = 0; i < formRows.length; i++) {
      const r = formRows[i];
      if (!r.type) {
        toast.error(`Row ${i + 1}: choose description`);
        return false;
      }
      if (r.type === "Others" && !r.other?.trim()) {
        toast.error(`Row ${i + 1}: specify 'Others' description`);
        return false;
      }
      const n = Number(r.amount);
      if (!r.amount || Number.isNaN(n) || n <= 0) {
        toast.error(`Row ${i + 1}: provide valid amount`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateCommon()) return;

    if (formMode === "one_time") {
      if (!formDate) return toast.error("Select a date for cutoff preview.");
      if (!cutoffPreview.start || !cutoffPreview.end) {
        return toast.error("Invalid cutoff date.");
      }

      const meta: AllowanceSaveMeta = {
        mode: "one_time",
        cutoff_start: cutoffPreview.start,
        cutoff_end: cutoffPreview.end,
      };

      await onSave(formRows, formEmployee!, meta);
      return;
    }

    // recurring
    if (!payCycle || payCycle === "N/A") {
      return toast.error("Select pay cycle.");
    }
    if (!startDate) return toast.error("Start date is required.");

    if (endDate && endDate < startDate) {
      return toast.error("End date must be on/after Start date.");
    }

    const meta: AllowanceSaveMeta = {
      mode: "recurring",
      pay_cycle: payCycle,
      start_date: startDate,
      end_date: endDate ? endDate : null,
      is_active: isActive,
    };

    await onSave(formRows, formEmployee!, meta);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl p-0 max-h-[85vh] overflow-hidden">
        <div className="flex flex-col max-h-[85vh]">
          {/* HEADER */}
          <div className="p-6 pb-3">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Allowance" : "Add Allowance"}
              </DialogTitle>
              <DialogDescription>
                Fill in the details below to{" "}
                {editing ? "modify the" : "create a new"} allowance record.
              </DialogDescription>
            </DialogHeader>
          </div>

          <Separator />

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Mode Tabs */}
            <Tabs
              value={formMode}
              onValueChange={(v) => setFormMode(v as AllowanceMode)}
            >
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger value="one_time" className="rounded-md">
                  One-time Allowance
                </TabsTrigger>
                <TabsTrigger value="recurring" className="rounded-md">
                  Recurring Allowance
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 gap-5 mt-4">
              {/* Section 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Employee */}
                <div className="flex flex-col gap-2">
                  <Label>Employee</Label>
                  <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={employeeOpen}
                        className="w-full justify-between font-normal"
                        disabled={usersLoading}
                      >
                        {formEmployee
                          ? users.find((u) => u.user_id === formEmployee)
                            ? fullnameFromUser(
                                users.find((u) => u.user_id === formEmployee)!
                              )
                            : "Select employee..."
                          : "Select employee..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search employee..." />
                        <CommandList>
                          <CommandEmpty>No employee found.</CommandEmpty>
                          <CommandGroup>
                            {users.map((u) => (
                              <CommandItem
                                key={u.user_id}
                                value={fullnameFromUser(u)}
                                onSelect={() => {
                                  setFormEmployee(u.user_id);
                                  setEmployeeOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formEmployee === u.user_id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {fullnameFromUser(u)}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Right side: mode dependent */}
                {formMode === "one_time" ? (
                  <div className="flex flex-col gap-2">
                    <Label>Date Reference</Label>
                    <Input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Cutoff:
                      <span className="font-medium text-foreground">
                        {cutoffPreview.start}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium text-foreground">
                        {cutoffPreview.end}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Label>Pay Cycle</Label>
                    <Select
                      value={payCycle}
                      onValueChange={(v) => setPayCycle(v as PayCycle)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select pay cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PER_CUTOFF">PER_CUTOFF</SelectItem>
                        <SelectItem value="PER_MONTH">PER_MONTH</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center justify-between pt-1">
                      <Label className="text-sm text-muted-foreground">
                        Active
                      </Label>
                      <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Recurring dates */}
              {formMode === "recurring" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>End Date (optional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Separator />

              {/* Allowance details */}
              <div>
                <Label className="text-base font-semibold">
                  Allowance Details
                </Label>

                <div className="space-y-3 mt-3">
                  {formRows.map((row, i) => (
                    <div
                      key={i}
                      className="bg-muted/30 border rounded-md p-3 grid grid-cols-12 gap-3 items-end"
                    >
                      <div className="col-span-6">
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Description
                        </Label>
                        <Select
                          value={row.type}
                          onValueChange={(v) =>
                            updateFormRow(i, {
                              type: v as AllowanceType,
                              other: "",
                            })
                          }
                        >
                          <SelectTrigger className="bg-background">
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
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Specify Other
                            </Label>
                            <Input
                              className="bg-background"
                              value={row.other}
                              placeholder="Specific details..."
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
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Amount
                        </Label>
                        <Input
                          className="bg-background text-right"
                          value={row.amount}
                          placeholder="0.00"
                          onChange={(e) => {
                            const v = e.target.value;
                            if (/^[0-9]*\.?[0-9]{0,2}$/.test(v) || v === "")
                              updateFormRow(i, { amount: v });
                          }}
                        />
                      </div>

                      <div className="col-span-12 flex justify-between items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addFormRow}
                          className="border-dashed"
                        >
                          <Plus className="w-3.5 h-3.5 mr-2" />
                          Add Item
                        </Button>

                        {formRows.length > 1 && (
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeFormRow(i)}
                            size="sm"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary (keep, but it scrolls now) */}
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="text-sm font-semibold mb-3">
                  Submission Summary
                </h4>

                <div className="space-y-2 text-sm">
                  {/* Employee */}
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Employee</span>
                    <span className="font-medium">
                      {formEmployee
                        ? users.find((u) => u.user_id === formEmployee)
                          ? fullnameFromUser(
                              users.find((u) => u.user_id === formEmployee)!
                            )
                          : `User ${formEmployee}`
                        : "—"}
                    </span>
                  </div>

                  {/* Mode */}
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Mode</span>
                    <span className="font-medium">
                      {formMode === "one_time" ? "One-time" : "Recurring"}
                    </span>
                  </div>

                  {/* Mode-specific summary */}
                  {formMode === "one_time" ? (
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Cutoff</span>
                      <span className="font-medium">
                        {cutoffPreview.start || "—"} to{" "}
                        {cutoffPreview.end || "—"}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">Pay Cycle</span>
                        <span className="font-medium">{payCycle || "—"}</span>
                      </div>

                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">
                          Start / End
                        </span>
                        <span className="font-medium">
                          {startDate || "—"} to {endDate || "—"}
                        </span>
                      </div>

                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium">
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Items */}
                  <div className="pt-1 space-y-1">
                    {formRows.length === 0 ? (
                      <div className="text-muted-foreground">No items.</div>
                    ) : (
                      formRows.map((r, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {r.type === "Others"
                              ? r.other?.trim() || "Other"
                              : r.type || "—"}
                          </span>
                          <span className="font-medium">
                            {r.amount ? formatCurrency(r.amount) : "—"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="border-t bg-background p-4 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editing ? "Save Changes" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
