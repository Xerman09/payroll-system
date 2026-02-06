"use client";

import React from "react";
import { Card } from "@/components/ui/card";

export function PayrollProcessStep() {
  return (
    <Card className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="relative">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xl font-bold tracking-tight">Calculating Payroll...</div>
        <p className="max-w-[300px] text-sm text-muted-foreground">
          Consolidating Attendance, Loans, Taxes, and Adjustments into the register.
        </p>
      </div>
    </Card>
  );
}
