"use client";

import React from "react";
import type { PayrollComputedRow, PayrollSummary } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP } from "../utils/payroll";
import { cn } from "@/lib/utils";

function VarianceCell({ row }: { row: PayrollComputedRow }) {
  if (row.variancePct === null) {
    return <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-900">New Hire</span>;
  }

  const pct = row.variancePct;
  const isNegative = pct < 0;
  const baseClass = row.varianceAlert ? "font-bold text-destructive" : isNegative ? "text-destructive" : "text-emerald-700";

  return (
    <span className={cn("font-mono text-xs", baseClass)}>
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function ProrationDetails({ row }: { row: PayrollComputedRow }) {
  if (!row.isProrated || !row.proratedDetails) return null;

  const d = row.proratedDetails;

  return (
    <div className="mt-2 inline-block rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] leading-5 text-blue-900">
      <div className="font-semibold">Wage Change Detected</div>
      <div>• {d.daysOnOldRate} days @ <span className="line-through opacity-70">{formatPHP(d.oldBasic)}</span></div>
      <div>• {d.daysOnNewRate} days @ <span className="font-semibold">{formatPHP(d.newBasic)}</span></div>
    </div>
  );
}

export function PayrollReviewStep({
  rows,
  summary,
  onBackToAdjust,
  onStartOver,
}: {
  rows: PayrollComputedRow[];
  summary: PayrollSummary;
  onBackToAdjust: () => void;
  onStartOver: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">Total Payout</div>
          <div className="mt-1 text-2xl font-bold text-primary">{formatPHP(summary.totalNet)}</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">Active Headcount</div>
          <div className="mt-1 text-2xl font-bold">{summary.activeHeadcount}</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-yellow-400">
          <div className="text-xs font-bold uppercase text-muted-foreground">Variance Alert</div>
          <div className="mt-1 text-sm">
            <span className="font-bold text-destructive">{summary.varianceAlerts}</span> employees have &gt;20% diff.
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Final Register</CardTitle>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.alert("Bank file (TXT/CSV) downloaded for BDO!")}>
              Download Bank File
            </Button>
            <Button variant="outline" onClick={() => window.alert("Payslips queued for email!")}>
              Email Payslips
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.alert("Payroll POSTED successfully!")}>
              Post Payroll
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead className="text-right">Variance (vs Prev)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <div className="font-semibold">{row.employeeName}</div>
                      <ProrationDetails row={row} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatPHP(row.gross)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-destructive">
                      ({formatPHP(row.deductions)})
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">{formatPHP(row.net)}</TableCell>
                    <TableCell className="text-right">
                      <VarianceCell row={row} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                        Ready
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No active employees in this run (all are on hold or none match filters).
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onBackToAdjust}>
                ← Back to Adjust
              </Button>
              <Button variant="outline" size="sm" onClick={onStartOver}>
                Start Over
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Variance compares Net Pay against the previous cutoff.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
