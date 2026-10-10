// modules/lgu-payroll-run/types.ts

export type LguPayrollStep = 1 | 2 | 3 | 4;

export interface CutoffSetting {
  id: number;
  cutoff_type: "FIRST" | "SECOND";
  start_date: string;
  end_date: string;
  payout_date?: string | null;
  period_status?: string;
}

export interface Department {
  department_id: number;
  department_name: string;
}

export interface LguPayrollConfigState {
  cutoffId: number | null;
  departmentId: number | null; // null = ALL
  payrollRefNo: string;
  remarks: string;
}

export interface LguEmployeeStatutory {
  // GSIS: 9% Personal / 12% LGU (21% Total)
  gsisEmployee: number;
  gsisGovernment: number;
  gsisTotal: number;

  // PhilHealth: 2.5% Personal / 2.5% LGU (50/50, ₱10k-₱100k cap)
  philhealthEmployee: number;
  philhealthGovernment: number;
  philhealthTotal: number;

  // Pag-IBIG: ₱200 Personal / ₱200 LGU (or ₱100 per cutoff)
  pagibigEmployee: number;
  pagibigGovernment: number;
  pagibigTotal: number;

  // Total Statutory
  totalEmployeeStatutory: number;
  totalGovernmentStatutory: number;
  grandTotalStatutory: number;
}

export interface LguLoanBreakdown {
  loanType: string;
  amount: number;
  balance?: number;
  referenceNo?: string;
}

export interface LguAllowanceBreakdown {
  name: string;
  amount: number;
  isTaxable?: boolean;
}

export interface LguManualAdjustment {
  id: string | number;
  type: "EARNING" | "DEDUCTION";
  description: string;
  amount: number;
  category?: string;
  isCustom?: boolean;
}

export interface LguPayrollLine {
  userId: number;
  employeeNo?: string;
  employeeName: string;
  departmentId: number | null;
  departmentName: string;
  position: string;
  salaryGrade?: string; // e.g. "SG-11 Step 1"
  employmentStatus?: "PERMANENT" | "COTERMINOUS" | "CASUAL" | "ELECTIVE" | string;

  // Rate and Attendance (Civil Service Commission Standard)
  monthlySalary: number;
  dailyRate: number;
  hourlyRate: number;
  minuteRate: number;
  standardCutoffDays: number; // 11 days
  daysWorked: number;
  absentDays: number;
  absentDeduction: number;
  lateMinutes: number;
  lateDeduction: number;
  undertimeMinutes: number;
  undertimeDeduction: number;

  // Earnings
  basicPay: number;
  peraAllowance: number; // Personnel Economic Relief Allowance (₱1,000 / cutoff)
  rataAllowance: number; // Representation and Transportation Allowance (Dept Heads, Chiefs)
  hazardPay: number; // Magna Carta / Health hazard pay
  overtimeHours: number;
  overtimePay: number;
  nightDiffPay: number;
  otherAllowances: number;
  allowancesBreakdown: LguAllowanceBreakdown[];
  totalGrossPay: number;

  // Personal Deductions (Bawas sa Sahod)
  statutory: LguEmployeeStatutory;
  taxWithholding: number;
  taxableIncome: number;

  // Public Sector Loans
  gsisLoan: number;
  pagibigLoan: number;
  gsisLoansBreakdown: LguLoanBreakdown[];
  pagibigLoansBreakdown: LguLoanBreakdown[];

  // Institutional Deductions
  coopDeduction: number;
  unionDues: number;
  disallowanceDeduction: number;
  otherDeductions: number;

  // Custom adjustments added on the fly
  manualAdditions: LguManualAdjustment[];
  manualDeductions: LguManualAdjustment[];

  // Total Personal Deductions
  totalPersonalDeductions: number;

  // Net Pay (Take-Home Pay)
  netPay: number;
  previousNetPay?: number;
  variancePct?: number | null;
  varianceFlag?: boolean;

  // Government / LGU Counterpart (Sagot ng Pamahalaan)
  lguGsisShare: number;
  lguPhilhealthShare: number;
  lguPagibigShare: number;
  totalLguCounterpart: number;

  // Total LGU Appropriation (Public Fund Required = Gross Pay + LGU Counterpart)
  totalLguAppropriation: number;

  // Status
  isOnHold: boolean;
  remarks?: string;
}

export interface LguDepartmentSummary {
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
}

export interface LguPayrollSummary {
  totalHeadcount: number;
  activeHeadcount: number;
  onHoldHeadcount: number;

  // Earnings Breakdown
  totalBasicPay: number;
  totalPeraAllowance: number;
  totalRataAllowance: number;
  totalHazardPay: number;
  totalOvertimePay: number;
  totalOtherAllowances: number;
  totalGrossPay: number;

  // Deductions Breakdown
  totalTardinessDeductions: number;
  totalGsisEmployee: number;
  totalPhilhealthEmployee: number;
  totalPagibigEmployee: number;
  totalLoans: number;
  totalTaxes: number;
  totalOtherDeductions: number;
  totalPersonalDeductions: number;

  // Net Take-Home Pay
  totalNetPay: number;

  // Government / LGU Counterparts
  totalGsisGovernment: number;
  totalPhilhealthGovernment: number;
  totalPagibigGovernment: number;
  totalLguCounterpart: number;

  // Grand Total Public Fund Required
  grandTotalAppropriation: number;

  // Alerts
  varianceAlerts: number;

  // Departmental breakdown
  departmentSummaries: LguDepartmentSummary[];
}
