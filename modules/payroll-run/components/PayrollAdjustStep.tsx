"use client";

import React, { useMemo, useState } from "react";
import type {
  CutoffSetting,
  Department,
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollSummary,
} from "../types";
import { formatPHP } from "../utils/payroll";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { EmployeeDetailsSheet } from "./EmployeeDetailsSheet";

export function PayrollAdjustStep({
  cutoff,
  department,
  run,
  lines,
  summary,
  holdMap,
  onToggleHold,
  onRecompute,
  onNext,
}: {
  cutoff: CutoffSetting;
  department: Department | null;
  run: PayrollRunHeader | null;
  lines: PayrollComputedLine[];
  summary: PayrollSummary;
  holdMap: Map<number, boolean>;
  onToggleHold: (userId: number) => void;
  onRecompute: () => void;
  onNext: () => void;
}) {
  const [q, setQ] = useState("");
  const [activeUserId, setActiveUserId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return lines;
    return lines.filter((l) => l.employee_name.toLowerCase().includes(s));
  }, [q, lines]);

  const activeLine = useMemo(
    () =>
      activeUserId == null
        ? null
        : (lines.find((l) => l.user_id === activeUserId) ?? null),
    [activeUserId, lines],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Preview & Adjustments</CardTitle>
          <CardDescription>
            Cutoff: {cutoff.start_date} → {cutoff.end_date} (
            {cutoff.cutoff_type}) • Dept: {department?.name ?? "ALL"}
          </CardDescription>

          {run ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Ref: <span className="font-mono">{run.payroll_ref_no}</span> •
              Status: <span className="font-semibold">{run.status}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRecompute}>
            Recompute
          </Button>
          <Button onClick={onNext}>Process & Save →</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Headcount
            </div>
            <div className="mt-1 text-2xl font-bold">{summary.headcount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Gross
            </div>
            <div className="mt-1 text-xl font-bold text-primary">
              {formatPHP(summary.total_gross)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Deductions
            </div>
            <div className="mt-1 text-xl font-bold text-destructive">
              {formatPHP(summary.total_deductions)}
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-l-yellow-400">
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Variance Alerts
            </div>
            <div className="mt-1 text-xl font-bold">
              {summary.variance_alerts}
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee..."
            className="max-w-sm"
          />
          <div className="text-xs text-muted-foreground">
            Hold = exclude from totals and posting
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Status</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">OT</TableHead>
                <TableHead className="text-right">Holiday</TableHead>
                <TableHead className="text-right">Rest Day</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((l) => {
                const isHold = Boolean(holdMap.get(l.user_id));
                return (
                  <TableRow
                    key={l.user_id}
                    className={cn(isHold && "opacity-60")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={isHold}
                          onCheckedChange={() => onToggleHold(l.user_id)}
                        />
                        <div className="text-[11px]">
                          {isHold ? (
                            <span className="font-bold text-destructive">
                              HOLD
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold">{l.employee_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.position ?? "—"} • {l.department_name ?? "—"}
                      </div>
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm">
                      {formatPHP(l.basic_pay)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPHP(l.ot_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPHP(l.holiday_pay)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatPHP(l.rest_day_amount)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm text-destructive">
                      ({formatPHP(l.total_deductions)})
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm font-bold">
                      {formatPHP(l.net_pay)}
                    </TableCell>

                    <TableCell className="text-right">
                      {l.variance_pct == null ? (
                        <Badge variant="secondary">New</Badge>
                      ) : (
                        <span
                          className={cn(
                            "font-mono text-xs",
                            l.variance_flag
                              ? "text-destructive font-bold"
                              : "text-muted-foreground",
                          )}
                        >
                          {l.variance_pct > 0 ? "+" : ""}
                          {l.variance_pct.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveUserId(l.user_id)}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No employees match your search.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <EmployeeDetailsSheet
          open={activeUserId != null}
          line={activeLine}
          onOpenChange={(v) => setActiveUserId(v ? activeUserId : null)}
        />
      </CardContent>
    </Card>
  );
}
