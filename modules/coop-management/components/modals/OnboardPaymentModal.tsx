"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { HandCoins, Info, CheckCircle2 } from "lucide-react";

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

import type { EmployeeLoan, User } from "../../types";
import { createItem, updateItem } from "../../providers/coopApi";
import { formatPeso, getLoggedUserIdFallback1 } from "../../helpers";

export function OnboardPaymentModal({
  isOpen,
  selectedLoan,
  loans,
  users,
  paymentsMap,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  selectedLoan: EmployeeLoan | null;
  loans: EmployeeLoan[];
  users: User[];
  paymentsMap: Record<number, number>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loanId, setLoanId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [periodMonth, setPeriodMonth] = useState<string>(() =>
    format(new Date(), "yyyy-MM-01")
  );
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("Onboarding previous loan payment");
  const [submitting, setSubmitting] = useState(false);

  // Initialize or synchronize state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (selectedLoan) {
        setLoanId(String(selectedLoan.loan_id));
      } else if (loans.length > 0) {
        const firstActive = loans.find((l) => l.status === "ACTIVE") || loans[0];
        setLoanId(String(firstActive.loan_id));
      } else {
        setLoanId("");
      }
      setAmount("");
      const todayStr = format(new Date(), "yyyy-MM-dd");
      setPaymentDate(todayStr);
      setPeriodMonth(`${todayStr.slice(0, 7)}-01`);
      setReferenceNo("");
      setRemarks("Onboarding previous loan payment");
    }
  }, [isOpen, selectedLoan, loans]);

  // Resolve currently active target loan
  const targetLoan = useMemo(() => {
    if (selectedLoan && String(selectedLoan.loan_id) === String(loanId)) {
      return selectedLoan;
    }
    return loans.find((l) => String(l.loan_id) === String(loanId)) || null;
  }, [selectedLoan, loanId, loans]);

  // Derived financial stats
  const { employeeName, totalLoan, currentPaid, balance, monthlyAmort } = useMemo(() => {
    if (!targetLoan) {
      return {
        employeeName: "N/A",
        totalLoan: 0,
        currentPaid: 0,
        balance: 0,
        monthlyAmort: 0,
      };
    }

    const user = users.find((u) => Number(u.user_id) === Number(targetLoan.user_id));
    const name = user ? `${user.user_fname} ${user.user_lname}`.trim() : `User #${targetLoan.user_id}`;
    const tLoan = Number(targetLoan.loan_amount || 0);
    const cPaid = Math.max(
      Number(targetLoan.accumulated_amount || 0),
      paymentsMap[Number(targetLoan.loan_id)] ?? 0
    );
    const rem = Math.max(0, tLoan - cPaid);
    const amort = Number(targetLoan.monthly_payment || 0);

    return {
      employeeName: name,
      totalLoan: tLoan,
      currentPaid: cPaid,
      balance: rem,
      monthlyAmort: amort,
    };
  }, [targetLoan, users, paymentsMap]);

  const numAmount = Number(amount) || 0;
  const newTotalPaid = currentPaid + numAmount;
  const newBalance = Math.max(0, balance - numAmount);
  const willBePaid = (totalLoan > 0 && newTotalPaid >= totalLoan) || (numAmount > 0 && newBalance <= 0);

  const handlePaymentDateChange = (val: string) => {
    setPaymentDate(val);
    if (val && val.length >= 7) {
      setPeriodMonth(`${val.slice(0, 7)}-01`);
    }
  };

  const handleSubmit = async () => {
    if (!targetLoan) {
      toast.error("Please select a valid loan.");
      return;
    }

    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (!paymentDate) {
      toast.error("Please select a payment date.");
      return;
    }

    setSubmitting(true);
    try {
      const pmMonth = periodMonth || `${paymentDate.slice(0, 7)}-01`;

      // 1. Insert into employee_loan_payment
      const paymentPayload = {
        loan_id: Number(targetLoan.loan_id),
        user_id: Number(targetLoan.user_id),
        payment_date: paymentDate,
        period_month: pmMonth,
        amount_paid: Number(numAmount.toFixed(2)),
        reference_no: referenceNo ? referenceNo.trim() : null,
        remarks: remarks ? remarks.trim() : "Onboarding previous loan payment",
        posted_by: Number(getLoggedUserIdFallback1()),
        posted_at: new Date().toISOString(),
      };

      await createItem("employee_loan_payment", paymentPayload);

      // 2. Synchronize accumulated_amount on employee_loan record
      const loanUpdatePayload: Partial<EmployeeLoan> = {
        accumulated_amount: Number(newTotalPaid.toFixed(2)),
        updated_by: Number(getLoggedUserIdFallback1()),
      };

      if (willBePaid && targetLoan.status === "ACTIVE") {
        loanUpdatePayload.status = "PAID";
      }

      await updateItem<EmployeeLoan>("employee_loan", targetLoan.loan_id, loanUpdatePayload);

      toast.success(
        `Payment of ${formatPeso(numAmount)} onboarded successfully${willBePaid ? " (Loan is now PAID)" : ""}.`
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to onboard loan payment:", err);
      toast.error("Failed to record previous loan payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <HandCoins className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Onboard Previous Loan Payment</DialogTitle>
              <DialogDescription>
                Record prior or historical payments made outside the regular payroll deductions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-3">
          {/* Loan Selector if not already pre-selected, or display if pre-selected */}
          {!selectedLoan ? (
            <div className="grid gap-2">
              <Label>Select Employee Loan</Label>
              <Select value={loanId} onValueChange={setLoanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a loan..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {loans.map((ln) => {
                    const u = users.find((usr) => Number(usr.user_id) === Number(ln.user_id));
                    const name = u ? `${u.user_fname} ${u.user_lname}`.trim() : `User #${ln.user_id}`;
                    const lPaid = Math.max(
                      Number(ln.accumulated_amount || 0),
                      paymentsMap[Number(ln.loan_id)] ?? 0
                    );
                    const rem = Math.max(0, Number(ln.loan_amount || 0) - lPaid);
                    return (
                      <SelectItem key={ln.loan_id} value={String(ln.loan_id)}>
                        {name} — Loan #{ln.loan_id} (Bal: {formatPeso(rem)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Loan Summary Info Card */}
          {targetLoan && (
            <div className="rounded-lg border bg-gray-50/70 dark:bg-gray-900/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Employee & Loan
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {employeeName}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      targetLoan.status === "ACTIVE"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    Loan #{targetLoan.loan_id} • {targetLoan.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t text-xs">
                <div>
                  <div className="text-muted-foreground">Total Loan</div>
                  <div className="font-semibold font-mono text-gray-800 dark:text-gray-200">
                    {formatPeso(totalLoan)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Current Total Paid</div>
                  <div className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatPeso(currentPaid)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Current Balance</div>
                  <div className="font-semibold font-mono text-amber-600 dark:text-amber-400">
                    {formatPeso(balance)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Amount */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="payment-amount">Payment Amount (PHP)</Label>
              {balance > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  {monthlyAmort > 0 && monthlyAmort < balance && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(monthlyAmort))}
                      className="text-primary hover:underline"
                    >
                      Monthly ({formatPeso(monthlyAmort)})
                    </button>
                  )}
                  {monthlyAmort > 0 && monthlyAmort < balance && (
                    <span className="text-muted-foreground">•</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setAmount(String(balance))}
                    className="text-primary hover:underline font-medium"
                  >
                    Full Balance ({formatPeso(balance)})
                  </button>
                </div>
              )}
            </div>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-base font-mono"
            />
          </div>

          {/* Live Balance Impact Preview */}
          {numAmount > 0 && (
            <div className="rounded-md bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 p-2.5 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-muted-foreground">New Total Paid: </span>
                <span className="font-semibold font-mono text-emerald-700 dark:text-emerald-300">
                  {formatPeso(newTotalPaid)}
                </span>
                <span className="mx-2 text-muted-foreground">|</span>
                <span className="text-muted-foreground">New Balance: </span>
                <span className="font-semibold font-mono text-gray-800 dark:text-gray-200">
                  {formatPeso(newBalance)}
                </span>
              </div>
              {willBePaid && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marks loan as PAID
                </span>
              )}
            </div>
          )}

          {/* Dates: Payment Date & Period Month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="payment-date">Payment Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => handlePaymentDateChange(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="period-month">Period Month</Label>
              <Input
                id="period-month"
                type="date"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
              />
            </div>
          </div>

          {/* Reference & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ref-no">Reference / OR No. (Optional)</Label>
              <Input
                id="ref-no"
                placeholder="e.g. OR-10294 or MANUAL-01"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="remarks">Remarks / Notes</Label>
              <Input
                id="remarks"
                placeholder="e.g. Historical cash payment"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 p-2 rounded">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <span>
              This will record the payment entry in the loan payments ledger and automatically update the loan&apos;s total paid balance.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !numAmount || numAmount <= 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {submitting ? "Recording Payment..." : "Onboard Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
