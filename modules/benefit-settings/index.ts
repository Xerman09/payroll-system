import BenefitSettingsModule from "./BenefitSettingsModule";
import type { BenefitCode } from "./types";

export const BENEFITS: { code: BenefitCode; name: string }[] = [
  { code: "SSS", name: "SSS" },
  { code: "PAGIBIG", name: "Pagibig" },
  { code: "PHILHEALTH", name: "Philhealth" },
];

export { BenefitSettingsModule };
