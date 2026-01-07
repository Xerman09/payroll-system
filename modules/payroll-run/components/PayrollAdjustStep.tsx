"use client";

import React from "react";
import type { EmployeeRow } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPHP } from "../utils/payroll";
import { cn } from "@/lib/utils";

function AdjustmentBadges({ employee }: { employee: EmployeeRow }) {
  const list = employee.adjustments;
  if (list.length === 0) {
    return <span className="text-xs text-muted-foreground">No adjustments</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {list.map((adj, idx) => (
        <span
          key={`${employee.id}-${idx}`}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            adj.type === "EARNING" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800",
          )}
          title={adj.desc}
        >
          {adj.type === "EARNING" ? "+" : "-"}
          {adj.amount}
        </span>
      ))}
    </div>
  );
}

export function PayrollAdjustStep({
  employees,
  onToggleHold,
  onOpenAdjustment,
  onNext,
}: {
  employees: EmployeeRow[];
  onToggleHold: (employeeId: number) => void;
  onOpenAdjustment: (employeeId: number) => void;
  onNext: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Preview & Adjustments</CardTitle>
          <CardDescription>Review active employees and add manual adjustments.</CardDescription>
        </div>

        <Button onClick={onNext}>Process Payroll →</Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Status</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Base Pay</TableHead>
                <TableHead>Pending Adjustments</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id} className={cn(emp.onHold && "opacity-60")}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Switch checked={emp.onHold} onCheckedChange={() => onToggleHold(emp.id)} />
                      <div className="text-[11px]">
                        {emp.onHold ? (
                          <span className="font-bold text-destructive">HOLD</span>
                        ) : (
                          <span className="text-muted-foreground">Active</span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-semibold">{emp.name}</div>
                    <div className="text-xs text-muted-foreground">{emp.position}</div>
                  </TableCell>

                  <TableCell className="font-mono text-sm">{formatPHP(emp.basic)}</TableCell>

                  <TableCell>
                    <AdjustmentBadges employee={emp} />
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenAdjustment(emp.id)}
                      disabled={emp.onHold}
                    >
                      + Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No employees found for the selected department.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="text-xs text-muted-foreground">
          * Toggling "Hold" will exclude the employee from this payroll run entirely.
        </div>
      </CardContent>
    </Card>
  );
}
