// @modules/dashboard/providers/dashboardService.ts
import * as api from "./dashboardApi";
import type {
  DashboardData
} from "../types";

export const fetchDashboardData = async (): Promise<DashboardData> => {
  // A. Fetch data using the module's own API wrapper (direct Directus access via proxy)
  // fetchUsers now handles batching internally to ensure we get ALL active employees
  const [allUsersRaw, departmentsRaw, postedRunsRaw, pendingApprovalsRaw] = await Promise.all([
    api.fetchUsers({
      fields: "user_id,user_fname,user_lname,user_department,is_deleted"
    }),
    api.fetchDepartments(),
    api.fetchPostedPayrollRuns(),
    api.fetchPendingApprovals()
  ]);

  // Total employees count: Filter results to ensure accuracy (matching wage module logic)
  const activeUsers = allUsersRaw.filter((u: Record<string, unknown>) => {
    // Check if is_deleted is null, 0, or missing (per Directus bit/boolean patterns)
    const udel = u.is_deleted as { data?: number[] } | number | null | undefined;
    const delVal = (typeof udel === "object" && udel !== null && "data" in udel) ? udel.data?.[0] : udel;
    return delVal === 0 || delVal === null || delVal === undefined;
  });

  const activeEmpCount = activeUsers.length;

  // B. Department Distribution Logic
  const deptMap = new Map<number, string>();
  departmentsRaw.forEach(d => deptMap.set(Number(d.department_id || d.id), String(d.department_name || d.name)));

  const deptCount: Record<string, number> = {};
  activeUsers.forEach((u: Record<string, unknown>) => {
    const deptId = u.user_department != null ? Number(u.user_department) : null;
    const deptName = deptId != null ? deptMap.get(deptId) || "Other" : "Unassigned";
    deptCount[deptName] = (deptCount[deptName] || 0) + 1;
  });

  const distDataRaw = Object.entries(deptCount).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  // Show Top 5 and aggregate others so the sum matches 'activeEmpCount'
  const distData = distDataRaw.slice(0, 5);
  if (distDataRaw.length > 5) {
    const othersValue = distDataRaw.slice(5).reduce((sum, item) => sum + item.value, 0);
    distData.push({ name: "Others", value: othersValue });
  }

  // C. Aggregate Payroll Runs (Summed by Cutoff)
  const runsByCutoff: Record<string, number> = {};
  postedRunsRaw.forEach((run: Record<string, unknown>) => {
    const date = String(run.cutoff_end || "");
    const net = Number(run.total_net) || 0;
    runsByCutoff[date] = (runsByCutoff[date] || 0) + net;
  });

  const sortedCutoffs = Object.entries(runsByCutoff)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const last6 = sortedCutoffs.slice(-6);
  const trendData = last6.map(item => ({
    month: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount: item.total,
    payroll: item.total
  }));

  const latestPayrollAmount = sortedCutoffs.length > 0
    ? sortedCutoffs[sortedCutoffs.length - 1].total
    : 0;

  return {
    stats: {
      employees: activeEmpCount,
      payrollThisMonth: latestPayrollAmount,
      upcomingLeaves: 0,
      pendingApprovals: pendingApprovalsRaw.length,
    },
    payrollTrend: trendData,
    employeeDistribution: distData,
  };
};
