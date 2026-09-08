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

  // Pag-IBIG: ₱200 Personal / ₱200 LGU
  pagibigEmployee: number;
  pagibigGovernment: number;
  pagibigTotal: number;

  // Total Statutory
  totalEmployeeStatutory: number;
  totalGovernmentStatutory: number;
  grandTotalStatutory: number;
}

export interface LguPayrollLine {
  userId: number;
  employeeName: string;
  departmentId: number | null;
  departmentName: string;
  position: string;
  salaryGrade?: string;
  
  // Rate and Attendance
  monthlySalary: number;
  dailyRate: number;
  daysWorked: number;
  lateMinutes: number;
  undertimeMinutes: number;

  // Earnings
  basicPay: number;
  peraAllowance: number; // Personnel Economic Relief Allowance (₱1,000 / cutoff)
  otherAllowances: number;
  overtimePay: number;
  totalGrossPay: number;

  // Personal Deductions (Bawas sa Sahod)
  lateDeduction: number;
  undertimeDeduction: number;
  statutory: LguEmployeeStatutory;
  gsisLoan: number;
  pagibigLoan: number;
  taxWithholding: number;
  otherDeductions: number;
  totalPersonalDeductions: number;

  // Net Pay (Take-Home)
  netPay: number;

  // Government / LGU Counterpart (Sagot ng LGU)
  lguGsisShare: number;
  lguPhilhealthShare: number;
  lguPagibigShare: number;
  totalLguCounterpart: number;

  // Total LGU Appropriation (Gross Pay + LGU Counterpart)
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

  // Earnings
  totalBasicPay: number;
  totalPeraAllowance: number;
  totalGrossPay: number;

  // Deductions
  totalGsisEmployee: number;
  totalPhilhealthEmployee: number;
  totalPagibigEmployee: number;
  totalLoans: number;
  totalTaxes: number;
  totalPersonalDeductions: number;

  // Net Pay
  totalNetPay: number;

  // Government / LGU Counterparts
  totalGsisGovernment: number;
  totalPhilhealthGovernment: number;
  totalPagibigGovernment: number;
  totalLguCounterpart: number;

  // Grand Total Public Fund Required
  grandTotalAppropriation: number;

  // Departmental breakdown
  departmentSummaries: LguDepartmentSummary[];
}
