// modules/benefit-settings/utils/governmentContributions.ts

/**
 * Government / LGU Statutory Contribution Standards
 * 
 * 1. GSIS (replaces SSS for government/LGU personnel):
 *    - Personal Share: 9% of basic salary (deducted directly from payslip)
 *    - Government Share (LGU): 12% of basic salary
 *    - Total Contribution: 21%
 * 
 * 2. PhilHealth (Universal Health Care):
 *    - Total Contribution: 5% of monthly basic salary
 *    - Personal Share: 2.5%
 *    - Government Share: 2.5% (50/50 split)
 *    - Salary Base Bracket: ₱10,000.00 to ₱100,000.00
 * 
 * 3. Pag-IBIG (HDMF / DBM Circular):
 *    - Standard Monthly Contribution: ₱200.00 per DBM
 *    - Personal Share: ₱100.00 (min) to ₱200.00 (standard)
 *    - Government Share: ₱100.00 to ₱200.00
 *    - Below ₱1,500 salary: 1% personal, 2% LGU
 */

export const GSIS_PERSONAL_RATE = 0.09;
export const GSIS_GOVERNMENT_RATE = 0.12;
export const GSIS_TOTAL_RATE = 0.21;

export const PHILHEALTH_PERSONAL_RATE = 0.025;
export const PHILHEALTH_GOVERNMENT_RATE = 0.025;
export const PHILHEALTH_TOTAL_RATE = 0.05;
export const PHILHEALTH_MIN_BASE = 10000;
export const PHILHEALTH_MAX_BASE = 100000;

export const PAGIBIG_STANDARD_PERSONAL = 200;
export const PAGIBIG_STANDARD_GOVERNMENT = 200;
export const PAGIBIG_MIN_PERSONAL = 100;

export interface StatutoryBreakdown {
  employeeShare: number;
  governmentShare: number;
  totalContribution: number;
  basisSalary: number;
  rateNotes: string;
}

export interface GovernmentBenefitsSummary {
  basicSalary: number;
  gsis: StatutoryBreakdown;
  philhealth: StatutoryBreakdown;
  pagibig: StatutoryBreakdown;
  totalEmployeeDeduction: number;
  totalGovernmentCounterpart: number;
  grandTotalRemittance: number;
}

export function computeGsis(basicSalary: number): StatutoryBreakdown {
  const salary = Math.max(0, Number(basicSalary) || 0);
  const employeeShare = Math.round(salary * GSIS_PERSONAL_RATE * 100) / 100;
  const governmentShare = Math.round(salary * GSIS_GOVERNMENT_RATE * 100) / 100;
  const totalContribution = Math.round((employeeShare + governmentShare) * 100) / 100;

  return {
    employeeShare,
    governmentShare,
    totalContribution,
    basisSalary: salary,
    rateNotes: "9% Personal (Bawas sa Sahod) | 12% Government (LGU Share) = 21% Total",
  };
}

export function computePhilHealth(basicSalary: number): StatutoryBreakdown {
  const rawSalary = Math.max(0, Number(basicSalary) || 0);
  // Base is bounded between ₱10,000 and ₱100,000
  const basisSalary = Math.min(Math.max(rawSalary, PHILHEALTH_MIN_BASE), PHILHEALTH_MAX_BASE);

  const totalRaw = basisSalary * PHILHEALTH_TOTAL_RATE;
  // 50/50 split
  const employeeShare = Math.round((totalRaw / 2) * 100) / 100;
  const governmentShare = Math.round((totalRaw / 2) * 100) / 100;
  const totalContribution = Math.round((employeeShare + governmentShare) * 100) / 100;

  return {
    employeeShare,
    governmentShare,
    totalContribution,
    basisSalary,
    rateNotes: "2.5% Personal | 2.5% LGU (50/50 Hati, ₱10,000 - ₱100,000 bracket)",
  };
}

export function computePagibig(
  basicSalary: number,
  customPersonalShare?: number
): StatutoryBreakdown {
  const salary = Math.max(0, Number(basicSalary) || 0);

  if (salary > 0 && salary < 1500) {
    const employeeShare = Math.round(salary * 0.01 * 100) / 100;
    const governmentShare = Math.round(salary * 0.02 * 100) / 100;
    return {
      employeeShare,
      governmentShare,
      totalContribution: employeeShare + governmentShare,
      basisSalary: salary,
      rateNotes: "Below ₱1,500: 1% Personal | 2% LGU Share",
    };
  }

  const employeeShare = customPersonalShare != null && customPersonalShare >= PAGIBIG_MIN_PERSONAL
    ? customPersonalShare
    : PAGIBIG_STANDARD_PERSONAL;

  // LGU government counterpart matches standard ₱200 (or equal to employee up to ₱200)
  const governmentShare = Math.min(employeeShare, PAGIBIG_STANDARD_GOVERNMENT);
  const totalContribution = employeeShare + governmentShare;

  return {
    employeeShare,
    governmentShare,
    totalContribution,
    basisSalary: salary,
    rateNotes: "₱200.00 DBM Standard (₱100.00 min to ₱200.00 Personal | ₱200.00 LGU Share)",
  };
}

export function computeGovernmentStatutorySummary(
  basicSalary: number,
  customPagibigPersonal?: number
): GovernmentBenefitsSummary {
  const salary = Math.max(0, Number(basicSalary) || 0);
  const gsis = computeGsis(salary);
  const philhealth = computePhilHealth(salary);
  const pagibig = computePagibig(salary, customPagibigPersonal);

  const totalEmployeeDeduction =
    Math.round((gsis.employeeShare + philhealth.employeeShare + pagibig.employeeShare) * 100) / 100;
  const totalGovernmentCounterpart =
    Math.round((gsis.governmentShare + philhealth.governmentShare + pagibig.governmentShare) * 100) / 100;
  const grandTotalRemittance =
    Math.round((totalEmployeeDeduction + totalGovernmentCounterpart) * 100) / 100;

  return {
    basicSalary: salary,
    gsis,
    philhealth,
    pagibig,
    totalEmployeeDeduction,
    totalGovernmentCounterpart,
    grandTotalRemittance,
  };
}

export function formatPhp(val: number): string {
  if (!Number.isFinite(val)) return "₱0.00";
  return `₱${val.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
