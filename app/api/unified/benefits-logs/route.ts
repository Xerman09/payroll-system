// app/api/unified/benefits-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { COMPANIES, CompanyConfig } from "@/lib/companies";
import { buildForwardHeaders, joinUrl, parseJsonSafe } from "@/lib/api-helper";
import type {
  UnifiedBenefitLogRow,
  CompanySummary,
  UnifiedApiResponse,
  BenefitCode,
} from "@/modules/unified/benefits-logs/types";

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

function fullnameFromUser(u: any): string {
  if (!u) return "";
  const fname = u.user_fname ?? "";
  const lname = u.user_lname ?? "";
  return `${fname} ${lname}`.trim();
}

async function fetchCompanyBenefitLogs(
  company: CompanyConfig,
  req: NextRequest
): Promise<{ rows: UnifiedBenefitLogRow[]; error?: string }> {
  try {
    const headers = buildForwardHeaders(req, company, {
      forceServiceToken: true,
    });

    const pathUsers = `/items/user?limit=5000&fields=user_id,user_fname,user_lname`;

    const fieldsSystem = [
      "id",
      "cutoff_id",
      "user_id",
      "employee_name",
      "department_name",
      "benefit_sss",
      "benefit_philhealth",
      "benefit_pagibig",
      "benefit_loan_sss",
      "benefit_loan_pagibig",
      "cutoff_start",
      "cutoff_end",
      "cutoff_type",
      "payroll_run_id.payroll_ref_no",
      "payroll_run_id.payroll_run_id",
      "payroll_run_id.posted_at",
      "created_at",
    ].join(",");

    const pathSystem = `/items/payroll_run_employee?limit=5000&filter[payroll_run_id][status][_eq]=POSTED&filter[on_hold][_neq]=1&sort=-created_at&fields=${fieldsSystem}`;

    const fieldsManual = [
      "*",
      "user_id.*",
      "cutoff_start",
      "cutoff_end",
      "cutoff_type",
      "payroll_run_id.cutoff_start",
      "payroll_run_id.cutoff_end",
      "payroll_run_id.cutoff_type",
    ].join(",");

    const pathManual = `/items/benefit_logs?limit=5000&sort=-created_date&fields=${fieldsManual}`;

    // 6-second timeout per company fetch to avoid blocking the aggregated request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const [resUsers, resSystem, resManual] = await Promise.all([
      fetch(joinUrl(company.apiBase, pathUsers), {
        headers,
        signal: controller.signal,
        cache: "no-store",
      }).catch((e) => {
        return { ok: false, status: 500, error: e.message } as any;
      }),
      fetch(joinUrl(company.apiBase, pathSystem), {
        headers,
        signal: controller.signal,
        cache: "no-store",
      }).catch((e) => {
        return { ok: false, status: 500, error: e.message } as any;
      }),
      fetch(joinUrl(company.apiBase, pathManual), {
        headers,
        signal: controller.signal,
        cache: "no-store",
      }).catch((e) => {
        return { ok: false, status: 500, error: e.message } as any;
      }),
    ]);

    clearTimeout(timeoutId);

    const jsonUsers = resUsers?.ok ? await parseJsonSafe(resUsers) : null;
    const jsonSystem = resSystem?.ok ? await parseJsonSafe(resSystem) : null;
    const jsonManual = resManual?.ok ? await parseJsonSafe(resManual) : null;

    const rowsUsers: any[] = jsonUsers?.data || [];
    const rowsSystem: any[] = jsonSystem?.data || [];
    const rowsManual: any[] = jsonManual?.data || [];

    // Build user lookup map for employee name resolution
    const userMap = new Map<number, { name: string; department?: string; account?: string }>();
    for (const u of rowsUsers) {
      const name = fullnameFromUser(u);
      const uId = Number(u.user_id || u.id);
      if (uId && name) {
        userMap.set(uId, { name });
      }
    }

    // Prime userMap with snapshot employee names from payroll_run_employee
    for (const r of rowsSystem) {
      const uId = Number(r.user_id?.user_id || r.user_id);
      if (uId && r.employee_name && String(r.employee_name).trim()) {
        const existing = userMap.get(uId);
        userMap.set(uId, {
          name: String(r.employee_name).trim(),
          department: r.department_name || existing?.department,
        });
      }
    }

    const logMap = new Map<string, UnifiedBenefitLogRow>();

    const getKey = (r: UnifiedBenefitLogRow) => {
      return `${company.id}|${r.cutoff_id}|${r.user_id}|${r.benefit_code}|${r.log_type}|${r.loan_id ?? "null"}|${r.payroll_run_id || "null"}`;
    };

    // Build loan detail lookup from manual logs to suppress system duplicate summaries
    const hasLoanDetail = new Set<string>();
    for (const r of rowsManual) {
      if (r.log_type === "LOAN" && r.benefit_code) {
        const uId = r.user_id?.user_id || r.user_id;
        const pId = r.payroll_run_id || "null";
        hasLoanDetail.add(`${r.cutoff_id}|${uId}|${r.benefit_code}|${pId}`);
      }
    }

    // Process system posted logs
    for (const r of rowsSystem) {
      const user = r.user_id || {};
      const pr = r.payroll_run_id || {};
      const uId = Number(r.user_id?.user_id || r.user_id);
      const userFromMap = userMap.get(uId);

      const employeeName =
        r.employee_name && r.employee_name.trim() !== ""
          ? r.employee_name.trim()
          : userFromMap?.name && userFromMap.name.trim() !== ""
          ? userFromMap.name.trim()
          : fullnameFromUser(user);

      const departmentName =
        r.department_name ||
        userFromMap?.department ||
        (typeof user.user_department === "object" ? user.user_department?.department_name : null);

      const accountNo =
        r.account_no ||
        userFromMap?.account ||
        user.user_account_number ||
        user.account_number ||
        null;

      const common = {
        company_id: company.id,
        company_name: company.name,
        company_color: company.color,
        cutoff_id: r.cutoff_id,
        cutoff_start: r.cutoff_start || null,
        cutoff_end: r.cutoff_end || null,
        cutoff_type: r.cutoff_type || null,
        user_id: uId,
        employee_name: employeeName,
        account_no: accountNo,
        department_name: departmentName,
        payroll_run_id: r.payroll_run_id?.payroll_run_id || r.payroll_run_id || null,
        payroll_ref_no: pr.payroll_ref_no || `RUN-${r.payroll_run_id?.payroll_run_id || r.cutoff_id || "SYS"}`,
        posted_at: pr.posted_at || null,
        created_date: r.created_at || null,
        note: null,
        source_amount: 0,
      };

      const pushToMap = (item: UnifiedBenefitLogRow) => {
        const key = getKey(item);
        logMap.set(key, item);
      };

      // Contributions
      if (toNum(r.benefit_sss) > 0) {
        pushToMap({
          ...common,
          benefit_log_id: `${company.id}-CONTRI-SSS-${r.id}`,
          benefit_code: "SSS",
          benefit_name: "SSS",
          log_type: "CONTRIBUTION",
          loan_id: null,
          deducted_amount: toNum(r.benefit_sss),
        });
      }
      if (toNum(r.benefit_philhealth) > 0) {
        pushToMap({
          ...common,
          benefit_log_id: `${company.id}-CONTRI-PH-${r.id}`,
          benefit_code: "PHILHEALTH",
          benefit_name: "PhilHealth",
          log_type: "CONTRIBUTION",
          loan_id: null,
          deducted_amount: toNum(r.benefit_philhealth),
        });
      }
      if (toNum(r.benefit_pagibig) > 0) {
        pushToMap({
          ...common,
          benefit_log_id: `${company.id}-CONTRI-HDMF-${r.id}`,
          benefit_code: "PAGIBIG",
          benefit_name: "Pag-IBIG",
          log_type: "CONTRIBUTION",
          loan_id: null,
          deducted_amount: toNum(r.benefit_pagibig),
        });
      }

      // Loans
      const hasSssLoan = hasLoanDetail.has(
        `${r.cutoff_id}|${uId}|SSS|${r.payroll_run_id?.payroll_run_id || r.payroll_run_id || "null"}`
      );
      if (!hasSssLoan && toNum(r.benefit_loan_sss) > 0) {
        pushToMap({
          ...common,
          benefit_log_id: `${company.id}-LOAN-SSS-${r.id}`,
          benefit_code: "SSS",
          benefit_name: "SSS Loan",
          log_type: "LOAN",
          loan_id: null,
          deducted_amount: toNum(r.benefit_loan_sss),
        });
      }

      const hasPagibigLoan = hasLoanDetail.has(
        `${r.cutoff_id}|${uId}|PAGIBIG|${r.payroll_run_id?.payroll_run_id || r.payroll_run_id || "null"}`
      );
      if (!hasPagibigLoan && toNum(r.benefit_loan_pagibig) > 0) {
        pushToMap({
          ...common,
          benefit_log_id: `${company.id}-LOAN-HDMF-${r.id}`,
          benefit_code: "PAGIBIG",
          benefit_name: "Pag-IBIG Loan",
          log_type: "LOAN",
          loan_id: null,
          deducted_amount: toNum(r.benefit_loan_pagibig),
        });
      }
    }

    // Process manual logs
    for (const r of rowsManual) {
      const user = r.user_id || {};
      const uId = Number(r.user_id?.user_id || r.user_id);
      const userFromMap = userMap.get(uId);

      const employeeName =
        userFromMap?.name && userFromMap.name.trim() !== ""
          ? userFromMap.name.trim()
          : fullnameFromUser(user);

      const departmentName =
        userFromMap?.department ||
        (typeof user.user_department === "object" ? user.user_department?.department_name : null);

      const accountNo =
        userFromMap?.account ||
        user.user_account_number ||
        user.account_number ||
        null;

      let refNo = "Manual Adjustment";
      if (r.payroll_detail_id) {
        refNo = String(r.payroll_detail_id);
      } else if (r.payroll_run_id && Number(r.payroll_run_id) !== 0) {
        refNo = String(r.payroll_run_id);
      }

      const manualRow: UnifiedBenefitLogRow = {
        benefit_log_id: `${company.id}-MANUAL-${r.benefit_log_id || r.id}`,
        company_id: company.id,
        company_name: company.name,
        company_color: company.color,
        benefit_code: r.benefit_code as BenefitCode,
        benefit_name:
          r.benefit_code === "PAGIBIG"
            ? "Pag-IBIG"
            : r.benefit_code === "PHILHEALTH"
            ? "PhilHealth"
            : r.benefit_code,
        cutoff_id: r.cutoff_id,
        cutoff_start:
          r.cutoff_start ||
          (typeof r.payroll_run_id === "object" ? r.payroll_run_id?.cutoff_start : null),
        cutoff_end:
          r.cutoff_end ||
          (typeof r.payroll_run_id === "object" ? r.payroll_run_id?.cutoff_end : null),
        cutoff_type:
          r.cutoff_type ||
          (typeof r.payroll_run_id === "object" ? r.payroll_run_id?.cutoff_type : null),
        user_id: uId,
        employee_name: employeeName,
        account_no: accountNo,
        department_name: departmentName,

        log_type: r.log_type,
        loan_id: r.loan_id,

        source_amount: r.source_amount ? toNum(r.source_amount) : 0,
        deducted_amount: toNum(r.deducted_amount),

        payroll_run_id:
          typeof r.payroll_run_id === "object" ? r.payroll_run_id?.id : r.payroll_run_id,
        payroll_ref_no: refNo,

        note: r.note,
        posted_at:
          typeof r.payroll_run_id === "object"
            ? r.payroll_run_id?.posted_at
            : r.created_date,
        created_date: r.created_date,
      };

      const key = getKey(manualRow);
      logMap.set(key, manualRow);
    }

    return { rows: Array.from(logMap.values()) };
  } catch (err: any) {
    return { rows: [], error: err.message || "Failed to reach company Directus instance" };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetCompanyId = searchParams.get("companyId");

    // Discover companies from .env.local via COMPANIES singleton
    let activeCompanies = COMPANIES.filter((c) => !c.hidden);

    // If filtered by specific company
    if (targetCompanyId && targetCompanyId !== "ALL") {
      activeCompanies = activeCompanies.filter((c) => c.id === targetCompanyId);
    }

    if (activeCompanies.length === 0) {
      const response: UnifiedApiResponse = {
        success: true,
        data: [],
        companies: [],
        totalLogs: 0,
        totalAmount: 0,
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }

    // Run parallel queries across all companies with Promise.allSettled
    const results = await Promise.allSettled(
      activeCompanies.map((c) => fetchCompanyBenefitLogs(c, req))
    );

    const compiledRows: UnifiedBenefitLogRow[] = [];
    const companySummaries: CompanySummary[] = [];
    const failedCompanies: { id: string; name: string; error: string }[] = [];

    activeCompanies.forEach((c, idx) => {
      const res = results[idx];
      if (res.status === "fulfilled") {
        const { rows, error } = res.value;
        const totalCompanyDeduction = rows.reduce(
          (sum, r) => sum + (r.deducted_amount || 0),
          0
        );

        if (error) {
          failedCompanies.push({ id: c.id, name: c.name, error });
          companySummaries.push({
            id: c.id,
            name: c.name,
            color: c.color,
            description: c.description,
            logCount: 0,
            totalDeductions: 0,
            status: "error",
            error,
          });
        } else {
          compiledRows.push(...rows);
          companySummaries.push({
            id: c.id,
            name: c.name,
            color: c.color,
            description: c.description,
            logCount: rows.length,
            totalDeductions: totalCompanyDeduction,
            status: rows.length > 0 ? "ok" : "empty",
          });
        }
      } else {
        const errMsg = res.reason?.message || "Unknown error";
        failedCompanies.push({ id: c.id, name: c.name, error: errMsg });
        companySummaries.push({
          id: c.id,
          name: c.name,
          color: c.color,
          description: c.description,
          logCount: 0,
          totalDeductions: 0,
          status: "error",
          error: errMsg,
        });
      }
    });

    // Sort compiled rows descending by cutoff end / created date
    compiledRows.sort((a, b) => {
      const dateA = a.posted_at || a.cutoff_end || a.created_date || "";
      const dateB = b.posted_at || b.cutoff_end || b.created_date || "";
      return dateB.localeCompare(dateA);
    });

    const totalAmount = compiledRows.reduce(
      (sum, r) => sum + (r.deducted_amount || 0),
      0
    );

    const payload: UnifiedApiResponse = {
      success: true,
      data: compiledRows,
      companies: companySummaries,
      totalLogs: compiledRows.length,
      totalAmount,
      failedCompanies: failedCompanies.length > 0 ? failedCompanies : undefined,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("Error aggregating unified benefit logs:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Internal server error during benefit logs aggregation",
      },
      { status: 500 }
    );
  }
}
