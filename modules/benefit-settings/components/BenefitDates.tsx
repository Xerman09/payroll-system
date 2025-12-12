"use client";

import { Input } from "@/components/ui/input";
import { BenefitSetting } from "../types";

export default function BenefitDates({
  value,
  onChange,
}: {
  value: BenefitSetting;
  onChange: (field: "effective_from" | "effective_to", val: string) => void;
}) {
  return (
    <div className="text-xs">
      <label className="font-medium">Effective Dates</label>
      <div className="grid grid-cols-2 gap-1 mt-0.5">
        <Input
          type="date"
          className="h-6 text-xs"
          value={value.effective_from || ""}
          onChange={(e) => onChange("effective_from", e.target.value)}
        />
        <Input
          type="date"
          className="h-6 text-xs"
          value={value.effective_to || ""}
          onChange={(e) => onChange("effective_to", e.target.value)}
        />
      </div>
    </div>
  );
}
