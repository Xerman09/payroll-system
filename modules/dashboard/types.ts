// @modules/dashboard/types.ts

export interface DashboardStats {
  employees: number;
  payrollThisMonth: number;
  payrollPercentageChange: number | null;
  upcomingLeaves: number;
  pendingApprovals: number;
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
}
