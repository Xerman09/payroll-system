"use client";

import { BenefitCode, BenefitSetting } from "../types";
import * as benefitApi from "./benefitApi";

const BENEFITS: { code: BenefitCode }[] = [
  { code: "SSS" },
  { code: "PAGIBIG" },
  { code: "PHILHEALTH" },
];

export function useBenefitCrud() {
  async function save(settings: Record<BenefitCode, BenefitSetting | null>) {
    for (const b of BENEFITS) {
      const s = settings[b.code];
      if (!s) continue;
      await benefitApi.saveBenefitSetting(s);
    }
  }

  return { save };
}
