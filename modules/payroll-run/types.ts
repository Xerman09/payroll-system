export type PayrollStep = 1 | 2 | 3 | 4;

export type AdjustmentType = "EARNING" | "DEDUCTION";

export interface Adjustment {
  type: AdjustmentType;
  desc: string;
  amount: number; // positive numeric value
  recurring?: boolean;
}

export interface EmployeeRow {
  id: number;
  name: string;
  position: string;
  department: string;
  basic: number; // monthly basic salary
  previousNet: number; // previous cutoff's net pay
  onHold: boolean;
  adjustments: Adjustment[];
}

export interface SalaryHistoryEntry {
  user_id: number;
  old_basic: number;
  new_basic: number;
  effective_date: string; // YYYY-MM-DD
}

export interface PayrollCutoffOption {
  value: string; // "YYYY-MM-DD_YYYY-MM-DD"
  label: string;
}

export interface PayrollDepartmentOption {
  value: string; // "ALL" | "IT" | etc.
  label: string;
}

export interface PayrollConfigState {
  cutoffValue: string;
  departmentValue: string;
}

export interface ProratedPayResult {
  amount: number;
  isProrated: boolean;
  // Free-form details shown in UI only; do not parse.
  details?: {
    changeEffectiveDate: string;
    oldBasic: number;
    newBasic: number;
    daysOnOldRate: number;
    daysOnNewRate: number;
    oldDaily: number;
    newDaily: number;
    payOld: number;
    payNew: number;
    totalProrated: number;
  };
}

export interface PayrollComputeOptions {
  // For prototype parity: use fixed deductions baseline
  fixedDeductions: number;
}

export interface PayrollComputedRow {
  employeeId: number;
  employeeName: string;
  isProrated: boolean;
  proratedDetails?: ProratedPayResult["details"];
  gross: number;
  deductions: number;
  net: number;
  previousNet: number;
  variancePct: number | null;
  varianceAlert: boolean;
  status: "Ready";
}

export interface PayrollSummary {
  totalNet: number;
  activeHeadcount: number;
  varianceAlerts: number;
}
