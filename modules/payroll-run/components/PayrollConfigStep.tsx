"use client";

import React from "react";
import type { CutoffSetting, Department, PayrollConfigState } from "../types";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PayrollConfigStep({
  loading,
  config,
  cutoffs,
  departments,
  onChange,
  onNext,
}: {
  loading: boolean;
  config: PayrollConfigState;
  cutoffs: CutoffSetting[];
  departments: Department[];
  onChange: (patch: Partial<PayrollConfigState>) => void;
  onNext: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Payroll Period</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose cutoff and department scope. This will load Attendance,
          Holidays, Wage Profiles, and Manual Entries.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cutoff</Label>
            <Select
              value={config.cutoffId == null ? "" : String(config.cutoffId)}
              onValueChange={(v) => onChange({ cutoffId: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cutoff..." />
              </SelectTrigger>
              <SelectContent>
                {cutoffs.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.start_date} → {c.end_date} ({c.cutoff_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={
                config.departmentId == null
                  ? "ALL"
                  : String(config.departmentId)
              }
              onValueChange={(v) =>
                onChange({ departmentId: v === "ALL" ? null : Number(v) })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>System Note</AlertTitle>
          <AlertDescription>
            If a DRAFT payroll run already exists for this cutoff+department,
            the module will load it. Otherwise, it will create a new DRAFT run.
          </AlertDescription>
        </Alert>
      </CardContent>

      <CardFooter className="justify-end">
        <Button onClick={onNext} disabled={loading || config.cutoffId == null}>
          {loading ? "Loading..." : "Proceed"}
        </Button>
      </CardFooter>
    </Card>
  );
}
