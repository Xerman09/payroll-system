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

      let res: BenefitLoan | { data: BenefitLoan };
      if (isEdit && initial) {
        res = await updateBenefitLoan(initial.loan_id, payload);
      } else {
        res = await createBenefitLoan(payload);
      }

      const saved = ('data' in res ? res.data : res) as BenefitLoan;
      onSaved(saved);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save loan.";
      toast.error(msg);
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
          dark:bg-gray-900 dark:border-gray-800
        "
      >
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-3 border-b dark:border-gray-800">
            <DialogTitle>
              {isEdit ? "Edit Benefit Loan" : "Add Benefit Loan"}
            </DialogTitle>
            <DialogDescription>
              Loans are supported for SSS and Pagibig only. PhilHealth loans are
              not allowed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 dark:bg-gray-900">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Employee Picker */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Employee</Label>
                <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="h-9 w-full justify-between dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                    >
                      {selectedUser
                        ? userLabel(selectedUser)
                        : "Select employee…"}
                      <ChevronsUpDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] max-w-[95vw] p-0 dark:bg-gray-900 dark:border-gray-800"
                    align="start"
                  >
                    <Command className="dark:bg-gray-900">
                      <CommandInput placeholder="Search employee…" className="dark:text-gray-100" />
                      <CommandList>
                        <CommandEmpty className="dark:text-gray-400">No employee found.</CommandEmpty>
                        <CommandGroup>
                          {users.map((u) => (
                            <CommandItem
                              key={u.user_id}
                              value={`${u.user_id}-${userLabel(u)}`}
                              onSelect={() => {
                                setForm((p) => ({ ...p, user_id: u.user_id }));
                                setUserPickerOpen(false);
                              }}
                              className="dark:text-gray-200 dark:aria-selected:bg-gray-800"
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
                <Label className="text-xs dark:text-gray-300">Benefit</Label>
                <Select
                  value={(form.benefit_code ?? "SSS") as LoanBenefitCode}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      benefit_code: v as LoanBenefitCode,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-900 dark:border-gray-800">
                    <SelectItem value="SSS" className="dark:text-gray-200 dark:focus:bg-gray-800">SSS</SelectItem>
                    <SelectItem value="PAGIBIG" className="dark:text-gray-200 dark:focus:bg-gray-800">PAGIBIG</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Loan Name */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Loan Name</Label>
                <Input
                  className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 placeholder:text-gray-500"
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
                <Label className="text-xs dark:text-gray-300">Reference No</Label>
                <Input
                  className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 placeholder:text-gray-500"
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
                <Label className="text-xs dark:text-gray-300">Principal Amount</Label>
                <Input
                  className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  inputMode="decimal"
                  value={String(form.principal_amount ?? 0)}
                   onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      principal_amount: toNum(e.target.value),
                    }))
                   }
                />
              </div>

              {/* Interest Rate (%) */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Interest Rate (%)</Label>
                <Input
                  className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 placeholder:text-gray-500"
                  inputMode="decimal"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>

              {/* Auto: Interest */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Interest Amount (Auto)</Label>
                <Input
                  className="h-9 bg-muted/50 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400 cursor-not-allowed"
                  readOnly
                  value={fmtMoney(form.interest_amount)}
                />
              </div>

              {/* Auto: Total */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Total Payable (Auto)</Label>
                <Input
                  className="h-9 bg-muted/50 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400 cursor-not-allowed"
                  readOnly
                  value={fmtMoney(form.total_payable)}
                />
              </div>

              {/* Terms */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Terms (Installments)</Label>
                <Input
                  className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  inputMode="numeric"
                  value={String(form.terms_installments ?? 1)}
                   onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      terms_installments: toNum(e.target.value),
                    }))
                   }
                />
              </div>

              {/* Auto: Amortization */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Amortization Amount (Auto)</Label>
                <Input
                  className="h-9 bg-muted/50 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400 cursor-not-allowed"
                  readOnly
                  value={fmtMoney(form.amortization_amount)}
                />
              </div>

              {/* Deduct On */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Deduct On</Label>
                <Select
                  value={(form.deduct_on ?? "BOTH") as DeductOn}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, deduct_on: v as DeductOn }))
                  }
                >
                  <SelectTrigger className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-900 dark:border-gray-800">
                    <SelectItem value="BOTH" className="dark:text-gray-200 dark:focus:bg-gray-800">Both Cutoffs</SelectItem>
                    <SelectItem value="FIRST" className="dark:text-gray-200 dark:focus:bg-gray-800">1st Cutoff Only</SelectItem>
                    <SelectItem value="SECOND" className="dark:text-gray-200 dark:focus:bg-gray-800">2nd Cutoff Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Cutoff */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs dark:text-gray-300">Start Cutoff</Label>
                <Select
                  value={String(form.start_cutoff_id ?? 0)}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, start_cutoff_id: Number(v) }))
                  }
                >
                  <SelectTrigger className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-900 dark:border-gray-800">
                    {cutoffs.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)} className="dark:text-gray-200 dark:focus:bg-gray-800">
                        {cutoffLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Status</Label>
                <Select
                  value={(form.status ?? "ACTIVE") as BenefitLoanStatus}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, status: v as BenefitLoanStatus }))
                  }
                >
                  <SelectTrigger className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-900 dark:border-gray-800">
                    <SelectItem value="ACTIVE" className="dark:text-gray-200 dark:focus:bg-gray-800">Active</SelectItem>
                    <SelectItem value="CLOSED" className="dark:text-gray-200 dark:focus:bg-gray-800">Closed</SelectItem>
                    <SelectItem value="CANCELLED" className="dark:text-gray-200 dark:focus:bg-gray-800">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto: Remaining */}
              <div className="space-y-2">
                <Label className="text-xs dark:text-gray-300">Remaining Balance (Auto)</Label>
                <Input
                  className="h-9 bg-muted/50 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400 cursor-not-allowed"
                  readOnly
                  value={fmtMoney(form.remaining_balance)}
                />
              </div>

              {/* Remarks */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs dark:text-gray-300">Remarks</Label>
                <Textarea
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 placeholder:text-gray-500"
                  value={form.remarks ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, remarks: e.target.value || null }))
                  }
                  placeholder="Optional notes…"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t dark:border-gray-800 bg-background dark:bg-gray-900">
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
