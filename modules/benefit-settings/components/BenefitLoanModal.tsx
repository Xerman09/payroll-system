// modules/benefit-settings/components/BenefitLoanModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";

import type {
  BenefitLoan,
  CutoffSetting,
  LoanBenefitCode,
  UserData,
  DeductOn,
  BenefitLoanStatus,
} from "../types";
import {
  createBenefitLoan,
  updateBenefitLoan,
  cutoffLabel,
  toNum,
} from "../providers/benefitApi";

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
import { Textarea } from "@/components/ui/textarea";
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

function userLabel(u: UserData) {
  return `${u.user_fname} ${u.user_lname}`.trim();
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function fmtMoney(v: unknown) {
  const n = toNum(v);
  return Number.isFinite(n) ? round2(n).toFixed(2) : "0.00";
}

export default function BenefitLoanModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: UserData[];
  cutoffs: CutoffSetting[];
  initial: BenefitLoan | null;
  onSaved: (row: BenefitLoan) => void;
}) {
  const { open, onOpenChange, users, cutoffs, initial, onSaved } = props;

  const isEdit = !!initial;

  const [saving, setSaving] = React.useState(false);
  const [userPickerOpen, setUserPickerOpen] = React.useState(false);

  // Interest rate input (percentage)
  const [interestRatePct, setInterestRatePct] = React.useState<string>("0");

  const [form, setForm] = React.useState<Partial<BenefitLoan>>({
    loan_id: 0,
    user_id: 0,
    benefit_code: "SSS",
    loan_name: null,
    reference_no: null,
    principal_amount: 0,
    interest_amount: 0,
    total_payable: 0,
    amortization_amount: 0,
    terms_installments: 1,
    deduct_on: "BOTH",
    start_cutoff_id: 0,
    paid_installments: 0,
    remaining_balance: 0,
    last_paid_cutoff_id: null,
    status: "ACTIVE",
    remarks: null,
  });

  React.useEffect(() => {
    if (!open) return;

    if (initial) {
      setForm({ ...initial });

      // Derive interest rate from existing values when editing
      const p = toNum(initial.principal_amount);
      const i = toNum(initial.interest_amount);
      const pct = p > 0 ? round2((i / p) * 100) : 0;
      setInterestRatePct(String(pct));
    } else {
      setForm({
        loan_id: 0,
        user_id: 0,
        benefit_code: "SSS",
        loan_name: null,
        reference_no: null,
        principal_amount: 0,
        interest_amount: 0,
        total_payable: 0,
        amortization_amount: 0,
        terms_installments: 1,
        deduct_on: "BOTH",
        start_cutoff_id: cutoffs[0]?.id ?? 0,
        paid_installments: 0,
        remaining_balance: 0,
        last_paid_cutoff_id: null,
        status: "ACTIVE",
        remarks: null,
      });

      setInterestRatePct("0");
    }
  }, [open, initial, cutoffs]);

  const selectedUser = React.useMemo(() => {
    return users.find((u) => u.user_id === Number(form.user_id)) || null;
  }, [users, form.user_id]);

  // AUTO COMPUTE:
  // - interest_amount = principal * (rate/100)
  // - total_payable = principal + interest
  // - amortization_amount = total_payable / terms_installments
  // - remaining_balance = total_payable - (paid_installments * amortization_amount)
  React.useEffect(() => {
    if (!open) return;

    const principal = toNum(form.principal_amount);
    const ratePct = Math.max(0, toNum(interestRatePct));

    const termsSafe = Math.max(
      1,
      Math.trunc(toNum(form.terms_installments) || 1)
    );

    const interest = round2(principal * (ratePct / 100));
    const total = round2(principal + interest);
    const amort = round2(total / termsSafe);

    const paidInstallments = Math.max(
      0,
      Math.trunc(toNum(form.paid_installments) || 0)
    );

    const remaining =
      paidInstallments > 0
        ? round2(Math.max(0, total - paidInstallments * amort))
        : total;

    setForm((prev) => {
      const changed =
        toNum(prev.interest_amount) !== interest ||
        toNum(prev.total_payable) !== total ||
        toNum(prev.amortization_amount) !== amort ||
        toNum(prev.remaining_balance) !== remaining ||
        Math.trunc(toNum(prev.terms_installments) || 1) !== termsSafe;

      if (!changed) return prev;

      return {
        ...prev,
        // normalize terms to safe integer so the UI doesn’t keep “0”
        terms_installments: termsSafe,
        interest_amount: interest,
        total_payable: total,
        amortization_amount: amort,
        remaining_balance: remaining,
      };
    });
  }, [
    open,
    interestRatePct,
    form.principal_amount,
    form.terms_installments,
    form.paid_installments,
  ]);

  const onSubmit = React.useCallback(async () => {
    if (!form.user_id) {
      toast.error("Please select an employee.");
      return;
    }
    if (!form.start_cutoff_id) {
      toast.error("Please select a start cutoff.");
      return;
    }
    if (form.benefit_code !== "SSS" && form.benefit_code !== "PAGIBIG") {
      toast.error("Loans are only allowed for SSS and PAGIBIG.");
      return;
    }

    setSaving(true);
    try {
      const principal = toNum(form.principal_amount);

      const termsSafe = Math.max(
        1,
        Math.trunc(toNum(form.terms_installments) || 1)
      );

      // computed fields (server-safe)
      const interest = toNum(form.interest_amount);
      const total = toNum(form.total_payable) || principal + interest;
      const amort = toNum(form.amortization_amount) || total / termsSafe;

      const payload: Partial<BenefitLoan> = {
        ...form,
        principal_amount: principal,
        terms_installments: termsSafe,
        interest_amount: interest,
        total_payable: total,
        amortization_amount: amort,
        remaining_balance: toNum(form.remaining_balance) || total,
        paid_installments: Math.max(
          0,
          Math.trunc(toNum(form.paid_installments) || 0)
        ),
      };

      let res: any;
      if (isEdit && initial) {
        res = await updateBenefitLoan(initial.loan_id, payload);
      } else {
        res = await createBenefitLoan(payload);
      }

      const saved = (res?.data ?? res) as BenefitLoan;
      onSaved(saved);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save loan.");
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, initial, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95vw] sm:w-full
          max-w-3xl
          max-h-[90vh]
          overflow-hidden
          p-0
        "
      >
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>
              {isEdit ? "Edit Benefit Loan" : "Add Benefit Loan"}
            </DialogTitle>
            <DialogDescription>
              Loans are supported for SSS and Pagibig only. PhilHealth loans are
              not allowed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Employee Picker */}
              <div className="space-y-2">
                <Label className="text-xs">Employee</Label>
                <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="h-9 w-full justify-between"
                    >
                      {selectedUser
                        ? userLabel(selectedUser)
                        : "Select employee…"}
                      <ChevronsUpDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] max-w-[95vw] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search employee…" />
                      <CommandList>
                        <CommandEmpty>No employee found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((u) => (
                            <CommandItem
                              key={u.user_id}
                              value={`${u.user_id}-${userLabel(u)}`}
                              onSelect={() => {
                                setForm((p) => ({ ...p, user_id: u.user_id }));
                                setUserPickerOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  Number(form.user_id) === u.user_id
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              {userLabel(u)}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Benefit */}
              <div className="space-y-2">
                <Label className="text-xs">Benefit</Label>
                <Select
                  value={(form.benefit_code ?? "SSS") as LoanBenefitCode}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      benefit_code: v as LoanBenefitCode,
                    }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSS">SSS</SelectItem>
                    <SelectItem value="PAGIBIG">PAGIBIG</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Loan Name */}
              <div className="space-y-2">
                <Label className="text-xs">Loan Name</Label>
                <Input
                  className="h-9"
                  value={form.loan_name ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      loan_name: e.target.value || null,
                    }))
                  }
                  placeholder="e.g., Salary Loan"
                />
              </div>

              {/* Reference */}
              <div className="space-y-2">
                <Label className="text-xs">Reference No</Label>
                <Input
                  className="h-9"
                  value={form.reference_no ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      reference_no: e.target.value || null,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>

              {/* Principal */}
              <div className="space-y-2">
                <Label className="text-xs">Principal Amount</Label>
                <Input
                  className="h-9"
                  inputMode="decimal"
                  value={String(form.principal_amount ?? 0)}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      principal_amount: e.target.value as any,
                    }))
                  }
                />
              </div>

              {/* Interest Rate (%) */}
              <div className="space-y-2">
                <Label className="text-xs">Interest Rate (%)</Label>
                <Input
                  className="h-9"
                  inputMode="decimal"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>

              {/* Auto: Interest */}
              <div className="space-y-2">
                <Label className="text-xs">Interest Amount (Auto)</Label>
                <Input
                  className="h-9"
                  readOnly
                  value={fmtMoney(form.interest_amount)}
                />
              </div>

              {/* Auto: Total */}
              <div className="space-y-2">
                <Label className="text-xs">Total Payable (Auto)</Label>
                <Input
                  className="h-9"
                  readOnly
                  value={fmtMoney(form.total_payable)}
                />
              </div>

              {/* Terms */}
              <div className="space-y-2">
                <Label className="text-xs">Terms (Installments)</Label>
                <Input
                  className="h-9"
                  inputMode="numeric"
                  value={String(form.terms_installments ?? 1)}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      terms_installments: e.target.value as any,
                    }))
                  }
                />
              </div>

              {/* Auto: Amortization */}
              <div className="space-y-2">
                <Label className="text-xs">Amortization Amount (Auto)</Label>
                <Input
                  className="h-9"
                  readOnly
                  value={fmtMoney(form.amortization_amount)}
                />
              </div>

              {/* Deduct On */}
              <div className="space-y-2">
                <Label className="text-xs">Deduct On</Label>
                <Select
                  value={(form.deduct_on ?? "BOTH") as DeductOn}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, deduct_on: v as DeductOn }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOTH">Both Cutoffs</SelectItem>
                    <SelectItem value="FIRST">1st Cutoff Only</SelectItem>
                    <SelectItem value="SECOND">2nd Cutoff Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Cutoff */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Start Cutoff</Label>
                <Select
                  value={String(form.start_cutoff_id ?? 0)}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, start_cutoff_id: Number(v) }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cutoffs.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {cutoffLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select
                  value={(form.status ?? "ACTIVE") as BenefitLoanStatus}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, status: v as BenefitLoanStatus }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto: Remaining */}
              <div className="space-y-2">
                <Label className="text-xs">Remaining Balance (Auto)</Label>
                <Input
                  className="h-9"
                  readOnly
                  value={fmtMoney(form.remaining_balance)}
                />
              </div>

              {/* Remarks */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Remarks</Label>
                <Textarea
                  value={form.remarks ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, remarks: e.target.value || null }))
                  }
                  placeholder="Optional notes…"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-background">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving ? "Saving…" : "Save Loan"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
