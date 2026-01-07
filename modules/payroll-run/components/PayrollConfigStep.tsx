"use client";

import React from "react";
import type { PayrollConfigState } from "../types";

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

type Option = { value: string; label: string };

interface PayrollConfigStepProps {
  config: PayrollConfigState;
  cutoffs: Option[];
  departments: Option[];
  onChange: (patch: Partial<PayrollConfigState>) => void;
  onNext: () => void;
}

export function PayrollConfigStep({
  config,
  cutoffs,
  departments,
  onChange,
  onNext,
}: PayrollConfigStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Payroll Period</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose cutoff and department scope.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cutoff Date Range</Label>
            <Select
              value={config.cutoffValue}
              onValueChange={(v) => onChange({ cutoffValue: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cutoff..." />
              </SelectTrigger>
              <SelectContent>
                {cutoffs.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={config.departmentValue}
              onValueChange={(v) => onChange({ departmentValue: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
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
            This will auto-fetch Attendance, Loans, and Coop Savings. (Prototype
            uses static data; integrations will be wired later.)
          </AlertDescription>
        </Alert>
      </CardContent>

      <CardFooter className="justify-end">
        <Button onClick={onNext}>Proceed to Adjustments</Button>
      </CardFooter>
    </Card>
  );
}
