"use client";

import React from "react";
import type { PayrollComputedLine } from "../types";
import { formatPHP } from "../utils/compute";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

export function EmployeeDetailsSheet({
  open,
  line,
  onOpenChange,
}: {
  open: boolean;
  line: PayrollComputedLine | null;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>{line?.employee_name ?? "Employee Details"}</SheetTitle>
          <SheetDescription>
            Benefits are deducted based on{" "}
            <span className="font-medium">benefit_cutoff_settings</span> for the
            current cutoff. Employee loans are deducted{" "}
            <span className="font-medium">50/50 per cutoff</span>. Benefit loans
            follow{" "}
            <span className="font-medium">benefit_loans amortization</span> per
            cutoff.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Rates</div>
              {line?.variance_flag ? (
                <Badge variant="destructive">Variance Alert</Badge>
              ) : null}
            </div>
            <Separator className="my-3" />
            <Row label="Daily" value={formatPHP(line?.daily_rate ?? 0)} />
            <Row label="Hourly" value={formatPHP(line?.hourly_rate ?? 0)} />
            <Row label="Monthly" value={formatPHP(line?.monthly_rate ?? 0)} />
          </div>

          <div className="rounded-md border p-3">
            <div className="font-semibold">Attendance Totals</div>
            <Separator className="my-3" />
            <Row label="Days Worked" value={line?.total_days_worked ?? 0} />
            <Row label="Work Minutes" value={line?.total_work_minutes ?? 0} />
            <Row label="Late Minutes" value={line?.late_minutes ?? 0} />
            <Row
              label="Undertime Minutes"
              value={line?.undertime_minutes ?? 0}
            />
            <Row label="OT Minutes" value={line?.overtime_minutes ?? 0} />
            <Row
              label="Night Diff Minutes"
              value={line?.night_diff_minutes ?? 0}
            />
          </div>

          <div className="rounded-md border p-3">
            <div className="font-semibold">Earnings</div>
            <Separator className="my-3" />
            <Row label="Basic Pay" value={formatPHP(line?.basic_pay ?? 0)} />
            <Row label="OT Amount" value={formatPHP(line?.ot_amount ?? 0)} />
            <Row
              label="Holiday Pay"
              value={formatPHP(line?.holiday_pay ?? 0)}
            />
            <Row
              label="Rest Day Amount"
              value={formatPHP(line?.rest_day_amount ?? 0)}
            />
            <Row
              label="Night Diff Amount"
              value={formatPHP(line?.night_diff_amount ?? 0)}
            />
            <Row
              label="Manual Additions"
              value={formatPHP(line?.manual_additions ?? 0)}
            />
          </div>

          <div className="rounded-md border p-3">
            <div className="font-semibold">Deductions</div>
            <Separator className="my-3" />

            <Row
              label="Late Deduction"
              value={formatPHP(line?.late_deduction ?? 0)}
            />
            <Row
              label="Undertime Deduction"
              value={formatPHP(line?.undertime_deduction ?? 0)}
            />
            <Row
              label="Shortage Deduction"
              value={formatPHP(line?.shortage_deduction ?? 0)}
            />

            <Separator className="my-3" />
            <div className="text-xs font-medium text-muted-foreground">
              Employee Loans (50/50 per cutoff)
            </div>
            <div className="mt-2 space-y-2">
              <Row
                label="Vale"
                value={formatPHP((line as any)?.loan_vale ?? 0)}
              />
              <Row
                label="Car Loan"
                value={formatPHP((line as any)?.loan_car ?? 0)}
              />
              <Row
                label="COOP"
                value={formatPHP((line as any)?.loan_coop ?? 0)}
              />
              <Row
                label="Loans Total"
                value={formatPHP((line as any)?.loan_total ?? 0)}
              />
            </div>

            <Separator className="my-3" />
            <div className="text-xs font-medium text-muted-foreground">
              Benefit Loans (amortization per cutoff)
            </div>
            <div className="mt-2 space-y-2">
              <Row
                label="SSS Loan"
                value={formatPHP((line as any)?.benefit_loan_sss ?? 0)}
              />
              <Row
                label="Pag-IBIG Loan"
                value={formatPHP((line as any)?.benefit_loan_pagibig ?? 0)}
              />
              <Row
                label="Benefit Loans Total"
                value={formatPHP((line as any)?.benefit_loan_total ?? 0)}
              />
            </div>

            <Separator className="my-3" />
            <Row label="SSS" value={formatPHP(line?.benefit_sss ?? 0)} />
            <Row
              label="PhilHealth"
              value={formatPHP(line?.benefit_philhealth ?? 0)}
            />
            <Row
              label="Pag-IBIG"
              value={formatPHP(line?.benefit_pagibig ?? 0)}
            />

            <Row
              label="Manual Deductions"
              value={formatPHP(line?.manual_deductions ?? 0)}
            />
          </div>

          <div className="rounded-md border p-3">
            <div className="font-semibold">Totals</div>
            <Separator className="my-3" />
            <Row label="Gross" value={formatPHP(line?.gross_pay ?? 0)} />
            <Row
              label="Total Deductions"
              value={formatPHP(line?.total_deductions ?? 0)}
            />
            <Row label="Net Pay" value={formatPHP(line?.net_pay ?? 0)} />
          </div>

          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            breakdown_json is saved for auditability. Benefits follow
            benefit_cutoff_settings; employee loans follow 50/50; benefit loans
            follow amortization per cutoff.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
