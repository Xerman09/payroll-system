// modules/lgu-payroll-run/utils/lguCompute.ts

import {
  LguPayrollLine,
  LguPayrollSummary,
  LguDepartmentSummary,
  LguEmployeeStatutory,
} from "../types";

export const PERA_PER_CUTOFF = 1000; // Standard Personnel Economic Relief Allowance (₱2,000/month = ₱1,000/cutoff)
export const GSIS_EMPLOYEE_RATE = 0.09; // 9%
export const GSIS_GOVERNMENT_RATE = 0.12; // 12%
export const PHILHEALTH_RATE = 0.025; // 2.5% each (5% total)
export const PHILHEALTH_MIN_BASE = 10000;
export const PHILHEALTH_MAX_BASE = 100000;
export const PAGIBIG_STANDARD_SHARE = 200; // ₱200 each per DBM

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function computeLguStatutory(
  monthlySalary: number,
  cutoffType: "FIRST" | "SECOND" = "FIRST"
): LguEmployeeStatutory {
  const salary = Math.max(0, monthlySalary || 0);

  // In government payroll, statutory contributions are computed monthly.
  // When deducted per cutoff (or split 50/50):
  // GSIS: 9% personal / 12% government
  const monthlyGsisEmployee = round2(salary * GSIS_EMPLOYEE_RATE);
  const monthlyGsisGovernment = round2(salary * GSIS_GOVERNMENT_RATE);

  // PhilHealth: 2.5% personal / 2.5% government (5% total, ₱10k - ₱100k cap)
  const phBase = Math.min(Math.max(salary, PHILHEALTH_MIN_BASE), PHILHEALTH_MAX_BASE);
  const monthlyPhEmployee = round2(phBase * PHILHEALTH_RATE);
  const monthlyPhGovernment = round2(phBase * PHILHEALTH_RATE);

  // Pag-IBIG: ₱200 personal / ₱200 government
  let monthlyPagibigEmployee = PAGIBIG_STANDARD_SHARE;
  let monthlyPagibigGovernment = PAGIBIG_STANDARD_SHARE;
  if (salary > 0 && salary < 1500) {
    monthlyPagibigEmployee = round2(salary * 0.01);
    monthlyPagibigGovernment = round2(salary * 0.02);
  }

  // Deduct 50% per cutoff
  const gsisEmployee = round2(monthlyGsisEmployee / 2);
  const gsisGovernment = round2(monthlyGsisGovernment / 2);
  const gsisTotal = round2(gsisEmployee + gsisGovernment);

  const philhealthEmployee = round2(monthlyPhEmployee / 2);
  const philhealthGovernment = round2(monthlyPhGovernment / 2);
  const philhealthTotal = round2(philhealthEmployee + philhealthGovernment);

  const pagibigEmployee = round2(monthlyPagibigEmployee / 2);
  const pagibigGovernment = round2(monthlyPagibigGovernment / 2);
  const pagibigTotal = round2(pagibigEmployee + pagibigGovernment);

  const totalEmployeeStatutory = round2(gsisEmployee + philhealthEmployee + pagibigEmployee);
  const totalGovernmentStatutory = round2(gsisGovernment + philhealthGovernment + pagibigGovernment);
  const grandTotalStatutory = round2(totalEmployeeStatutory + totalGovernmentStatutory);

  return {
    gsisEmployee,
    gsisGovernment,
    gsisTotal,
    philhealthEmployee,
    philhealthGovernment,
    philhealthTotal,
    pagibigEmployee,
    pagibigGovernment,
    pagibigTotal,
    totalEmployeeStatutory,
    totalGovernmentStatutory,
    grandTotalStatutory,
  };
}

export function computeLguLine(raw: {
  userId: number;
  employeeName: string;
  departmentId: number | null;
  departmentName: string;
  position: string;
  monthlySalary: number;
  daysWorked?: number;
  lateMinutes?: number;
  undertimeMinutes?: number;
  overtimePay?: number;
  otherAllowances?: number;
  gsisLoan?: number;
  pagibigLoan?: number;
  taxWithholding?: number;
  otherDeductions?: number;
  isOnHold?: boolean;
  cutoffType?: "FIRST" | "SECOND";
}): LguPayrollLine {
  const monthlySalary = Math.max(0, raw.monthlySalary || 0);
  const cutoffType = raw.cutoffType || "FIRST";

  // Public sector standard: 22 working days per month, 11 per cutoff
  const standardCutoffDays = 11;
  const daysWorked = raw.daysWorked != null ? raw.daysWorked : standardCutoffDays;
  const dailyRate = round2(monthlySalary / 22);
  const hourlyRate = round2(dailyRate / 8);
  const minuteRate = hourlyRate / 60;

  // Basic Pay for cutoff (prorated by days worked if less than standard)
  const basicPay = round2(daysWorked >= standardCutoffDays ? monthlySalary / 2 : daysWorked * dailyRate);

  // Allowances: PERA is ₱1,000 per cutoff for active employees
  const peraAllowance = daysWorked > 0 ? PERA_PER_CUTOFF : 0;
  const otherAllowances = round2(raw.otherAllowances || 0);
  const overtimePay = round2(raw.overtimePay || 0);

  const totalGrossPay = round2(basicPay + peraAllowance + otherAllowances + overtimePay);

  // CSC Tardiness & Undertime deductions
  const lateMinutes = Math.max(0, raw.lateMinutes || 0);
  const undertimeMinutes = Math.max(0, raw.undertimeMinutes || 0);
  const lateDeduction = round2(lateMinutes * minuteRate);
  const undertimeDeduction = round2(undertimeMinutes * minuteRate);

  // Statutory cost-sharing
  const statutory = computeLguStatutory(monthlySalary, cutoffType);

  // Government Loans & Taxes
  const gsisLoan = round2(raw.gsisLoan || 0);
  const pagibigLoan = round2(raw.pagibigLoan || 0);
  const taxWithholding = round2(raw.taxWithholding || 0);
  const otherDeductions = round2(raw.otherDeductions || 0);

  const totalPersonalDeductions = round2(
    lateDeduction +
    undertimeDeduction +
    statutory.totalEmployeeStatutory +
    gsisLoan +
    pagibigLoan +
    taxWithholding +
    otherDeductions
  );

  const netPay = round2(Math.max(0, totalGrossPay - totalPersonalDeductions));

  // Government / LGU Counterpart (Sagot ng LGU)
  const lguGsisShare = statutory.gsisGovernment;
  const lguPhilhealthShare = statutory.philhealthGovernment;
  const lguPagibigShare = statutory.pagibigGovernment;
  const totalLguCounterpart = statutory.totalGovernmentStatutory;

  // Total LGU Appropriation (Gross Pay + LGU Counterpart)
  const totalLguAppropriation = round2(totalGrossPay + totalLguCounterpart);

  return {
    userId: raw.userId,
    employeeName: raw.employeeName,
    departmentId: raw.departmentId,
    departmentName: raw.departmentName,
    position: raw.position,
    monthlySalary,
    dailyRate,
    daysWorked,
    lateMinutes,
    undertimeMinutes,
    basicPay,
    peraAllowance,
    otherAllowances,
    overtimePay,
    totalGrossPay,
    lateDeduction,
    undertimeDeduction,
    statutory,
    gsisLoan,
    pagibigLoan,
    taxWithholding,
    otherDeductions,
    totalPersonalDeductions,
    netPay,
    lguGsisShare,
    lguPhilhealthShare,
    lguPagibigShare,
    totalLguCounterpart,
    totalLguAppropriation,
    isOnHold: Boolean(raw.isOnHold),
  };
}

export function computeLguSummary(lines: LguPayrollLine[]): LguPayrollSummary {
  let totalBasicPay = 0;
  let totalPeraAllowance = 0;
  let totalGrossPay = 0;

  let totalGsisEmployee = 0;
  let totalPhilhealthEmployee = 0;
  let totalPagibigEmployee = 0;
  let totalLoans = 0;
  let totalTaxes = 0;
  let totalPersonalDeductions = 0;

  let totalNetPay = 0;

  let totalGsisGovernment = 0;
  let totalPhilhealthGovernment = 0;
  let totalPagibigGovernment = 0;
  let totalLguCounterpart = 0;

  let grandTotalAppropriation = 0;

  let activeCount = 0;
  let onHoldCount = 0;

  const deptMap = new Map<string, LguDepartmentSummary>();

  for (const line of lines) {
    if (line.isOnHold) {
      onHoldCount++;
      continue;
    }

    activeCount++;

    totalBasicPay += line.basicPay;
    totalPeraAllowance += line.peraAllowance;
    totalGrossPay += line.totalGrossPay;

    totalGsisEmployee += line.statutory.gsisEmployee;
    totalPhilhealthEmployee += line.statutory.philhealthEmployee;
    totalPagibigEmployee += line.statutory.pagibigEmployee;
    totalLoans += line.gsisLoan + line.pagibigLoan;
    totalTaxes += line.taxWithholding;
    totalPersonalDeductions += line.totalPersonalDeductions;

    totalNetPay += line.netPay;

    totalGsisGovernment += line.lguGsisShare;
    totalPhilhealthGovernment += line.lguPhilhealthShare;
    totalPagibigGovernment += line.lguPagibigShare;
    totalLguCounterpart += line.totalLguCounterpart;

    grandTotalAppropriation += line.totalLguAppropriation;

    // Department grouping
    const deptKey = line.departmentName || "General Administrative Services";
    let d = deptMap.get(deptKey);
    if (!d) {
      d = {
        departmentId: line.departmentId,
        departmentName: deptKey,
        headcount: 0,
        totalBasicPay: 0,
        totalPera: 0,
        totalGrossPay: 0,
        totalPersonalDeductions: 0,
        totalNetPay: 0,
        totalLguCounterpart: 0,
        totalAppropriation: 0,
      };
      deptMap.set(deptKey, d);
    }

    d.headcount += 1;
    d.totalBasicPay += line.basicPay;
    d.totalPera += line.peraAllowance;
    d.totalGrossPay += line.totalGrossPay;
    d.totalPersonalDeductions += line.totalPersonalDeductions;
    d.totalNetPay += line.netPay;
    d.totalLguCounterpart += line.totalLguCounterpart;
    d.totalAppropriation += line.totalLguAppropriation;
  }

  return {
    totalHeadcount: lines.length,
    activeHeadcount: activeCount,
    onHoldHeadcount: onHoldCount,

    totalBasicPay: round2(totalBasicPay),
    totalPeraAllowance: round2(totalPeraAllowance),
    totalGrossPay: round2(totalGrossPay),

    totalGsisEmployee: round2(totalGsisEmployee),
    totalPhilhealthEmployee: round2(totalPhilhealthEmployee),
    totalPagibigEmployee: round2(totalPagibigEmployee),
    totalLoans: round2(totalLoans),
    totalTaxes: round2(totalTaxes),
    totalPersonalDeductions: round2(totalPersonalDeductions),

    totalNetPay: round2(totalNetPay),

    totalGsisGovernment: round2(totalGsisGovernment),
    totalPhilhealthGovernment: round2(totalPhilhealthGovernment),
    totalPagibigGovernment: round2(totalPagibigGovernment),
    totalLguCounterpart: round2(totalLguCounterpart),

    grandTotalAppropriation: round2(grandTotalAppropriation),

    departmentSummaries: Array.from(deptMap.values()).map((d) => ({
      ...d,
      totalBasicPay: round2(d.totalBasicPay),
      totalPera: round2(d.totalPera),
      totalGrossPay: round2(d.totalGrossPay),
      totalPersonalDeductions: round2(d.totalPersonalDeductions),
      totalNetPay: round2(d.totalNetPay),
      totalLguCounterpart: round2(d.totalLguCounterpart),
      totalAppropriation: round2(d.totalAppropriation),
    })),
  };
}

export function formatPhp(val: number): string {
  if (!Number.isFinite(val)) return "₱0.00";
  return `₱${val.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
