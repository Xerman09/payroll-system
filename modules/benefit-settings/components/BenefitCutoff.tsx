"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BenefitCode, CutoffType } from "../types";
import { CalendarDays } from "lucide-react";

export default function BenefitCutoff({
  code,
  current,
  onChange,
}: {
  code: BenefitCode;
  current: CutoffType;
  onChange: (newValue: CutoffType) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/80 dark:text-gray-300">
        <CalendarDays className="h-4 w-4 text-primary dark:text-primary/70" />
        <span>Payroll Cutoff</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`
            flex items-center space-x-2 border dark:border-gray-800 rounded-md p-3 transition-colors
            ${
              current === "FIRST"
                ? "bg-primary/5 border-primary dark:bg-primary/10 dark:border-primary/30"
                : "hover:bg-muted/50 dark:hover:bg-gray-800/50"
            }
          `}
        >
          <Checkbox
            id={`${code}-first`}
            checked={current === "FIRST"}
            onCheckedChange={() =>
              onChange(current === "FIRST" ? null : "FIRST")
            }
          />
          <Label
            htmlFor={`${code}-first`}
            className="text-xs font-normal cursor-pointer flex-1"
          >
            1st Cutoff
          </Label>
        </div>

        <div
          className={`
            flex items-center space-x-2 border dark:border-gray-800 rounded-md p-3 transition-colors
            ${
              current === "SECOND"
                ? "bg-primary/5 border-primary dark:bg-primary/10 dark:border-primary/30"
                : "hover:bg-muted/50 dark:hover:bg-gray-800/50"
            }
          `}
        >
          <Checkbox
            id={`${code}-second`}
            checked={current === "SECOND"}
            onCheckedChange={() =>
              onChange(current === "SECOND" ? null : "SECOND")
            }
          />
          <Label
            htmlFor={`${code}-second`}
            className="text-xs font-normal cursor-pointer flex-1"
          >
            2nd Cutoff
          </Label>
        </div>
      </div>
    </div>
  );
}
