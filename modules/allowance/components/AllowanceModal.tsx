import React, { useMemo, useState, useEffect } from "react";
// Added Plus and X to the imports
import { Check, ChevronsUpDown, Info, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from "sonner";

import {
  Allowance,
  ALLOWANCE_TYPES,
  AllowanceType,
  FormRow,
  User,
} from "../types";
import {
  computeCutoffFromDate,
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
  onSave: (
    rows: FormRow[],
    employeeId: number,
    dates: { start: string; end: string }
  ) => Promise<void>;
}

export default function AllowanceModal({
  open,
  onOpenChange,
  editing,
  users,
  usersLoading,
  onSave,
}: Props) {
  const [formEmployee, setFormEmployee] = useState<number | null>(null);
  const [formDate, setFormDate] = useState(() => iso(new Date()));
  const [formRows, setFormRows] = useState<FormRow[]>([
    { type: "Meals", other: "", amount: "" },
  ]);

  const [employeeOpen, setEmployeeOpen] = useState(false);

  const cutoffPreview = useMemo(
    () => computeCutoffFromDate(formDate),
    [formDate]
  );

  useEffect(() => {
    if (open) {
      if (editing) {
        const isPreset = (ALLOWANCE_TYPES as readonly string[]).includes(
          editing.description
        );
        setFormEmployee(editing.user_id);
        setFormDate(editing.cutoff_start || iso(new Date()));
        setFormRows([
          {
            type: (isPreset ? editing.description : "Others") as AllowanceType,
            other: isPreset ? "" : editing.description,
            amount: String(editing.amount ?? ""),
          },
        ]);
      } else {
        setFormEmployee(null);
        setFormDate(iso(new Date()));
        setFormRows([{ type: "Meals", other: "", amount: "" }]);
      }
    }
  }, [open, editing]);

  const addFormRow = () =>
    setFormRows((s) => [...s, { type: "Meals", other: "", amount: "" }]);
  const removeFormRow = (idx: number) =>
    setFormRows((s) => s.filter((_, i) => i !== idx));
  const updateFormRow = (idx: number, patch: Partial<FormRow>) =>
    setFormRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    if (!formEmployee) return toast.error("Select employee.");
    if (!formDate) return toast.error("Select a date for cutoff preview.");

    for (let i = 0; i < formRows.length; i++) {
      const r = formRows[i];
      if (!r.type) return toast.error(`Row ${i + 1}: choose description`);
      if (r.type === "Others" && !r.other?.trim())
        return toast.error(`Row ${i + 1}: specify 'Others' description`);
      if (!r.amount || isNaN(Number(r.amount)) || Number(r.amount) <= 0)
        return toast.error(`Row ${i + 1}: provide valid amount`);
    }

    await onSave(formRows, formEmployee, cutoffPreview);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Allowance" : "Add Allowance"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details below to{" "}
            {editing ? "modify the" : "create a new"} allowance record.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="grid grid-cols-1 gap-6 py-2">
          {/* Section 1: Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            {/* Employee Selection */}
            <div className="flex flex-col gap-2">
              <Label>Employee</Label>
              <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeOpen}
                    className="w-full justify-between font-normal"
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

            {/* Date */}
            <div className="flex flex-col gap-2">
              <Label>Date Reference</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Cutoff:{" "}
                <span className="font-medium text-foreground">
                  {cutoffPreview.start}
                </span>{" "}
                to{" "}
                <span className="font-medium text-foreground">
                  {cutoffPreview.end}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: Financials */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">
                Allowance Details
              </Label>
            </div>

            <div className="space-y-3">
              {formRows.map((row, i) => (
                <div
                  key={i}
                  className="bg-muted/30 border rounded-md p-3 grid grid-cols-12 gap-3 items-end"
                >
                  <div className="col-span-5">
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
                        if (/^[0-9]*\.?[0-9]{0,2}$/.test(v) || v === "") {
                          updateFormRow(i, { amount: v });
                        }
                      }}
                    />
                  </div>

                  <div className="col-span-1">
                    {formRows.length > 1 && (
                      <Button
                        variant="ghost"
                        className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeFormRow(i)}
                        size="icon"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={addFormRow}
                className="border-dashed"
              >
                <Plus className="w-3.5 h-3.5 mr-2" /> Add Item
              </Button>
            </div>
          </div>

          {/* Section 3: Summary */}
          <div className="bg-muted/50 rounded-lg p-4 border">
            <h4 className="text-sm font-semibold mb-3">Submission Summary</h4>
            <div className="space-y-2 text-sm">
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
              <div className="flex flex-col gap-1 pt-1">
                {formRows.map((r, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {r.type === "Others" ? r.other || "Other" : r.type}
                    </span>
                    <span>{r.amount ? formatCurrency(r.amount) : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {editing ? "Save Changes" : "Create Allowance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
