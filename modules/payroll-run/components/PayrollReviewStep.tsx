"use client";

import React from "react";
import type {
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollSummary,
} from "../types";
import { formatPHP } from "../utils/payroll";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function PayrollReviewStep({
  run,
  rows,
  summary,
  onBackToAdjust,
  onStartOver,
  onPost,
}: {
  run: PayrollRunHeader | null;
  rows: PayrollComputedLine[];
  summary: PayrollSummary;
  onBackToAdjust: () => void;
  onStartOver: () => void;
  onPost: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">
            Total Net
          </div>
          <div className="mt-1 text-2xl font-bold text-primary">
            {formatPHP(summary.total_net)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">
            Headcount
          </div>
          <div className="mt-1 text-2xl font-bold">{summary.headcount}</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">
            Variance Alerts
          </div>
          <div className="mt-1 text-2xl font-bold">
            {summary.variance_alerts}
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs font-bold uppercase text-muted-foreground">
            Run Status
          </div>
          <div className="mt-2 text-sm">
            <span className="font-mono">{run?.payroll_ref_no ?? "—"}</span>
            <div className="font-semibold">{run?.status ?? "DRAFT"}</div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Final Register</CardTitle>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onBackToAdjust}>
              ← Back
            </Button>
            <Button variant="outline" onClick={onStartOver}>
              Start Over
            </Button>
            <Button onClick={onPost} disabled={run?.status === "POSTED"}>
              Post Payroll
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.user_id}
                    className={cn(r.on_hold && "opacity-60")}
                  >
                    <TableCell>
                      <div className="font-semibold">{r.employee_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.department_name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPHP(r.gross_pay)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-destructive">
                      ({formatPHP(r.total_deductions)})
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      {formatPHP(r.net_pay)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.variance_pct == null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "font-mono text-xs",
                            r.variance_flag
                              ? "text-destructive font-bold"
                              : "text-muted-foreground",
                          )}
                        >
                          {r.variance_pct > 0 ? "+" : ""}
                          {r.variance_pct.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No rows.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
