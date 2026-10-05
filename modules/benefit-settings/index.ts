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
import EmployeeBenefitsTab from "./components/EmployeeBenefitsTab";
import BenefitEmployeesDialog from "./components/BenefitEmployeesDialog";

export {
  BenefitSettingsModule,
  GovernmentBenefitSettingsModule,
  PrivateBenefitSettingsModule,
  EmployeeBenefitsTab,
  BenefitEmployeesDialog,
};

// Alias (optional future rename without breaking imports)
export { BenefitSettingsModule as ManageBenefitsModule };

export default BenefitSettingsModule;
