// @modules/dashboard/providers/dashboardService.ts
import * as api from "./dashboardApi";
import { format } from "date-fns";
import type {
  DashboardData,
  CutoffProgressData,
  DepartmentProgressItem,
} from "../types";

function parseYmd(dateStr?: unknown): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const s = dateStr.trim().slice(0, 10);
  const parts = s.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? null : dt;
}

function safeFormatDate(dStr?: string | null, pattern = "MMM dd, yyyy"): string {
  if (!dStr) return "";
  try {
    const dt = parseYmd(dStr) || new Date(dStr);
    return isNaN(dt.getTime()) ? String(dStr) : format(dt, pattern);
  } catch {
    return String(dStr);
  }
}

function computeDefaultPayoutDate(cutoff: Record<string, unknown>): Date | null {
  const end = parseYmd(cutoff.end_date);
  if (!end) return null;
  const cutoffType = String(cutoff.cutoff_type || "").toUpperCase();
  const year = end.getFullYear();
  const month = end.getMonth();

  if (cutoffType === "FIRST") {
    return new Date(year, month, 15);
  } else if (cutoffType === "SECOND") {
    return new Date(year, month + 1, 0);
  }
  return new Date(end.getTime() + 5 * 86400000);
}

export const fetchDashboardData = async (): Promise<DashboardData> => {
  // A. Fetch all core master data in parallel
  const [allUsersRaw, departmentsRaw, postedRunsRaw, pendingApprovalsRaw, cutoffsRaw] = await Promise.all([
    api.fetchUsers({
      fields: "user_id,user_fname,user_lname,user_department,is_deleted"
    }),
    api.fetchDepartments(),
    api.fetchPostedPayrollRuns(),
    api.fetchPendingApprovals(),
    api.fetchCutoffs(),
  ]);

  // Total employees count: Filter active employees
  const activeUsers = allUsersRaw.filter((u: Record<string, unknown>) => {
    const udel = u.is_deleted as { data?: number[] } | number | null | undefined;
    const delVal = (typeof udel === "object" && udel !== null && "data" in udel) ? udel.data?.[0] : udel;
    return delVal === 0 || delVal === null || delVal === undefined;
  });

  const activeEmpCount = activeUsers.length;

  // Active departments (deleted departments already excluded by api.fetchDepartments)
  const activeDepartments = departmentsRaw.filter((d: Record<string, unknown>) => {
    const del = d.is_delete ?? d.is_deleted;
    return !(del === 1 || del === true || del === "1" || (del as any)?.data?.[0] === 1);
  });

  // B. Department Distribution Logic
  const deptMap = new Map<number, string>();
  activeDepartments.forEach(d => deptMap.set(Number(d.department_id || d.id), String(d.department_name || d.name)));

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
    month: safeFormatDate(item.date, "MMM dd"),
    amount: item.total,
    payroll: item.total
  }));

  const latestPayrollAmount = sortedCutoffs.length > 0
    ? sortedCutoffs[sortedCutoffs.length - 1].total
    : 0;

  const previousPayrollAmount = sortedCutoffs.length > 1
    ? sortedCutoffs[sortedCutoffs.length - 2].total
    : 0;

  let percentageChange: number | null = null;
  if (previousPayrollAmount > 0) {
    percentageChange = ((latestPayrollAmount - previousPayrollAmount) / previousPayrollAmount) * 100;
  } else if (latestPayrollAmount > 0 && previousPayrollAmount === 0) {
    percentageChange = 100;
  }

  // D. Determine Current Cutoff until +1 day of paid day, and calculate department completion percentage
  interface CutoffWindow {
    cutoff: Record<string, unknown>;
    id: number;
    startDateStr: string | null;
    endDateStr: string | null;
    payoutDateStr: string | null;
    payoutDate: Date | null;
    paidDayPlusOne: Date | null;
  }

  const cutoffWindows: CutoffWindow[] = cutoffsRaw
    .map((c) => {
      const id = Number(c.id);
      const startDateStr = c.start_date ? String(c.start_date).slice(0, 10) : null;
      const endDateStr = c.end_date ? String(c.end_date).slice(0, 10) : null;
      let payoutDateStr = c.payout_date ? String(c.payout_date).slice(0, 10) : null;
      const payoutDate = payoutDateStr ? parseYmd(payoutDateStr) : computeDefaultPayoutDate(c);

      if (payoutDate && !payoutDateStr) {
        const y = payoutDate.getFullYear();
        const m = String(payoutDate.getMonth() + 1).padStart(2, "0");
        const d = String(payoutDate.getDate()).padStart(2, "0");
        payoutDateStr = `${y}-${m}-${d}`;
      }

      let paidDayPlusOne: Date | null = null;
      if (payoutDate) {
        paidDayPlusOne = new Date(payoutDate.getTime() + 1 * 86400000);
        paidDayPlusOne.setHours(23, 59, 59, 999);
      }

      return {
        cutoff: c,
        id,
        startDateStr,
        endDateStr,
        payoutDateStr,
        payoutDate,
        paidDayPlusOne,
      };
    })
    .filter((cw) => cw.id && cw.startDateStr)
    .sort((a, b) => {
      const timeA = parseYmd(a.startDateStr)?.getTime() ?? 0;
      const timeB = parseYmd(b.startDateStr)?.getTime() ?? 0;
      return timeA - timeB;
    });

  const now = new Date();

  // Find current cutoff: active until +1 day of the paid day (inclusive)
  let currentWindow = cutoffWindows.find((cw) => {
    if (!cw.paidDayPlusOne) return false;
    return now.getTime() <= cw.paidDayPlusOne.getTime();
  });

  // Fallback: If all cutoffs in the database are past paidDay + 1, use the latest one
  if (!currentWindow && cutoffWindows.length > 0) {
    currentWindow = cutoffWindows[cutoffWindows.length - 1];
  }

  let cutoffProgress: CutoffProgressData = {
    cutoffId: null,
    cutoffTitle: "No Active Cutoff",
    cutoffType: null,
    startDate: null,
    endDate: null,
    payoutDate: null,
    paidDayPlusOne: null,
    isWindowActive: false,
    totalDepartments: activeDepartments.length,
    completedDepartments: 0,
    percentage: 0,
    departments: activeDepartments.map((d) => ({
      id: Number(d.department_id || d.id),
      name: String(d.department_name || d.name || `Department #${d.id}`),
      isCompleted: false,
    })),
  };

  if (currentWindow) {
    let cutoffRuns = await api.fetchPayrollRuns({
      "filter[cutoff_id][_eq]": String(currentWindow.id),
    });

    if (cutoffRuns.length === 0 && currentWindow.startDateStr && currentWindow.endDateStr) {
      cutoffRuns = await api.fetchPayrollRuns({
        "filter[cutoff_start][_eq]": currentWindow.startDateStr,
        "filter[cutoff_end][_eq]": currentWindow.endDateStr,
      });
    }

    const postedRuns = cutoffRuns.filter(
      (r) => String(r.status || "").toUpperCase() === "POSTED"
    );

    const isConsolidatedPosted = postedRuns.some(
      (r) => r.department_id == null || r.department_id === "ALL" || Number(r.department_id) === 0
    );

    const postedDeptIdSet = new Set<number>();
    postedRuns.forEach((r) => {
      if (r.department_id != null) {
        postedDeptIdSet.add(Number(r.department_id));
      }
    });

    const deptProgressItems: DepartmentProgressItem[] = activeDepartments.map((d) => {
      const deptId = Number(d.department_id || d.id);
      const isCompleted = isConsolidatedPosted || postedDeptIdSet.has(deptId);
      return {
        id: deptId,
        name: String(d.department_name || d.name || `Department #${deptId}`),
        isCompleted,
        status: isCompleted ? "POSTED" : "PENDING",
      };
    });

    const completedCount = deptProgressItems.filter((item) => item.isCompleted).length;
    const totalCount = activeDepartments.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const typeLabel =
      String(currentWindow.cutoff.cutoff_type || "").toUpperCase() === "FIRST"
        ? "1st Cutoff"
        : String(currentWindow.cutoff.cutoff_type || "").toUpperCase() === "SECOND"
        ? "2nd Cutoff"
        : currentWindow.cutoff.cutoff_type
        ? String(currentWindow.cutoff.cutoff_type)
        : "";

    let monthYearLabel = "";
    if (currentWindow.cutoff.month && currentWindow.cutoff.year) {
      try {
        monthYearLabel = format(
          new Date(Number(currentWindow.cutoff.year), Number(currentWindow.cutoff.month) - 1, 1),
          "MMMM yyyy"
        );
      } catch {
        monthYearLabel = `${currentWindow.cutoff.month}/${currentWindow.cutoff.year}`;
      }
    } else if (currentWindow.endDateStr) {
      monthYearLabel = safeFormatDate(currentWindow.endDateStr, "MMMM yyyy");
    }

    const cutoffTitle = [monthYearLabel, typeLabel].filter(Boolean).join(" • ") || `Cutoff #${currentWindow.id}`;

    const paidDayPlusOneYmd = currentWindow.paidDayPlusOne
      ? format(currentWindow.paidDayPlusOne, "yyyy-MM-dd")
      : null;

    const isWindowActive = currentWindow.paidDayPlusOne
      ? now.getTime() <= currentWindow.paidDayPlusOne.getTime()
      : true;

    cutoffProgress = {
      cutoffId: currentWindow.id,
      cutoffTitle,
      cutoffType: currentWindow.cutoff.cutoff_type ? String(currentWindow.cutoff.cutoff_type) : null,
      startDate: currentWindow.startDateStr,
      endDate: currentWindow.endDateStr,
      payoutDate: currentWindow.payoutDateStr,
      paidDayPlusOne: paidDayPlusOneYmd,
      isWindowActive,
      totalDepartments: totalCount,
      completedDepartments: completedCount,
      percentage,
      departments: deptProgressItems,
    };
  }

  return {
    stats: {
      employees: activeEmpCount,
      payrollThisMonth: latestPayrollAmount,
      payrollPercentageChange: percentageChange,
      upcomingLeaves: 0,
      pendingApprovals: pendingApprovalsRaw.length,
      cutoffCompletionPercentage: cutoffProgress.percentage,
      completedDepartments: cutoffProgress.completedDepartments,
      totalDepartments: cutoffProgress.totalDepartments,
      currentCutoffTitle: cutoffProgress.cutoffTitle,
    },
    payrollTrend: trendData,
    employeeDistribution: distData,
    cutoffProgress,
  };
};
