"use client";

import React from "react";
import type { PayrollStep } from "../types";
import { cn } from "@/lib/utils";

const STEPS: Array<{ step: PayrollStep; label: string }> = [
  { step: 1, label: "Config" },
  { step: 2, label: "Adjust" },
  { step: 3, label: "Process" },
  { step: 4, label: "Review" },
];

export function PayrollStepper({ activeStep }: { activeStep: PayrollStep }) {
  return (
    <div className="relative flex items-center justify-center gap-8">
      <div className="pointer-events-none absolute left-1/2 top-5 h-px w-[22rem] -translate-x-1/2 bg-border" />

      {STEPS.map((s) => {
        const isActive = s.step <= activeStep;
        return (
          <div
            key={s.step}
            className="relative z-10 flex w-20 flex-col items-center"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {s.step}
            </div>
            <div
              className={cn(
                "mt-2 text-[11px] font-semibold uppercase tracking-wide",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
