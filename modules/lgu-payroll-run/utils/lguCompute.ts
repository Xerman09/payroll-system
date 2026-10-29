// modules/lgu-payroll-run/utils/lguCompute.ts

import {
  LguPayrollLine,
  LguPayrollSummary,
  LguDepartmentSummary,
  LguEmployeeStatutory,
  LguLoanBreakdown,
  LguAllowanceBreakdown,
  LguManualAdjustment,
} from "../types";

export const PERA_PER_CUTOFF = 1000; // Standard Personnel Economic Relief Allowance (₱2,000/month = ₱1,000/cutoff)
export const GSIS_EMPLOYEE_RATE = 0.09; // 9%
export const GSIS_GOVERNMENT_RATE = 0.12; // 12%
export const PHILHEALTH_RATE = 0.025; // 2.5% each (5% total)
export const PHILHEALTH_MIN_BASE = 10000;
export const PHILHEALTH_MAX_BASE = 100000;
export const PAGIBIG_STANDARD_SHARE = 200; // ₱200 each per DBM

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function formatPhp(amount: number): string {
  const v = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

// Salary Grade standard benchmark mapping (SSL V)
export const SALARY_GRADE_TABLE: Record<number, { grade: string; monthly: number; description: string }> = {
  1: { grade: "SG-1 Step 1", monthly: 14500, description: "Administrative Aide I" },
  3: { grade: "SG-3 Step 1", monthly: 15800, description: "Administrative Aide III / Utility" },
  4: { grade: "SG-4 Step 1", monthly: 16700, description: "Administrative Aide IV / Driver" },
  6: { grade: "SG-6 Step 1", monthly: 18500, description: "Administrative Aide VI" },
  8: { grade: "SG-8 Step 1", monthly: 20500, description: "Administrative Assistant II" },
  10: { grade: "SG-10 Step 1", monthly: 23176, description: "Administrative Assistant IV" },
  11: { grade: "SG-11 Step 1", monthly: 27000, description: "Administrative Officer I" },
  14: { grade: "SG-14 Step 1", monthly: 33843, description: "Administrative Officer II" },
  15: { grade: "SG-15 Step 1", monthly: 36619, description: "Nurse II / Social Welfare Officer II" },
  16: { grade: "SG-16 Step 1", monthly: 39672, description: "Accountant I / Engineer I" },
  18: { grade: "SG-18 Step 1", monthly: 46725, description: "Administrative Officer V / Division Chief" },
  22: { grade: "SG-22 Step 1", monthly: 71511, description: "Assistant Department Head" },
  24: { grade: "SG-24 Step 1", monthly: 90078, description: "City / Municipal Department Head I" },
  26: { grade: "SG-26 Step 1", monthly: 116040, description: "City / Municipal Administrator" },
};

/**
 * Infer a public sector salary grade from position title or existing salary
 */
export function inferSalaryGrade(position: string, salary: number): string {
  const p = (position || "").toLowerCase();
  if (p.includes("mayor") || p.includes("administrator")) return "SG-26 Step 1";
  if (p.includes("head") || p.includes("director") || p.includes("treasurer") || p.includes("assessor")) return "SG-24 Step 1";
  if (p.includes("assistant head") || p.includes("attorney")) return "SG-22 Step 1";
  if (p.includes("chief") || p.includes("supervisor")) return "SG-18 Step 1";
  if (p.includes("accountant") || p.includes("engineer") || p.includes("medical")) return "SG-16 Step 1";
  if (p.includes("nurse") || p.includes("social welfare")) return "SG-15 Step 1";
  if (p.includes("officer") || p.includes("specialist")) return "SG-11 Step 1";
  if (p.includes("assistant") || p.includes("clerk")) return "SG-8 Step 1";
  if (p.includes("aide") || p.includes("driver") || p.includes("utility")) return "SG-4 Step 1";

  // Check by salary bracket
  if (salary >= 80000) return "SG-24 Step 1";
  if (salary >= 60000) return "SG-22 Step 1";
  if (salary >= 45000) return "SG-18 Step 1";
  if (salary >= 35000) return "SG-15 Step 1";
  if (salary >= 25000) return "SG-11 Step 1";
  if (salary >= 18000) return "SG-8 Step 1";
  return "SG-4 Step 1";
}

/**
 * Compute statutory contributions with government cost-sharing
 */
export function computeLguStatutory(
  monthlySalary: number,
  _cutoffType: "FIRST" | "SECOND" = "FIRST",
  daysWorked: number = 11
): LguEmployeeStatutory {
  const salary = Math.max(0, monthlySalary || 0);

  // If employee has 0 days worked or 0 salary, statutory contributions and government counterparts are 0
  if (salary <= 0 || daysWorked <= 0) {
    return {
      gsisEmployee: 0,
      gsisGovernment: 0,
      gsisTotal: 0,
      philhealthEmployee: 0,
      philhealthGovernment: 0,
      philhealthTotal: 0,
      pagibigEmployee: 0,
      pagibigGovernment: 0,
      pagibigTotal: 0,
      totalEmployeeStatutory: 0,
      totalGovernmentStatutory: 0,
      grandTotalStatutory: 0,
    };
  }

  // GSIS: 9% personal / 12% government (total 21%)
  const monthlyGsisEmployee = round2(salary * GSIS_EMPLOYEE_RATE);
  const monthlyGsisGovernment = round2(salary * GSIS_GOVERNMENT_RATE);

  // PhilHealth: 2.5% personal / 2.5% government (5% total, ₱10k - ₱100k cap)
  const phBase = Math.min(Math.max(salary, PHILHEALTH_MIN_BASE), PHILHEALTH_MAX_BASE);
  const monthlyPhEmployee = round2(phBase * PHILHEALTH_RATE);
  const monthlyPhGovernment = round2(phBase * PHILHEALTH_RATE);

  // Pag-IBIG: ₱200 personal / ₱200 government per DBM circular
  let monthlyPagibigEmployee = PAGIBIG_STANDARD_SHARE;
  let monthlyPagibigGovernment = PAGIBIG_STANDARD_SHARE;
  if (salary > 0 && salary < 1500) {
    monthlyPagibigEmployee = round2(salary * 0.01);
    monthlyPagibigGovernment = round2(salary * 0.02);
  }

  // Deduct 50% per cutoff for bi-monthly payroll
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

/**
 * Compute semi-monthly withholding tax based on TRAIN Law revised withholding tax table
 */
export function computeSemiMonthlyTax(taxableIncome: number): number {
  const ti = Math.max(0, taxableIncome || 0);

  // Semi-Monthly Tax Table:
  // 1. Up to ₱10,417: 0.00
  // 2. ₱10,417 - ₱16,667: 15% of excess over ₱10,417
  // 3. ₱16,667 - ₱33,333: ₱937.50 + 20% of excess over ₱16,667
  // 4. ₱33,333 - ₱83,333: ₱4,270.83 + 25% of excess over ₱33,333
  // 5. ₱83,333 - ₱333,333: ₱16,770.83 + 30% of excess over ₱83,333
  // 6. Above ₱333,333: ₱91,770.83 + 35% of excess over ₱333,333

  if (ti <= 10417) return 0;
  if (ti <= 16667) return round2((ti - 10417) * 0.15);
  if (ti <= 33333) return round2(937.5 + (ti - 16667) * 0.2);
  if (ti <= 83333) return round2(4270.83 + (ti - 33333) * 0.25);
  if (ti <= 333333) return round2(16770.83 + (ti - 83333) * 0.3);
  return round2(91770.83 + (ti - 333333) * 0.35);
}

export interface ComputeLguLineParams {
  userId: number;
  employeeNo?: string;
  employeeName: string;
  departmentId: number | null;
  departmentName: string;
  position: string;
  salaryGrade?: string;
  employmentStatus?: string;
  monthlySalary: number;

  // Attendance & Timekeeping
  daysWorked?: number;
  standardCutoffDays?: number;
  absentDays?: number;
  lateMinutes?: number;
  lateDeduction?: number;
  undertimeMinutes?: number;
  undertimeDeduction?: number;

  // Earnings & Allowances
  basicPay?: number;
  peraAllowance?: number;
  overtimeHours?: number;
  overtimePay?: number;
  nightDiffPay?: number;
  rataAllowance?: number;
  hazardPay?: number;
  otherAllowances?: number;
  allowancesBreakdown?: LguAllowanceBreakdown[];

  // Statutory
  statutory?: LguEmployeeStatutory;

  // Loans
  gsisLoan?: number;
  pagibigLoan?: number;
  gsisLoansBreakdown?: LguLoanBreakdown[];
  pagibigLoansBreakdown?: LguLoanBreakdown[];

  // Institutional Deductions
  coopDeduction?: number;
  unionDues?: number;
  disallowanceDeduction?: number;
  otherDeductions?: number;

  // Custom adjustments
  manualAdditions?: LguManualAdjustment[];
  manualDeductions?: LguManualAdjustment[];

  taxWithholding?: number;
  previousNetPay?: number;
  isOnHold?: boolean;
  remarks?: string;
  cutoffType?: "FIRST" | "SECOND";
}

export function computeLguLine(raw: ComputeLguLineParams): LguPayrollLine {
  const monthlySalary = Math.max(0, raw.monthlySalary || 0);
  const cutoffType = raw.cutoffType || "FIRST";

  // Civil Service Commission standard: 22 working days per month = 11 days per cutoff
  const standardCutoffDays = raw.standardCutoffDays || 11;
  const daysWorked = raw.daysWorked != null ? Math.min(raw.daysWorked, standardCutoffDays) : standardCutoffDays;
  const absentDays = raw.absentDays != null ? raw.absentDays : Math.max(0, standardCutoffDays - daysWorked);

  const dailyRate = round2(monthlySalary / 22);
  const hourlyRate = round2(dailyRate / 8);
  const minuteRate = round2(hourlyRate / 60);

  // Cutoff Basic Pay (if passed from payroll run calculation engine, use exact; otherwise calculate prorated)
  const absentDeduction = round2(absentDays * dailyRate);
  const basicPay = raw.basicPay != null
    ? round2(raw.basicPay)
    : round2(daysWorked >= standardCutoffDays ? monthlySalary / 2 : Math.max(0, (monthlySalary / 2) - absentDeduction));

  // Civil Service Commission Tardiness & Undertime Deductions
  const lateMinutes = Math.max(0, raw.lateMinutes || 0);
  const undertimeMinutes = Math.max(0, raw.undertimeMinutes || 0);
  const lateDeduction = raw.lateDeduction != null ? round2(raw.lateDeduction) : round2(lateMinutes * minuteRate);
  const undertimeDeduction = raw.undertimeDeduction != null ? round2(raw.undertimeDeduction) : round2(undertimeMinutes * minuteRate);

  // Mandated Public Sector Allowances (Strictly legitimate from database records or passed params)
  const peraAllowance = raw.peraAllowance != null
    ? round2(raw.peraAllowance)
    : (raw.allowancesBreakdown?.find(a => a.name.toLowerCase().includes("pera"))?.amount ?? (daysWorked > 0 ? PERA_PER_CUTOFF : 0));

  const rataAllowance = round2(raw.rataAllowance || 0);
  const hazardPay = round2(raw.hazardPay || 0);

  // Overtime & Night Shift Differential
  const overtimeHours = Math.max(0, raw.overtimeHours || 0);
  const overtimePay = raw.overtimePay != null ? round2(raw.overtimePay) : round2(overtimeHours * hourlyRate * 1.25);
  const nightDiffPay = round2(raw.nightDiffPay || 0);

  // Other Allowances
  const otherAllowances = round2(raw.otherAllowances || 0);
  const allowancesBreakdown: LguAllowanceBreakdown[] = raw.allowancesBreakdown && raw.allowancesBreakdown.length > 0
    ? raw.allowancesBreakdown
    : [
        ...(peraAllowance > 0 ? [{ name: "PERA (Personnel Economic Relief Allowance)", amount: peraAllowance, isTaxable: false }] : []),
        ...(rataAllowance > 0 ? [{ name: "RATA (Representation & Transport)", amount: rataAllowance, isTaxable: false }] : []),
        ...(hazardPay > 0 ? [{ name: "Hazard Pay (Magna Carta)", amount: hazardPay, isTaxable: false }] : []),
        ...(otherAllowances > 0 ? [{ name: "Other Allowance", amount: otherAllowances, isTaxable: true }] : []),
      ];

  // Manual Custom Additions
  const manualAdditions = Array.isArray(raw.manualAdditions) ? raw.manualAdditions : [];
  const manualAdditionsTotal = round2(manualAdditions.reduce((sum, a) => sum + (Number(a.amount) || 0), 0));

  // Total Gross Pay
  const totalGrossPay = round2(
    basicPay +
    peraAllowance +
    rataAllowance +
    hazardPay +
    overtimePay +
    nightDiffPay +
    otherAllowances +
    manualAdditionsTotal
  );

  // Statutory Cost Sharing (GSIS, PhilHealth, Pag-IBIG) - use exact passed or compute
  const statutory = raw.statutory || computeLguStatutory(monthlySalary, cutoffType, daysWorked);

  // Taxable Income Calculation (Gross minus tax-exempt PERA and mandatory GSIS/PhilHealth/PagIBIG employee shares)
  const taxableIncome = Math.max(0, round2(totalGrossPay - peraAllowance - statutory.totalEmployeeStatutory));
  const taxWithholding = raw.taxWithholding != null && raw.taxWithholding >= 0
    ? round2(raw.taxWithholding)
    : computeSemiMonthlyTax(taxableIncome);

  // Itemized Government Loans (Strictly legitimate from records)
  const gsisLoansBreakdown: LguLoanBreakdown[] = Array.isArray(raw.gsisLoansBreakdown) ? raw.gsisLoansBreakdown : [];
  const pagibigLoansBreakdown: LguLoanBreakdown[] = Array.isArray(raw.pagibigLoansBreakdown) ? raw.pagibigLoansBreakdown : [];

  const gsisLoan = round2(gsisLoansBreakdown.reduce((sum, l) => sum + (Number(l.amount) || 0), 0));
  const pagibigLoan = round2(pagibigLoansBreakdown.reduce((sum, l) => sum + (Number(l.amount) || 0), 0));

  // Institutional Deductions
  const coopDeduction = round2(raw.coopDeduction || 0);
  const unionDues = round2(raw.unionDues || 0);
  const disallowanceDeduction = round2(raw.disallowanceDeduction || 0);
  const otherDeductions = round2(raw.otherDeductions || 0);

  // Manual Custom Deductions
  const manualDeductions = Array.isArray(raw.manualDeductions) ? raw.manualDeductions : [];
  const manualDeductionsTotal = round2(manualDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0));

  // Total Scheduled Personal Deductions
  const totalScheduledDeductions = round2(
    lateDeduction +
    undertimeDeduction +
    statutory.totalEmployeeStatutory +
    taxWithholding +
    gsisLoan +
    pagibigLoan +
    coopDeduction +
    unionDues +
    disallowanceDeduction +
    otherDeductions +
    manualDeductionsTotal
  );

  // In Philippine & Civil Service payroll accounting:
  // 1. Negative take-home pay is strictly prohibited.
  // 2. If Gross Pay is 0.00, no deductions can be made from a zero paycheck (all deductions deferred).
  // 3. Deductions applied are capped at available gross earnings.
  const totalPersonalDeductions = round2(
    totalGrossPay <= 0
      ? 0
      : Math.min(totalGrossPay, totalScheduledDeductions)
  );

  const uncollectedDeductions = round2(Math.max(0, totalScheduledDeductions - totalPersonalDeductions));

  // Net Take-Home Pay (Gross Pay minus Applied Deductions: guaranteed >= 0)
  const netPay = round2(totalGrossPay - totalPersonalDeductions);

  // Variance % Calculation
  const previousNetPay = raw.previousNetPay != null ? raw.previousNetPay : (basicPay + peraAllowance - statutory.totalEmployeeStatutory);
  let variancePct: number | null = null;
  let varianceFlag = false;

  if (previousNetPay > 0) {
    variancePct = round2(((netPay - previousNetPay) / previousNetPay) * 100);
    // Flag if variance > 10% or < -10%
    if (Math.abs(variancePct) >= 10) {
      varianceFlag = true;
    }
  }

  // LGU Counterpart (Sagot ng Pamahalaang Lokal)
  // Government cost-sharing matches active employee contributions.
  // If the employee has 0 gross pay, 0 days worked, or 0 employee share, LGU counterpart is 0.00.
  const hasEarnings = totalGrossPay > 0 && daysWorked > 0;

  const lguGsisShare = hasEarnings && statutory.gsisEmployee > 0 ? statutory.gsisGovernment : 0;
  const lguPhilhealthShare = hasEarnings && statutory.philhealthEmployee > 0 ? statutory.philhealthGovernment : 0;
  const lguPagibigShare = hasEarnings && statutory.pagibigEmployee > 0 ? statutory.pagibigGovernment : 0;
  const totalLguCounterpart = round2(lguGsisShare + lguPhilhealthShare + lguPagibigShare);

  // Synchronize statutory government shares with actual active counterpart:
  // If employee has 0 personal share or no earnings, government counterpart is 0.
  const syncStatutory: LguEmployeeStatutory = {
    ...statutory,
    gsisGovernment: lguGsisShare,
    gsisTotal: round2(statutory.gsisEmployee + lguGsisShare),
    philhealthGovernment: lguPhilhealthShare,
    philhealthTotal: round2(statutory.philhealthEmployee + lguPhilhealthShare),
    pagibigGovernment: lguPagibigShare,
    pagibigTotal: round2(statutory.pagibigEmployee + lguPagibigShare),
    totalGovernmentStatutory: totalLguCounterpart,
    grandTotalStatutory: round2(statutory.totalEmployeeStatutory + totalLguCounterpart),
  };

  // Total Public Fund Appropriation Required (Gross Pay + LGU Counterpart)
  const totalLguAppropriation = round2(totalGrossPay + totalLguCounterpart);

  // Inferred Salary Grade
  const salaryGrade = raw.salaryGrade || inferSalaryGrade(raw.position, monthlySalary);

  return {
    userId: raw.userId,
    employeeNo: raw.employeeNo || `LGU-${String(raw.userId).padStart(5, "0")}`,
    employeeName: raw.employeeName,
    departmentId: raw.departmentId,
    departmentName: raw.departmentName,
    position: raw.position,
    salaryGrade,
    employmentStatus: raw.employmentStatus || (monthlySalary >= 40000 ? "PERMANENT" : "CASUAL"),

    monthlySalary,
    dailyRate,
    hourlyRate,
    minuteRate,
    standardCutoffDays,
    daysWorked,
    absentDays,
    absentDeduction,
    lateMinutes,
    lateDeduction,
    undertimeMinutes,
    undertimeDeduction,

    basicPay,
    peraAllowance,
    rataAllowance,
    hazardPay,
    overtimeHours,
    overtimePay,
    nightDiffPay,
    otherAllowances,
    allowancesBreakdown,
    totalGrossPay,

    statutory: syncStatutory,
    taxWithholding,
    taxableIncome,

    gsisLoan,
    pagibigLoan,
    gsisLoansBreakdown,
    pagibigLoansBreakdown,

    coopDeduction,
    unionDues,
    disallowanceDeduction,
    otherDeductions,

    manualAdditions,
    manualDeductions,

    totalPersonalDeductions,
    totalScheduledDeductions,
    uncollectedDeductions,
    netPay,
    previousNetPay,
    variancePct,
    varianceFlag,

    lguGsisShare,
    lguPhilhealthShare,
    lguPagibigShare,
    totalLguCounterpart,
    totalLguAppropriation,

    isOnHold: Boolean(raw.isOnHold),
    remarks: raw.remarks,
  };
}

/**
 * Aggregates summary across all LGU payroll lines
 */
export function computeLguSummary(lines: LguPayrollLine[]): LguPayrollSummary {
  const activeLines = lines.filter((l) => !l.isOnHold);

  const totalHeadcount = lines.length;
  const activeHeadcount = activeLines.length;
  const onHoldHeadcount = totalHeadcount - activeHeadcount;

  let totalBasicPay = 0;
  let totalPeraAllowance = 0;
  let totalRataAllowance = 0;
  let totalHazardPay = 0;
  let totalOvertimePay = 0;
  let totalOtherAllowances = 0;
  let totalGrossPay = 0;

  let totalTardinessDeductions = 0;
  let totalGsisEmployee = 0;
  let totalPhilhealthEmployee = 0;
  let totalPagibigEmployee = 0;
  let totalLoans = 0;
  let totalGsisLoan = 0;
  let totalPagibigLoan = 0;
  let totalTaxes = 0;
  let totalOtherDeductions = 0;
  let totalPersonalDeductions = 0;

  let totalNetPay = 0;

  let totalGsisGovernment = 0;
  let totalPhilhealthGovernment = 0;
  let totalPagibigGovernment = 0;
  let totalLguCounterpart = 0;
  let grandTotalAppropriation = 0;

  let varianceAlerts = 0;

  // Department aggregation map
  const deptMap = new Map<string, {
    departmentId: number | null;
    departmentName: string;
    headcount: number;
    totalBasicPay: number;
    totalPera: number;
    totalRata: number;
    totalOvertime: number;
    totalGrossPay: number;
    totalPersonalDeductions: number;
    totalNetPay: number;
    totalLguCounterpart: number;
    totalAppropriation: number;
  }>();

  for (const line of lines) {
    if (line.varianceFlag) {
      varianceAlerts += 1;
    }

    const dKey = line.departmentName || "General Administration";
    if (!deptMap.has(dKey)) {
      deptMap.set(dKey, {
        departmentId: line.departmentId,
        departmentName: dKey,
        headcount: 0,
        totalBasicPay: 0,
        totalPera: 0,
        totalRata: 0,
        totalOvertime: 0,
        totalGrossPay: 0,
        totalPersonalDeductions: 0,
        totalNetPay: 0,
        totalLguCounterpart: 0,
        totalAppropriation: 0,
      });
    }

    const deptObj = deptMap.get(dKey)!;
    deptObj.headcount += 1;

    // Only add active employees to the monetary totals
    if (!line.isOnHold) {
      totalBasicPay += line.basicPay;
      totalPeraAllowance += line.peraAllowance;
      totalRataAllowance += line.rataAllowance;
      totalHazardPay += line.hazardPay;
      totalOvertimePay += (line.overtimePay + line.nightDiffPay);
      totalOtherAllowances += line.otherAllowances;
      totalGrossPay += line.totalGrossPay;

      totalTardinessDeductions += (line.lateDeduction + line.undertimeDeduction);
      totalGsisEmployee += line.statutory.gsisEmployee;
      totalPhilhealthEmployee += line.statutory.philhealthEmployee;
      totalPagibigEmployee += line.statutory.pagibigEmployee;
      totalGsisLoan += line.gsisLoan;
      totalPagibigLoan += line.pagibigLoan;
      totalLoans += (line.gsisLoan + line.pagibigLoan);
      totalTaxes += line.taxWithholding;
      totalOtherDeductions += (line.coopDeduction + line.unionDues + line.disallowanceDeduction + line.otherDeductions);
      totalPersonalDeductions += line.totalPersonalDeductions;

      totalNetPay += line.netPay;

      totalGsisGovernment += line.lguGsisShare;
      totalPhilhealthGovernment += line.lguPhilhealthShare;
      totalPagibigGovernment += line.lguPagibigShare;
      totalLguCounterpart += line.totalLguCounterpart;
      grandTotalAppropriation += line.totalLguAppropriation;

      deptObj.totalBasicPay += line.basicPay;
      deptObj.totalPera += line.peraAllowance;
      deptObj.totalRata += line.rataAllowance;
      deptObj.totalOvertime += (line.overtimePay + line.nightDiffPay);
      deptObj.totalGrossPay += line.totalGrossPay;
      deptObj.totalPersonalDeductions += line.totalPersonalDeductions;
      deptObj.totalNetPay += line.netPay;
      deptObj.totalLguCounterpart += line.totalLguCounterpart;
      deptObj.totalAppropriation += line.totalLguAppropriation;
    }
  }

  const departmentSummaries: LguDepartmentSummary[] = Array.from(deptMap.values()).map((d) => ({
    departmentId: d.departmentId,
    departmentName: d.departmentName,
    headcount: d.headcount,
    totalBasicPay: round2(d.totalBasicPay),
    totalPera: round2(d.totalPera),
    totalRata: round2(d.totalRata),
    totalOvertime: round2(d.totalOvertime),
    totalGrossPay: round2(d.totalGrossPay),
    totalPersonalDeductions: round2(d.totalPersonalDeductions),
    totalNetPay: round2(d.totalNetPay),
    totalLguCounterpart: round2(d.totalLguCounterpart),
    totalAppropriation: round2(d.totalAppropriation),
  }));

  return {
    totalHeadcount,
    activeHeadcount,
    onHoldHeadcount,

    totalBasicPay: round2(totalBasicPay),
    totalPeraAllowance: round2(totalPeraAllowance),
    totalRataAllowance: round2(totalRataAllowance),
    totalHazardPay: round2(totalHazardPay),
    totalOvertimePay: round2(totalOvertimePay),
    totalOtherAllowances: round2(totalOtherAllowances),
    totalGrossPay: round2(totalGrossPay),

    totalTardinessDeductions: round2(totalTardinessDeductions),
    totalGsisEmployee: round2(totalGsisEmployee),
    totalPhilhealthEmployee: round2(totalPhilhealthEmployee),
    totalPagibigEmployee: round2(totalPagibigEmployee),
    totalLoans: round2(totalLoans),
    totalGsisLoan: round2(totalGsisLoan),
    totalPagibigLoan: round2(totalPagibigLoan),
    totalTaxes: round2(totalTaxes),
    totalOtherDeductions: round2(totalOtherDeductions),
    totalPersonalDeductions: round2(totalPersonalDeductions),

    totalNetPay: round2(totalNetPay),

    totalGsisGovernment: round2(totalGsisGovernment),
    totalPhilhealthGovernment: round2(totalPhilhealthGovernment),
    totalPagibigGovernment: round2(totalPagibigGovernment),
    totalLguCounterpart: round2(totalLguCounterpart),

    grandTotalAppropriation: round2(grandTotalAppropriation),
    varianceAlerts,
    departmentSummaries,
  };
}
