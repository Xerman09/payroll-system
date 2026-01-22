"use client";

import * as React from "react";
import type { PayrollStep } from "../types";
import { cn } from "@/lib/utils";

type StepDef = {
  step: PayrollStep;
  label: string;
  description?: string;
};

const STEPS: StepDef[] = [
  { step: 1, label: "Config", description: "Select cutoff + department" },
  { step: 2, label: "Adjust", description: "Review employees + inputs" },
  { step: 3, label: "Process", description: "Compute + generate rows" },
  { step: 4, label: "Review", description: "Validate + post actions" },
];

export function PayrollStepper({
  activeStep,
  onStepClick,
}: {
  activeStep: PayrollStep;
  onStepClick?: (step: PayrollStep) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Payroll Run Workflow</div>
          <div className="text-xs text-muted-foreground">
            Follow the steps to generate and validate the payroll register.
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Step{" "}
          <span className="font-semibold text-foreground">{activeStep}</span> /{" "}
          {STEPS.length}
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-muted/20 p-4">
        <div className="relative">
          {/* line */}
          <div className="absolute left-0 right-0 top-5 hidden h-px bg-border sm:block" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STEPS.map((s) => {
              const isDone = s.step < activeStep;
              const isActive = s.step === activeStep;
              const isReachable = s.step <= activeStep; // conservative (no forward jumping)
              const clickable = Boolean(onStepClick) && isReachable;

              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => clickable && onStepClick?.(s.step)}
                  className={cn(
                    "group relative z-10 flex flex-col items-center rounded-md p-2 text-left transition",
                    clickable ? "hover:bg-muted/40" : "cursor-default",
                  )}
                  aria-current={isActive ? "step" : undefined}
                  disabled={!clickable}
                  title={clickable ? "Go to step" : undefined}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                      isDone
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {s.step}
                  </div>

                  <div
                    className={cn(
                      "mt-2 text-[11px] font-semibold uppercase tracking-wide",
                      isDone
                        ? "text-emerald-700"
                        : isActive
                          ? "text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </div>

                  {s.description ? (
                    <div className="mt-1 hidden max-w-[180px] text-center text-[11px] text-muted-foreground sm:block">
                      {s.description}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Tip: Finish{" "}
          <span className="font-medium text-foreground">Config</span> first to
          ensure the correct cutoff and department scope, then proceed to
          employee adjustments.
        </div>
      </div>
    </div>
  );
}
