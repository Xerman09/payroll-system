// modules/benefit-settings/components/LoanScheduleDialog.tsx
"use client";

import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";

import type { BenefitLoan, CutoffSetting } from "../types";
import {
  cutoffLabel,
  computeLoanCutoffSchedule,
} from "../providers/benefitApi";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export default function LoanScheduleDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loan: BenefitLoan | null;
  cutoffs: CutoffSetting[];
}) {
  const { open, onOpenChange, loan, cutoffs } = props;

  const sched = React.useMemo(() => {
    if (!loan) {
      return {
        all: [] as CutoffSetting[],
        paid: [] as CutoffSetting[],
        upcoming: [] as CutoffSetting[],
        nextDue: null,
        endDue: null,
      };
    }
    return computeLoanCutoffSchedule({ loan, cutoffs });
  }, [loan, cutoffs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl dark:bg-gray-900 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle>Loan Schedule</DialogTitle>
          <DialogDescription>
            This schedule is computed from the loan’s start cutoff, deduct rule,
            terms, and paid installments.
          </DialogDescription>
        </DialogHeader>

        {!loan ? (
          <div className="text-sm text-slate-500 dark:text-gray-400">No loan selected.</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 p-3 text-sm">
              <div className="font-medium dark:text-gray-200">
                {loan.benefit_code} — {loan.loan_name || "Loan"}
              </div>
              <div className="text-xs text-slate-600 dark:text-gray-400">
                Deduct: {loan.deduct_on} • Terms: {loan.terms_installments} •
                Paid: {loan.paid_installments}
              </div>
              {sched.nextDue ? (
                <div className="mt-2 text-xs text-slate-700 dark:text-gray-300">
                  Next Due:{" "}
                  <span className="font-medium">
                    {cutoffLabel(sched.nextDue)}
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-600 dark:text-gray-400">
                  No upcoming due cutoffs.
                </div>
              )}
            </div>

            <Separator />

            <div className="max-h-[360px] overflow-auto space-y-2 pr-1">
              {sched.all.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No computed schedule (start cutoff not found).
                </div>
              ) : (
                sched.all.map((c: CutoffSetting, idx: number) => {
                  const isPaid = sched.paid.some((x: CutoffSetting) => x.id === c.id);
                  return (
                    <div
                      key={c.id}
                      className="flex items-start gap-1 rounded-lg border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-gray-900 shadow-sm"
                    >
                      <div className="mt-0.5">
                        {isPaid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-400 dark:text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium dark:text-gray-200">
                          #{idx + 1} — {cutoffLabel(c)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          {isPaid ? "Paid" : "Pending"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
