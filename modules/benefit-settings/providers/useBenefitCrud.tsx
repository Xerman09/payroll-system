"use client";

import { BenefitCode, BenefitSetting } from "../types";

const BENEFITS: { code: BenefitCode; name: string }[] = [
  { code: "SSS", name: "SSS" },
  { code: "PAGIBIG", name: "Pagibig" },
  { code: "PHILHEALTH", name: "Philhealth" },
];

export function useBenefitCrud() {
  async function save(settings: Record<BenefitCode, BenefitSetting | null>) {
    for (const b of BENEFITS) {
      const s = settings[b.code];
      if (!s) continue;

      const payload = {
        benefit_code: s.benefit_code,
        benefit_name: s.benefit_name,
        cutoff: s.cutoff,
        is_active: 1,
        effective_from: s.effective_from,
        effective_to: s.effective_to,
        updated_by: 176,
      };

      await fetch(
        `http://100.126.246.124:8060/items/benefit_cutoff_settings/${
          s.id || ""
        }`,
        {
          method: s.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    }
  }

  return { save };
}
