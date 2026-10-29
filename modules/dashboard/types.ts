// @modules/dashboard/types.ts

export interface DepartmentProgressItem {
  id: number;
  name: string;
  isCompleted: boolean;
  status?: string;
}

export interface CutoffProgressData {
  cutoffId: number | null;
  cutoffTitle: string;
  cutoffType: string | null;
  startDate: string | null;
  endDate: string | null;
  payoutDate: string | null;
  paidDayPlusOne: string | null;
  isWindowActive: boolean;
  totalDepartments: number;
  completedDepartments: number;
  percentage: number;
  departments: DepartmentProgressItem[];
}

export interface DashboardStats {
  employees: number;
  payrollThisMonth: number;
  payrollPercentageChange: number | null;
  upcomingLeaves: number;
  pendingApprovals: number;
  cutoffCompletionPercentage: number;
  completedDepartments: number;
  totalDepartments: number;
  currentCutoffTitle: string;
}

export interface ChartData {
  month: string;
  amount: number;
  payroll: number;
  [key: string]: string | number;
}

export interface DistributionData {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface DashboardData {
  stats: DashboardStats;
  payrollTrend: ChartData[];
  employeeDistribution: DistributionData[];
  cutoffProgress: CutoffProgressData;
}
