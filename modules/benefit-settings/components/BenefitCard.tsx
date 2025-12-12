"use client";

import { BenefitCode, BenefitSetting } from "../types";
import BenefitCutoff from "./BenefitCutoff";
import BenefitDates from "./BenefitDates";

export default function BenefitCard({
  name,
  code,
  setting,
  getUserName,
  onCutoff,
  onDateChange,
}: {
  name: string;
  code: BenefitCode;
  setting: BenefitSetting | null;
  getUserName: (id: number | null) => string;
  onCutoff: (c: BenefitCode, newValue: BenefitSetting["cutoff"]) => void;
  onDateChange: (
    code: BenefitCode,
    field: "effective_from" | "effective_to",
    val: string
  ) => void;
}) {
  const s = setting;

  return (
    <div className="p-4 space-y-3">
      <h2 className="font-medium text-sm">{name}</h2>

      {s && s.updated_by && (
        <p className="text-[10px] text-muted-foreground italic">
          Updated by {getUserName(s.updated_by)} on{" "}
          {s.updated_date ? new Date(s.updated_date).toLocaleDateString() : "—"}
        </p>
      )}

      <BenefitCutoff
        code={code}
        current={s?.cutoff || null}
        onChange={(v) => onCutoff(code, v)}
      />

      {s && (
        <BenefitDates
          value={s}
          onChange={(field, val) => onDateChange(code, field, val)}
        />
      )}
    </div>
  );
}
