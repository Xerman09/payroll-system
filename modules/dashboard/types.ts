// @modules/dashboard/types.ts

export interface DashboardStats {
  employees: number;
  payrollThisMonth: number;
  upcomingLeaves: number;
  pendingApprovals: number;
}

export interface ChartData {
  month: string;
  amount: number;
  payroll: number;
}

export interface DistributionData {
  name: string;
  value: number;
}

export interface DashboardData {
  stats: DashboardStats;
  payrollTrend: ChartData[];
  employeeDistribution: DistributionData[];
}
