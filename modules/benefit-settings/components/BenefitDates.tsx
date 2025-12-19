"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BenefitSetting } from "../types";
import { Clock } from "lucide-react";

export default function BenefitDates({
  value,
  onChange,
}: {
  value: BenefitSetting;
  onChange: (field: "effective_from" | "effective_to", val: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
        <Clock className="h-4 w-4 text-primary" />
        <span>Effectivity Period</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
            From
          </Label>
          <Input
            type="date"
            className="h-9 text-xs" // Standard compact height
            value={value.effective_from || ""}
            onChange={(e) => onChange("effective_from", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
            To
          </Label>
          <Input
            type="date"
            className="h-9 text-xs"
            value={value.effective_to || ""}
            onChange={(e) => onChange("effective_to", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
