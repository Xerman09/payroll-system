"use client";

import React from "react";
import { Card } from "@/components/ui/card";

export function PayrollProcessStep() {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
      <div className="mt-2 text-lg font-semibold">Calculating Payroll...</div>
      <div className="text-sm text-muted-foreground">
        Consolidating Attendance, Loans, Taxes, and Adjustments.
      </div>
    </Card>
  );
}
