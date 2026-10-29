// app/api/unified/payroll-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { COMPANIES, CompanyConfig } from "@/lib/companies";
import { buildForwardHeaders, joinUrl, parseJsonSafe } from "@/lib/api-helper";
import type {
  CompanyPayrollStatus,
  OverallPayrollStatus,
  UnifiedPayrollStatusApiResponse,
  DepartmentPayrollDetail,
  CutoffInfo,
  AvailableCutoffOption,
  CompanyPayrollStatusType,
  DepartmentRunStatus,
} from "@/modules/unified/payroll-status/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseYmd(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dt = new Date(y, m, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function computeDefaultPayoutDate(cutoff: Record<string, unknown>): Date | null {
  const cType = String(cutoff.cutoff_type || "").toUpperCase();
  const y = Number(cutoff.year);
  const m = Number(cutoff.month);
  if (!isNaN(y) && !isNaN(m) && y > 0 && m >= 1 && m <= 12) {
    if (cType === "FIRST") return new Date(y, m - 1, 15);
    if (cType === "SECOND") return new Date(y, m, 0); // Last day of month
  }
  if (cutoff.end_date) {
    return parseYmd(String(cutoff.end_date));
  }
  return null;
}

function formatCutoffLabel(c: Record<string, unknown>): string {
  const typeLabel =
    String(c.cutoff_type || "").toUpperCase() === "FIRST"
      ? "1st Cutoff"
      : String(c.cutoff_type || "").toUpperCase() === "SECOND"
      ? "2nd Cutoff"
      : c.cutoff_type
      ? String(c.cutoff_type)
      : "Cutoff";

  const s = c.start_date ? String(c.start_date).slice(0, 10) : "";
  const e = c.end_date ? String(c.end_date).slice(0, 10) : "";

  if (s && e) {
    return `${s} to ${e} (${typeLabel})`;
  }
  return typeLabel;
}

interface RawDepartment {
  department_id?: number | string;
  id?: number | string;
  department_name?: string;
  name?: string;
  is_delete?: number | boolean | string;
}

interface RawPayrollRun {
  payroll_run_id?: number | string;
  id?: number | string;
  payroll_ref_no?: string;
  status?: string;
  department_id?: number | string | null;
  department_name?: string;
  cutoff_id?: number | string;
  cutoff_start?: string;
  cutoff_end?: string;
  cutoff_type?: string;
  payout_date?: string;
  total_gross?: number | string;
  total_net?: number | string;
  total_deductions?: number | string;
  headcount?: number | string;
  employee_count?: number | string;
  created_at?: string;
  posted_at?: string;
}

async function fetchCompanyPayrollStatus(
  company: CompanyConfig,
  req: NextRequest,
  selectedCutoffKey?: string | null
): Promise<CompanyPayrollStatus> {
  const now = new Date();
  const timestamp = now.toISOString();

  try {
    const headers = buildForwardHeaders(req, company, { forceServiceToken: true });

    const pathCutoffs = `/items/cutoff_settings?sort=-start_date&limit=25`;
    const pathDepts = `/items/department?limit=500&filter[is_delete][_neq]=1&fields=department_id,id,department_name,name,is_delete`;
    const pathRuns = `/items/payroll_run?sort=-created_at&limit=200&fields=payroll_run_id,id,payroll_ref_no,status,department_id,department_name,cutoff_id,cutoff_start,cutoff_end,cutoff_type,payout_date,total_gross,total_net,total_deductions,headcount,employee_count,created_at,posted_at`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const [resCutoffs, resDepts, resRuns] = await Promise.all([
      fetch(joinUrl(company.apiBase, pathCutoffs), {
        headers,
        signal: controller.signal,
        cache: "no-store",
      }).catch((e) => ({ ok: false, status: 500, error: e.message } as any)),
      fetch(joinUrl(company.apiBase, pathDepts), {
        headers,
        signal: controller.signal,
        cache: "no-store",
      }).catch((e) => ({ ok: false, status: 500, error: e.message } as any)),
      fetch(joinUrl(company.apiBase, pathRuns), {
        headers,
        signal: controller.signal,
        cache: "no-store",
      }).catch((e) => ({ ok: false, status: 500, error: e.message } as any)),
    ]);

    clearTimeout(timeoutId);

    if (!resCutoffs.ok && !resDepts.ok && !resRuns.ok) {
      return {
        company_id: company.id,
        company_name: company.name,
        company_color: company.color,
        company_description: company.description,
        status: "OFFLINE",
        status_label: "Instance Offline",
        current_cutoff: null,
        departments_total: 0,
        departments_completed: 0,
        progress_percentage: 0,
        runs_summary: { draft: 0, pending_checker: 0, pending_approver: 0, processed: 0, posted: 0, total: 0 },
        financials: { total_gross: 0, total_deductions: 0, total_net: 0, headcount: 0 },
        departments_detail: [],
        error: "Directus endpoint unreachable or timed out",
        last_updated: timestamp,
      };
    }

    const jsonCutoffs = resCutoffs.ok ? await parseJsonSafe(resCutoffs) : null;
    const jsonDepts = resDepts.ok ? await parseJsonSafe(resDepts) : null;
    const jsonRuns = resRuns.ok ? await parseJsonSafe(resRuns) : null;

    const rawCutoffs: Record<string, unknown>[] = Array.isArray(jsonCutoffs?.data) ? jsonCutoffs.data : [];
    const rawDepts: RawDepartment[] = Array.isArray(jsonDepts?.data) ? jsonDepts.data : [];
    const rawRuns: RawPayrollRun[] = Array.isArray(jsonRuns?.data) ? jsonRuns.data : [];

    // Filter active departments (exclude deleted)
    const activeDepts = rawDepts.filter((d) => {
      const del = d.is_delete;
      return !(del === 1 || del === true || del === "1" || (del as any)?.data?.[0] === 1);
    });

    if (rawCutoffs.length === 0) {
      return {
        company_id: company.id,
        company_name: company.name,
        company_color: company.color,
        company_description: company.description,
        status: "NO_CUTOFF",
        status_label: "No Cutoff Configured",
        current_cutoff: null,
        departments_total: activeDepts.length,
        departments_completed: 0,
        progress_percentage: 0,
        runs_summary: { draft: 0, pending_checker: 0, pending_approver: 0, processed: 0, posted: 0, total: 0 },
        financials: { total_gross: 0, total_deductions: 0, total_net: 0, headcount: 0 },
        departments_detail: activeDepts.map((d) => ({
          id: Number(d.department_id || d.id),
          name: String(d.department_name || d.name || `Department #${d.id}`),
          status: "NOT_STARTED",
          isCompleted: false,
        })),
        last_updated: timestamp,
      };
    }

    // Process cutoffs to find target window
    interface CutoffWindow {
      raw: Record<string, unknown>;
      id: number;
      startDateStr: string | null;
      endDateStr: string | null;
      payoutDateStr: string | null;
      payoutDate: Date | null;
      paidDayPlusOne: Date | null;
      key: string;
      label: string;
    }

    const cutoffWindows: CutoffWindow[] = rawCutoffs
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

        const key = startDateStr && endDateStr ? `${startDateStr}_${endDateStr}` : String(id);
        const label = formatCutoffLabel(c);

        return {
          raw: c,
          id,
          startDateStr,
          endDateStr,
          payoutDateStr,
          payoutDate,
          paidDayPlusOne,
          key,
          label,
        };
      })
      .filter((cw) => cw.id && cw.startDateStr)
      .sort((a, b) => {
        const timeA = parseYmd(a.startDateStr)?.getTime() ?? 0;
        const timeB = parseYmd(b.startDateStr)?.getTime() ?? 0;
        return timeA - timeB;
      });

    // Select cutoff window
    let targetWindow: CutoffWindow | undefined;

    if (selectedCutoffKey && selectedCutoffKey !== "CURRENT" && selectedCutoffKey !== "ALL") {
      targetWindow = cutoffWindows.find((cw) => cw.key === selectedCutoffKey);
    }

    if (!targetWindow) {
      // Find current cutoff: active until +1 day of the paid day (inclusive)
      targetWindow = cutoffWindows.find((cw) => {
        if (!cw.paidDayPlusOne) return false;
        return now.getTime() <= cw.paidDayPlusOne.getTime();
      });

      // Fallback: Latest cutoff if all are past
      if (!targetWindow && cutoffWindows.length > 0) {
        targetWindow = cutoffWindows[cutoffWindows.length - 1];
      }
    }

    if (!targetWindow) {
      return {
        company_id: company.id,
        company_name: company.name,
        company_color: company.color,
        company_description: company.description,
        status: "NO_CUTOFF",
        status_label: "No Active Cutoff",
        current_cutoff: null,
        departments_total: activeDepts.length,
        departments_completed: 0,
        progress_percentage: 0,
        runs_summary: { draft: 0, pending_checker: 0, pending_approver: 0, processed: 0, posted: 0, total: 0 },
        financials: { total_gross: 0, total_deductions: 0, total_net: 0, headcount: 0 },
        departments_detail: activeDepts.map((d) => ({
          id: Number(d.department_id || d.id),
          name: String(d.department_name || d.name || `Department #${d.id}`),
          status: "NOT_STARTED",
          isCompleted: false,
        })),
        last_updated: timestamp,
      };
    }

    // Filter runs matching the target cutoff window
    const targetCutoffId = targetWindow.id;
    const targetStartDate = targetWindow.startDateStr;
    const targetEndDate = targetWindow.endDateStr;

    const matchingRuns = rawRuns.filter((r) => {
      const cId = Number(r.cutoff_id);
      if (cId && cId === targetCutoffId) return true;
      if (targetStartDate && targetEndDate && r.cutoff_start && r.cutoff_end) {
        const s = String(r.cutoff_start).slice(0, 10);
        const e = String(r.cutoff_end).slice(0, 10);
        return s === targetStartDate && e === targetEndDate;
      }
      return false;
    });

    // Check for consolidated run (department_id null, 0, or "ALL")
    const consolidatedRun = matchingRuns.find(
      (r) => r.department_id == null || r.department_id === "ALL" || Number(r.department_id) === 0
    );
    const isConsolidatedPosted =
      consolidatedRun && String(consolidatedRun.status || "").toUpperCase() === "POSTED";

    // Build department lookup map with latest run per department
    const deptRunMap = new Map<number, RawPayrollRun>();
    matchingRuns.forEach((r) => {
      if (r.department_id != null && r.department_id !== "ALL" && Number(r.department_id) !== 0) {
        const dId = Number(r.department_id);
        const existing = deptRunMap.get(dId);
        if (!existing) {
          deptRunMap.set(dId, r);
        } else {
          // If existing is not POSTED and current is POSTED, pick POSTED
          const existStatus = String(existing.status || "").toUpperCase();
          const currStatus = String(r.status || "").toUpperCase();
          if (existStatus !== "POSTED" && currStatus === "POSTED") {
            deptRunMap.set(dId, r);
          }
        }
      }
    });

    // Department details
    const departmentsDetail: DepartmentPayrollDetail[] = activeDepts.map((d) => {
      const deptId = Number(d.department_id || d.id);
      const deptName = String(d.department_name || d.name || `Department #${deptId}`);

      if (isConsolidatedPosted) {
        return {
          id: deptId,
          name: deptName,
          status: "POSTED",
          isCompleted: true,
          payroll_ref_no: consolidatedRun?.payroll_ref_no || `RUN-${consolidatedRun?.payroll_run_id || consolidatedRun?.id}`,
          payroll_run_id: Number(consolidatedRun?.payroll_run_id || consolidatedRun?.id),
          posted_at: consolidatedRun?.posted_at || null,
        };
      }

      const run = deptRunMap.get(deptId);
      if (!run) {
        return {
          id: deptId,
          name: deptName,
          status: "NOT_STARTED",
          isCompleted: false,
        };
      }

      const st = String(run.status || "").toUpperCase() as DepartmentRunStatus;
      const isCompleted = st === "POSTED";

      return {
        id: deptId,
        name: deptName,
        status: st || "DRAFT",
        isCompleted,
        payroll_ref_no: run.payroll_ref_no || `RUN-${run.payroll_run_id || run.id}`,
        payroll_run_id: Number(run.payroll_run_id || run.id),
        headcount: toNum(run.headcount || run.employee_count),
        total_net: toNum(run.total_net),
        total_gross: toNum(run.total_gross),
        posted_at: run.posted_at || null,
        updated_at: run.created_at || null,
      };
    });

    const completedDeptsCount = isConsolidatedPosted
      ? activeDepts.length
      : departmentsDetail.filter((d) => d.isCompleted).length;
    const totalDeptsCount = activeDepts.length;
    const progressPercentage =
      totalDeptsCount > 0 ? Math.round((completedDeptsCount / totalDeptsCount) * 100) : 0;

    // Runs breakdown summary
    const runsSummary = {
      draft: 0,
      pending_checker: 0,
      pending_approver: 0,
      processed: 0,
      posted: 0,
      total: matchingRuns.length,
    };

    matchingRuns.forEach((r) => {
      const st = String(r.status || "").toUpperCase();
      if (st === "DRAFT") runsSummary.draft++;
      else if (st === "PENDING_CHECKER") runsSummary.pending_checker++;
      else if (st === "PENDING_APPROVER") runsSummary.pending_approver++;
      else if (st === "PROCESSED") runsSummary.processed++;
      else if (st === "POSTED") runsSummary.posted++;
    });

    // Compute financial aggregates for this cutoff
    let totalGross = 0;
    let totalNet = 0;
    let totalDeductions = 0;
    let headcount = 0;

    if (consolidatedRun) {
      totalGross = toNum(consolidatedRun.total_gross);
      totalNet = toNum(consolidatedRun.total_net);
      totalDeductions = toNum(consolidatedRun.total_deductions);
      headcount = toNum(consolidatedRun.headcount || consolidatedRun.employee_count);
    } else {
      // Sum the latest run of each department
      deptRunMap.forEach((run) => {
        totalGross += toNum(run.total_gross);
        totalNet += toNum(run.total_net);
        totalDeductions += toNum(run.total_deductions);
        headcount += toNum(run.headcount || run.employee_count);
      });
    }

    // Determine overall status of this company
    let status: CompanyPayrollStatusType = "PENDING";
    let statusLabel = "Pending Cutoff";

    if (totalDeptsCount > 0 && completedDeptsCount === totalDeptsCount) {
      status = "COMPLETED";
      statusLabel = "Completed (All Depts Posted)";
    } else if (completedDeptsCount > 0 || matchingRuns.length > 0) {
      status = "IN_PROGRESS";
      if (completedDeptsCount > 0) {
        statusLabel = `In Progress (${completedDeptsCount}/${totalDeptsCount} Done)`;
      } else if (runsSummary.pending_approver > 0) {
        statusLabel = "In Progress (Pending Approval)";
      } else if (runsSummary.pending_checker > 0) {
        statusLabel = "In Progress (Pending Checking)";
      } else {
        statusLabel = "In Progress (Drafting)";
      }
    } else {
      status = "PENDING";
      statusLabel = "Not Started";
    }

    const currentCutoffInfo: CutoffInfo = {
      id: targetWindow.id,
      label: targetWindow.label,
      cutoff_type: targetWindow.raw.cutoff_type ? String(targetWindow.raw.cutoff_type) : null,
      start_date: targetWindow.startDateStr,
      end_date: targetWindow.endDateStr,
      payout_date: targetWindow.payoutDateStr,
      paid_day_plus_one: targetWindow.paidDayPlusOne ? targetWindow.paidDayPlusOne.toISOString() : null,
      is_current: !selectedCutoffKey || selectedCutoffKey === "CURRENT",
    };

    return {
      company_id: company.id,
      company_name: company.name,
      company_color: company.color,
      company_description: company.description,
      status,
      status_label: statusLabel,
      current_cutoff: currentCutoffInfo,
      departments_total: totalDeptsCount,
      departments_completed: completedDeptsCount,
      progress_percentage: progressPercentage,
      runs_summary: runsSummary,
      financials: {
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
        headcount,
      },
      departments_detail: departmentsDetail,
      last_updated: timestamp,
    };
  } catch (err: any) {
    return {
      company_id: company.id,
      company_name: company.name,
      company_color: company.color,
      company_description: company.description,
      status: "OFFLINE",
      status_label: "Service Error",
      current_cutoff: null,
      departments_total: 0,
      departments_completed: 0,
      progress_percentage: 0,
      runs_summary: { draft: 0, pending_checker: 0, pending_approver: 0, processed: 0, posted: 0, total: 0 },
      financials: { total_gross: 0, total_deductions: 0, total_net: 0, headcount: 0 },
      departments_detail: [],
      error: err.message || "Failed to query company instance",
      last_updated: timestamp,
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetCompanyId = searchParams.get("companyId");
    const cutoffKey = searchParams.get("cutoff");

    // Discover companies from .env.local via COMPANIES singleton
    let activeCompanies = COMPANIES.filter((c) => !c.hidden);

    if (targetCompanyId && targetCompanyId !== "ALL") {
      activeCompanies = activeCompanies.filter((c) => c.id === targetCompanyId);
    }

    if (activeCompanies.length === 0) {
      const emptyOverall: OverallPayrollStatus = {
        total_companies: 0,
        online_companies: 0,
        completed_companies: 0,
        in_progress_companies: 0,
        pending_companies: 0,
        offline_companies: 0,
        overall_percentage: 0,
        total_enterprise_gross: 0,
        total_enterprise_net: 0,
        total_enterprise_deductions: 0,
        total_enterprise_headcount: 0,
        overall_status_label: "PENDING",
        cutoff_label: "No Active Cutoffs",
      };

      const response: UnifiedPayrollStatusApiResponse = {
        success: true,
        data: [],
        overall: emptyOverall,
        available_cutoffs: [],
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }

    // Query all entities in parallel
    const settledResults = await Promise.allSettled(
      activeCompanies.map((c) => fetchCompanyPayrollStatus(c, req, cutoffKey))
    );

    const companiesData: CompanyPayrollStatus[] = [];
    settledResults.forEach((res, index) => {
      const company = activeCompanies[index];
      if (res.status === "fulfilled") {
        companiesData.push(res.value);
      } else {
        companiesData.push({
          company_id: company.id,
          company_name: company.name,
          company_color: company.color,
          company_description: company.description,
          status: "OFFLINE",
          status_label: "Request Failed",
          current_cutoff: null,
          departments_total: 0,
          departments_completed: 0,
          progress_percentage: 0,
          runs_summary: { draft: 0, pending_checker: 0, pending_approver: 0, processed: 0, posted: 0, total: 0 },
          financials: { total_gross: 0, total_deductions: 0, total_net: 0, headcount: 0 },
          departments_detail: [],
          error: res.reason?.message || "Internal error",
          last_updated: new Date().toISOString(),
        });
      }
    });

    // Compute Overall Status aggregates
    let onlineCount = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let pendingCount = 0;
    let offlineCount = 0;

    let totalEnterpriseGross = 0;
    let totalEnterpriseNet = 0;
    let totalEnterpriseDeductions = 0;
    let totalEnterpriseHeadcount = 0;

    const cutoffLabelsSet = new Set<string>();

    companiesData.forEach((c) => {
      if (c.status === "OFFLINE") {
        offlineCount++;
      } else {
        onlineCount++;
        if (c.status === "COMPLETED") completedCount++;
        else if (c.status === "IN_PROGRESS") inProgressCount++;
        else pendingCount++;

        totalEnterpriseGross += c.financials.total_gross;
        totalEnterpriseNet += c.financials.total_net;
        totalEnterpriseDeductions += c.financials.total_deductions;
        totalEnterpriseHeadcount += c.financials.headcount;

        if (c.current_cutoff?.label) {
          cutoffLabelsSet.add(c.current_cutoff.label);
        }
      }
    });

    const overallPercentage =
      onlineCount > 0 ? Math.round((completedCount / onlineCount) * 100) : 0;

    let overallStatusLabel: OverallPayrollStatus["overall_status_label"] = "PENDING";
    if (onlineCount > 0 && completedCount === onlineCount) {
      overallStatusLabel = "COMPLETED";
    } else if (completedCount > 0 || inProgressCount > 0) {
      overallStatusLabel = "IN_PROGRESS";
    } else if (offlineCount > 0 && onlineCount === 0) {
      overallStatusLabel = "ATTENTION_REQUIRED";
    } else {
      overallStatusLabel = "PENDING";
    }

    const cutoffLabel =
      cutoffLabelsSet.size === 1
        ? Array.from(cutoffLabelsSet)[0]
        : cutoffLabelsSet.size > 1
        ? `${Array.from(cutoffLabelsSet)[0]} (+multi-entity)`
        : "Current Active Window";

    const overall: OverallPayrollStatus = {
      total_companies: companiesData.length,
      online_companies: onlineCount,
      completed_companies: completedCount,
      in_progress_companies: inProgressCount,
      pending_companies: pendingCount,
      offline_companies: offlineCount,
      overall_percentage: overallPercentage,
      total_enterprise_gross: totalEnterpriseGross,
      total_enterprise_net: totalEnterpriseNet,
      total_enterprise_deductions: totalEnterpriseDeductions,
      total_enterprise_headcount: totalEnterpriseHeadcount,
      overall_status_label: overallStatusLabel,
      cutoff_label: cutoffLabel,
    };

    // Collect available cutoffs from across all entities for the dropdown
    const availableCutoffsMap = new Map<string, AvailableCutoffOption>();
    companiesData.forEach((c) => {
      if (c.current_cutoff && c.current_cutoff.start_date && c.current_cutoff.end_date) {
        const key = `${c.current_cutoff.start_date}_${c.current_cutoff.end_date}`;
        if (!availableCutoffsMap.has(key)) {
          availableCutoffsMap.set(key, {
            key,
            label: c.current_cutoff.label,
            start_date: c.current_cutoff.start_date,
            end_date: c.current_cutoff.end_date,
            cutoff_type: c.current_cutoff.cutoff_type || undefined,
          });
        }
      }
    });

    const payload: UnifiedPayrollStatusApiResponse = {
      success: true,
      data: companiesData,
      overall,
      available_cutoffs: Array.from(availableCutoffsMap.values()),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("Error in Unified Payroll Status aggregation:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to generate Unified Payroll Status report",
      },
      { status: 500 }
    );
  }
}
