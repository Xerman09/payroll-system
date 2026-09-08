// modules/benefit-settings/index.ts
import BenefitSettingsModule from "./BenefitSettingsModule";
import type { BenefitCode } from "./types";

export const BENEFITS: { code: BenefitCode; name: string }[] = [
  { code: "SSS", name: "SSS" },
  { code: "PAGIBIG", name: "Pagibig" },
  { code: "PHILHEALTH", name: "Philhealth" },
];

import GovernmentBenefitSettingsModule from "./government/GovernmentBenefitSettingsModule";
import PrivateBenefitSettingsModule from "./PrivateBenefitSettingsModule";

export {
  BenefitSettingsModule,
  GovernmentBenefitSettingsModule,
  PrivateBenefitSettingsModule,
};

// Alias (optional future rename without breaking imports)
export { BenefitSettingsModule as ManageBenefitsModule };

export default BenefitSettingsModule;
