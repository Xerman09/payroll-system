// modules/payroll-run/components/AddEmployeeAdjustmentsDialog.tsx
"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { CutoffSetting } from "../types";
import type { OtherDeductionType } from "./PayrollAdjustStep";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { ChevronDown, Check } from "lucide-react";

type EmployeePick = {
  userId: number;
  name: string;
  dept: string;
  position: string;
};

type Props = {
  open: boolean;
  cutoff: CutoffSetting;
  employees: EmployeePick[];
  onOpenChange: (v: boolean) => void;

  onCreateAddition: (args: {
    userId: number;
    desc: string;
    amount: number;
  }) => Promise<void>;

  onCreateDrPayment: (args: {
    userId: number;
    desc: string;
    amount: number;
  }) => Promise<void>;

  onCreateOtherDeduction: (args: {
    userId: number;
    type: OtherDeductionType; // MANUAL | SHORTAGE
    desc: string;
    amount: number;
  }) => Promise<void>;
};

function parseAmount(v: string): number {
  const n = Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function cutoffLabel(c: CutoffSetting) {
  return `${c.start_date} → ${c.end_date} (${c.cutoff_type})`;
}

function helperText(
  tab: "additions" | "deductions",
  kind: "STOCK_PURCHASE" | "MANUAL" | "SHORTAGE",
) {
  if (tab === "additions") {
    return {
      title: "Earning entry",
      body: "Creates an EARNING manual entry for the selected employee in this cutoff.",
    };
  }
  if (kind === "STOCK_PURCHASE") {
    return {
      title: "Stock Purchase (DR payment)",
      body: "Creates a locked DR payment deduction (stored in dr_payment with PAYROLL_DEDUCTION).",
    };
  }
  if (kind === "SHORTAGE") {
    return {
      title: "Shortage",
      body: "Creates a SHORTAGE row in payroll_other_deductions.",
    };
  }
  return {
    title: "Manual deduction",
    body: "Creates a MANUAL row in payroll_other_deductions.",
  };
}

export function AddEmployeeAdjustmentsDialog({
  open,
  cutoff,
  employees,
  onOpenChange,
  onCreateAddition,
  onCreateDrPayment,
  onCreateOtherDeduction,
}: Props) {
  const [tab, setTab] = useState<"additions" | "deductions">("additions");

  // Employee combobox
  const [empOpen, setEmpOpen] = useState(false);
  const [empQuery, setEmpQuery] = useState("");
  const [userId, setUserId] = useState<number | null>(null);

  // Form fields
  const [desc, setDesc] = useState("");
  const [amountStr, setAmountStr] = useState("");

  const [deductionKind, setDeductionKind] = useState<
    "STOCK_PURCHASE" | "MANUAL" | "SHORTAGE"
  >("MANUAL");

  const [busy, setBusy] = useState(false);
  const descRef = useRef<HTMLInputElement | null>(null);

  const amount = useMemo(() => parseAmount(amountStr), [amountStr]);

  const selected = useMemo(() => {
    if (userId == null) return null;
    return employees.find((e) => e.userId === userId) ?? null;
  }, [userId, employees]);

  // IMPORTANT: only show results when user types something
  const filteredEmployees = useMemo(() => {
    const s = empQuery.trim().toLowerCase();
    if (!s) return [];
    return employees
      .filter((e) => {
        const hay =
          `${e.name} ${e.dept} ${e.position} ${e.userId}`.toLowerCase();
        return hay.includes(s);
      })
      .slice(0, 50);
  }, [empQuery, employees]);

  const help = useMemo(
    () => helperText(tab, deductionKind),
    [tab, deductionKind],
  );

  const canSubmit =
    userId != null && amount > 0 && desc.trim().length > 0 && !busy;

  function resetForm() {
    setEmpOpen(false);
    setEmpQuery("");
    setUserId(null);
    setDesc("");
    setAmountStr("");
    setDeductionKind("MANUAL");
    setTab("additions");
  }

  async function submit() {
    if (!canSubmit || userId == null) return;
    const cleanDesc = desc.trim();

    setBusy(true);
    try {
      if (tab === "additions") {
        await onCreateAddition({ userId, desc: cleanDesc, amount });
      } else {
        if (deductionKind === "STOCK_PURCHASE") {
          await onCreateDrPayment({ userId, desc: cleanDesc, amount });
        } else if (deductionKind === "MANUAL") {
          await onCreateOtherDeduction({
            userId,
            type: "MANUAL",
            desc: cleanDesc,
            amount,
          });
        } else {
          await onCreateOtherDeduction({
            userId,
            type: "SHORTAGE",
            desc: cleanDesc,
            amount,
          });
        }
      }

      toast.success("Adjustment added.");
      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to add adjustment");
    } finally {
      setBusy(false);
    }
  }

  const descPlaceholder =
    tab === "additions"
      ? "e.g., Incentive / allowance / adjustment"
      : deductionKind === "STOCK_PURCHASE"
        ? "e.g., DR number / invoice ref / item list"
        : deductionKind === "SHORTAGE"
          ? "e.g., Cash shortage / inventory shortage details"
          : "e.g., Advance / penalty / other";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent
        className={cn(
          "max-w-none p-0 overflow-hidden",
          "w-[min(58rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)]",
          "flex flex-col",
        )}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>Add Employee Adjustments</DialogTitle>
            <DialogDescription>
              Applies to cutoff {cutoffLabel(cutoff)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <div className="flex flex-col gap-4">
              <TabsList className="grid w-full grid-cols-2 overflow-hidden rounded-xl">
                <TabsTrigger value="additions" className="truncate">
                  Additions
                </TabsTrigger>
                <TabsTrigger value="deductions" className="truncate">
                  Deductions
                </TabsTrigger>
              </TabsList>

              {/* Employee dropdown search (combobox) */}
              <div className="rounded-xl border bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Employee</div>
                  {selected ? (
                    <Badge variant="secondary" className="font-mono">
                      #{selected.userId}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3">
                  <Popover open={empOpen} onOpenChange={setEmpOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2 text-sm",
                          "shadow-sm",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        )}
                      >
                        <span
                          className={cn(
                            "min-w-0 truncate",
                            selected
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {selected
                            ? `${selected.name} — ${selected.dept}`
                            : "Search employee (type name / dept / position / ID)…"}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          value={empQuery}
                          onValueChange={(v) => setEmpQuery(v)}
                          placeholder="Type to search…"
                        />
                        <CommandList className="max-h-[260px] overflow-y-auto">
                          {!empQuery.trim() ? (
                            <div className="p-3 text-xs text-muted-foreground">
                              Start typing to search employees.
                            </div>
                          ) : filteredEmployees.length === 0 ? (
                            <CommandEmpty>No matches.</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              {filteredEmployees.map((e) => {
                                const active = e.userId === userId;
                                return (
                                  <CommandItem
                                    key={e.userId}
                                    value={`${e.userId}`}
                                    onSelect={() => {
                                      setUserId(e.userId);
                                      setEmpOpen(false);
                                      setEmpQuery("");
                                      setTimeout(
                                        () => descRef.current?.focus(),
                                        0,
                                      );
                                    }}
                                    className="flex items-start justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium">
                                        {e.name}
                                      </div>
                                      <div className="truncate text-xs text-muted-foreground">
                                        {e.position} • {e.dept}
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-2">
                                      <span className="text-[11px] text-muted-foreground">
                                        ID {e.userId}
                                      </span>
                                      <Check
                                        className={cn(
                                          "h-4 w-4 text-primary",
                                          active ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {selected ? (
                    <>
                      Selected:{" "}
                      <span className="font-semibold text-foreground">
                        {selected.name}
                      </span>
                    </>
                  ) : (
                    <>Select an employee to continue.</>
                  )}
                </div>
              </div>

              {/* Deductions-only */}
              <TabsContent value="deductions" className="m-0">
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Deduction type</div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(
                      [
                        {
                          key: "STOCK_PURCHASE" as const,
                          label: "Stock Purchase",
                          hint: "DR payment",
                        },
                        {
                          key: "MANUAL" as const,
                          label: "Manual",
                          hint: "Other deduction",
                        },
                        {
                          key: "SHORTAGE" as const,
                          label: "Shortage",
                          hint: "Other deduction",
                        },
                      ] as const
                    ).map((opt) => {
                      const active = deductionKind === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setDeductionKind(opt.key)}
                          className={cn(
                            "rounded-xl border px-4 py-3 text-left transition min-w-0",
                            "min-h-[62px]",
                            active
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm font-semibold">
                              {opt.label}
                            </div>
                            {active ? (
                              <span className="shrink-0 text-[11px] rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                                Selected
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            {opt.hint}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* Additions-only */}
              <TabsContent value="additions" className="m-0">
                <div className="text-sm font-semibold">Addition</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Create a manual earning entry for this cutoff.
                </div>
              </TabsContent>

              {/* Shared fields */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input
                    ref={descRef}
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
                  <div className="text-[11px] text-muted-foreground">
                    Enter a positive amount. This will be applied only to this
                    cutoff run.
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs font-semibold">{help.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {help.body}
                  </div>
                </div>
              </div>
            </div>
          </Tabs>
        </div>

        <Separator />

        {/* Footer */}
        <div className="px-6 py-4">
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
              {busy ? "Saving..." : "Add Adjustment"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddEmployeeAdjustmentsDialog;
