"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { BenefitCode, CutoffType } from "../types";

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
    <div className="grid grid-cols-2 gap-2 text-xs">
      <label className="flex items-center space-x-1">
        <Checkbox
          checked={current === "FIRST"}
          onCheckedChange={() => onChange(current === "FIRST" ? null : "FIRST")}
        />
        <span>First Cutoff</span>
      </label>

      <label className="flex items-center space-x-1">
        <Checkbox
          checked={current === "SECOND"}
          onCheckedChange={() =>
            onChange(current === "SECOND" ? null : "SECOND")
          }
        />
        <span>Second Cutoff</span>
      </label>
    </div>
  );
}
