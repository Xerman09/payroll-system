// modules/lgu-payroll-run/components/LguPayrollStepper.tsx
"use client";

import React from "react";
import { Check, Settings, Calculator, Cpu, FileSpreadsheet } from "lucide-react";
import { LguPayrollStep } from "../types";

interface LguPayrollStepperProps {
  currentStep: LguPayrollStep;
  onStepClick?: (step: LguPayrollStep) => void;
  maxStepAllowed: LguPayrollStep;
}

const STEPS: { step: LguPayrollStep; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { step: 1, title: "1. Kompigurasyon", subtitle: "Cutoff & Office Selection", icon: Settings },
  { step: 2, title: "2. Kalkulasyon", subtitle: "Cost-Sharing & Deductions", icon: Calculator },
  { step: 3, title: "3. Pagproseso", subtitle: "Batch Draft Validation", icon: Cpu },
  { step: 4, title: "4. Pagsusuri & Top Sheet", subtitle: "Review, DV & Post", icon: FileSpreadsheet },
];

export default function LguPayrollStepper({
  currentStep,
  onStepClick,
  maxStepAllowed,
}: LguPayrollStepperProps) {
  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const isDone = currentStep > s.step;
          const isCurrent = currentStep === s.step;
          const isClickable = s.step <= maxStepAllowed && onStepClick;

          let cardStyle = "border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/30 text-slate-400";
          let badgeStyle = "bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300";

          if (isCurrent) {
            cardStyle = "border-blue-500/80 bg-blue-50/60 dark:bg-blue-950/30 shadow-sm text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/50";
            badgeStyle = "bg-blue-600 text-white";
          } else if (isDone) {
            cardStyle = "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200";
            badgeStyle = "bg-emerald-600 text-white";
          }

          return (
            <button
              type="button"
              key={s.step}
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(s.step)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${cardStyle} ${
                isClickable ? "cursor-pointer hover:shadow" : "cursor-default"
              }`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${badgeStyle}`}>
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{s.title}</div>
                <div className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{s.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
