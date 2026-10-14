

// modules/benefit-settings/providers/benefitApi.ts
import type {
  BenefitSetting,
  UserData,
  Department,
  BenefitLoan,
  BenefitLogRow,
  CutoffSetting,
  LoanBenefitCode,
  DeductOn,
  UserWageRecord,
  EmployeeBenefitCoverage,
  EmployeeBenefitDetail,
  EmployeeActiveLoanSummary,
} from "../types";
import {
  computeGsis,
  computePhilHealth,
  computePagibig,
} from "../utils/governmentContributions";

const BASE_API = "/api/benefit";


export async function fetchCompanyConfig(): Promise<{ companyName: string }> {
  try {
    const res = await fetch(`${BASE_API}?path=config`);
    return res.ok ? await res.json() : { companyName: "MEN2 MARKETING CORPORATION" };
  } catch {
    return { companyName: "MEN2 MARKETING CORPORATION" };
  }
}

export async function fetchGeneralSetting(key: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      "filter[setting_key][_eq]": key,
    });
    const json = await apiFetch(`/items/general_setting?${params.toString()}`);
    const data = json?.data || [];
    if (data.length > 0 && data[0].setting_value != null) {
      return String(data[0].setting_value).trim();
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch general setting:", error);
    return null;
  }
}


async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_API}?path=${encodeURIComponent(path)}`, options);

  // ✅ Directus DELETE often returns 204 (no body)
  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${path}${text ? ` - ${text}` : ""}`);
  }

  // ✅ If body is empty, avoid res.json() crash
  const text = await res.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // If server returned non-JSON text, still return something
    return { raw: text };
  }
}
// --------------------
// Shared helpers
// --------------------
export function fullnameFromUser(u: UserData) {
  return `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim();
}

export function formatMoney(v: number) {
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function cutoffLabel(c: CutoffSetting) {
  const s = new Date(c.start_date);
  const e = new Date(c.end_date);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  return `${fmt(s)} – ${fmt(e)} (${c.cutoff_type})`;
}

export function computeLoanCutoffSchedule(args: {
  loan: Pick<BenefitLoan, "start_cutoff_id" | "terms_installments" | "paid_installments" | "deduct_on">;
  cutoffs: CutoffSetting[];
}) {
  const { loan, cutoffs } = args;
  const ordered = [...cutoffs].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  const startIdx = ordered.findIndex((c) => c.id === loan.start_cutoff_id);
  if (startIdx < 0) {
    return {
      all: [] as CutoffSetting[],
      paid: [] as CutoffSetting[],
      upcoming: [] as CutoffSetting[],
      nextDue: null as CutoffSetting | null,
      endDue: null as CutoffSetting | null,
    };
  }

  const isEligible = (c: CutoffSetting, deductOn: DeductOn) => {
    if (deductOn === "BOTH") return true;
    return c.cutoff_type === deductOn;
  };

  const eligibleFromStart = ordered
    .slice(startIdx)
    .filter((c) => isEligible(c, loan.deduct_on));

  const all = eligibleFromStart.slice(0, Math.max(0, loan.terms_installments || 0));
  const paid = all.slice(0, Math.max(0, loan.paid_installments || 0));
  const upcoming = all.slice(paid.length);

  return {
    all,
    paid,
    upcoming,
    nextDue: upcoming.length ? upcoming[0] : null,
    endDue: all.length ? all[all.length - 1] : null,
  };
}

export function isLoanDueOnCutoff(args: {
  loan: Pick<BenefitLoan, "start_cutoff_id" | "terms_installments" | "paid_installments" | "deduct_on" | "status">;
  cutoffId: number;
  cutoffs: CutoffSetting[];
}) {
  if (args.loan.status !== "ACTIVE") return false;
  const sched = computeLoanCutoffSchedule({ loan: args.loan, cutoffs: args.cutoffs });
  return sched.upcoming.some((c) => c.id === args.cutoffId);
}

// --------------------
// Benefit settings (existing)
// --------------------
let inFlightBenefitSettings: Promise<BenefitSetting[]> | null = null;
export async function fetchBenefitSettings(): Promise<BenefitSetting[]> {
  if (inFlightBenefitSettings) return inFlightBenefitSettings;
  inFlightBenefitSettings = (async () => {
    try {
      const json = await apiFetch("/items/benefit_cutoff_settings?limit=200");
      return (json?.data || []) as BenefitSetting[];
    } catch (err) {
      console.warn("fetchBenefitSettings failed, falling back to empty list:", err);
      return [] as BenefitSetting[];
    } finally {
      setTimeout(() => {
        inFlightBenefitSettings = null;
      }, 1000);
    }
  })();
  return inFlightBenefitSettings;
}

export async function fetchUsers(): Promise<UserData[]> {
  try {
    const json = await apiFetch(
      "/items/user?limit=2000&fields=user_id,user_fname,user_lname,user_department,user_position,user_sss,user_philhealth,user_pagibig,user_tin,is_deleted,is_employee&filter[is_employee][_eq]=1"
    );
    if (json?.data && Array.isArray(json.data)) return json.data;
  } catch (err) {
    console.warn("fetchUsers with filter[is_employee] failed, trying fallback without filter:", err);
  }

  // Fallback 1: Query without filter[is_employee]
  try {
    const json = await apiFetch(
      "/items/user?limit=2000&fields=user_id,user_fname,user_lname,user_department,user_position,user_sss,user_philhealth,user_pagibig,user_tin,is_deleted"
    );
    if (json?.data && Array.isArray(json.data)) return json.data;
  } catch (err2) {
    console.warn("fetchUsers fallback 1 failed, trying fallback 2 with minimal fields:", err2);
  }

  // Fallback 2: Query with basic fields
  try {
    const json = await apiFetch("/items/user?limit=2000&fields=user_id,user_fname,user_lname,user_department,is_deleted");
    return (json?.data || []) as UserData[];
  } catch (err3) {
    console.warn("fetchUsers all fallbacks failed, falling back to empty list:", err3);
    return [];
  }
}

let inFlightDepartments: Promise<Department[]> | null = null;
export async function fetchDepartments(): Promise<Department[]> {
  if (inFlightDepartments) return inFlightDepartments;
  inFlightDepartments = (async () => {
    try {
      const json = await apiFetch("/items/department?limit=200&fields=department_id,department_name,is_delete&sort=department_name&filter[is_delete][_neq]=1")
        .catch(() => apiFetch("/items/department?limit=200&fields=department_id,department_name,is_delete&sort=department_name"));
      const list = (json?.data || []) as Department[];
      return list.filter((d: any) => {
        const del = d.is_delete ?? d.is_deleted;
        return !(del === 1 || del === true || del === "1" || del?.data?.[0] === 1);
      });
    } catch (err) {
      console.warn("fetchDepartments failed, falling back to empty list:", err);
      return [] as Department[];
    } finally {
      setTimeout(() => {
        inFlightDepartments = null;
      }, 1000);
    }
  })();
  return inFlightDepartments;
}

export async function saveBenefitSetting(setting: BenefitSetting) {
  const payload = {
    benefit_code: setting.benefit_code,
    benefit_name: setting.benefit_name,
    cutoff: setting.cutoff,
    is_active: 1,
    effective_from: setting.effective_from,
    effective_to: setting.effective_to,
    updated_by: setting.updated_by ?? null,
  };

  const method = setting.id ? "PATCH" : "POST";
  const path = setting.id
    ? `/items/benefit_cutoff_settings/${setting.id}`
    : "/items/benefit_cutoff_settings";

  return apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, payload }),
  });
}

// --------------------
// Cutoff settings (for loan schedule display)
// --------------------
let inFlightCutoffs: Promise<CutoffSetting[]> | null = null;
export async function fetchCutoffSettings(): Promise<CutoffSetting[]> {
  if (inFlightCutoffs) return inFlightCutoffs;
  inFlightCutoffs = (async () => {
    try {
      const json = await apiFetch(
        "/items/cutoff_settings?limit=500&sort=start_date&fields=id,cutoff_type,start_date,end_date,period_status"
      );
      return (json?.data || []) as CutoffSetting[];
    } catch (err) {
      console.warn("fetchCutoffSettings failed, falling back to empty list:", err);
      return [] as CutoffSetting[];
    } finally {
      setTimeout(() => {
        inFlightCutoffs = null;
      }, 1000);
    }
  })();
  return inFlightCutoffs;
}

// --------------------
// Benefit Loans (NEW) - SSS & PAGIBIG only
// --------------------
export async function fetchBenefitLoans(): Promise<BenefitLoan[]> {
  try {
    const json = await apiFetch("/items/benefit_loans?limit=2000&sort=-created_date");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (json?.data || []) as any[];
    return rows.map((r) => ({
      ...r,
      principal_amount: toNum(r.principal_amount),
      interest_amount: toNum(r.interest_amount),
      total_payable: toNum(r.total_payable),
      amortization_amount: toNum(r.amortization_amount),
      terms_installments: toNum(r.terms_installments),
      paid_installments: toNum(r.paid_installments),
      remaining_balance: toNum(r.remaining_balance),
    })) as BenefitLoan[];
  } catch (err) {
    console.warn("fetchBenefitLoans failed, falling back to empty list:", err);
    return [];
  }
}

export function buildLoanPayload(input: Partial<BenefitLoan>) {
  // Enforce: PHILHEALTH not allowed for loans at UI/API layer
  const benefit_code = input.benefit_code as LoanBenefitCode;
  if (benefit_code !== "SSS" && benefit_code !== "PAGIBIG") {
    throw new Error("Loans are only allowed for SSS and PAGIBIG.");
  }

  const principal = toNum(input.principal_amount);
  const interest = toNum(input.interest_amount);
  const totalPayable = toNum(input.total_payable) || principal + interest;

  const remaining = toNum(input.remaining_balance) || totalPayable;

  return {
    user_id: input.user_id,
    benefit_code,
    loan_name: input.loan_name ?? null,
    reference_no: input.reference_no ?? null,

    principal_amount: principal,
    interest_amount: interest,
    total_payable: totalPayable,

    amortization_amount: toNum(input.amortization_amount),
    terms_installments: Math.max(1, Math.trunc(toNum(input.terms_installments) || 1)),

    deduct_on: (input.deduct_on ?? "BOTH") as DeductOn,
    start_cutoff_id: input.start_cutoff_id,

    paid_installments: Math.max(0, Math.trunc(toNum(input.paid_installments) || 0)),
    remaining_balance: remaining,
    last_paid_cutoff_id: input.last_paid_cutoff_id ?? null,

    status: input.status ?? "ACTIVE",
    remarks: input.remarks ?? null,

    created_by: input.created_by ?? null,
    updated_by: input.updated_by ?? null,
  };
}

export async function createBenefitLoan(input: Partial<BenefitLoan>) {
  const payload = buildLoanPayload(input);
  return apiFetch("/items/benefit_loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/items/benefit_loans", payload }),
  });
}

export async function updateBenefitLoan(loanId: number, input: Partial<BenefitLoan>) {
  const payload = buildLoanPayload(input);
  return apiFetch(`/items/benefit_loans/${loanId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/items/benefit_loans/${loanId}`, payload }),
  });
}


export async function deleteBenefitLoan(loanId: number) {
  // ✅ No need to send JSON body for DELETE
  return apiFetch(`/items/benefit_loans/${loanId}`, {
    method: "DELETE",
  });
}

// --------------------
// Benefit Logs (REFECTORED) - VIEW ONLY
// --------------------
export async function fetchBenefitLogs(): Promise<BenefitLogRow[]> {
  // 1. Fetch existing payroll_run_employee logs (System/Automated)
  const fields = [
    "id",
    "cutoff_id",
    "user_id.*",
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
    "created_at"
  ].join(",");

  const pathSystem = `/items/payroll_run_employee?limit=5000&filter[payroll_run_id][status][_eq]=POSTED&filter[on_hold][_neq]=1&sort=-created_at&fields=${fields}`;

  // 2. Fetch new benefit_logs (Manual/Adjustments)
  // We need user details to display name consistently
  const fieldsManual = [
    "*",
    "user_id.*", // Fetch related user data
    "cutoff_start",
    "cutoff_end",
    "cutoff_type",
    "payroll_run_id.cutoff_start",
    "payroll_run_id.cutoff_end",
    "payroll_run_id.cutoff_type"
  ].join(",");
  const pathManual = `/items/benefit_logs?limit=5000&sort=-created_date&fields=${fieldsManual}`;

  const [jsonSystem, jsonManual] = await Promise.all([
    apiFetch(pathSystem).catch(() => ({ data: [] })),
    apiFetch(pathManual).catch(() => ({ data: [] })),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowsSystem = (jsonSystem?.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowsManual = (jsonManual?.data || []) as any[];

  // 3. Merging Logic using Map
  // Key: `${cutoff_id}|${user_id}|${benefit_code}|${log_type}|${loan_id ?? 'null'}|${payroll_run_id}`
  const logMap = new Map<string, BenefitLogRow>();

  // Helper to generate key
  const getKey = (r: BenefitLogRow) => {
    return `${r.cutoff_id}|${r.user_id}|${r.benefit_code}|${r.log_type}|${r.loan_id ?? "null"}|${r.payroll_run_id || "null"}`;
  };

  // 2.a Build a 'has loan detail' lookup from Manual logs to suppress System summaries
  // Key: `${cutoff_id}|${user_id}|${benefit_code}|${payroll_run_id}`
  const hasLoanDetail = new Set<string>();
  for (const r of rowsManual) {
    if (r.log_type === "LOAN" && r.benefit_code) {
      const uId = r.user_id?.user_id || r.user_id;
      const pId = r.payroll_run_id || "null";
      hasLoanDetail.add(`${r.cutoff_id}|${uId}|${r.benefit_code}|${pId}`);
    }
  }

  // --- PROCESS SYSTEM LOGS (payroll_run_employee) ---
  for (const r of rowsSystem) {
    const user = r.user_id || {};
    const pr = r.payroll_run_id || {};
    const uId = r.user_id?.user_id || r.user_id;

    const common = {
      cutoff_id: r.cutoff_id,
      cutoff_start: r.cutoff_start || null,
      cutoff_end: r.cutoff_end || null,
      cutoff_type: r.cutoff_type || null,
      user_id: uId,
      employee_name: fullnameFromUser(user),
      payroll_run_id: r.payroll_run_id?.payroll_run_id || r.payroll_run_id,
      payroll_ref_no: pr.payroll_ref_no || "N/A",
      posted_at: pr.posted_at || null,
      created_date: r.created_at,
      note: null,
      source_amount: 0,
    };

    const pushToMap = (item: BenefitLogRow) => {
      const key = getKey(item);
      logMap.set(key, item);
    };

    // Contributions
    if (toNum(r.benefit_sss) > 0) {
      pushToMap({
        ...common,
        benefit_log_id: `CONTRI-SSS-${r.id}`,
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
        benefit_log_id: `CONTRI-PH-${r.id}`,
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
        benefit_log_id: `CONTRI-HDMF-${r.id}`,
        benefit_code: "PAGIBIG",
        benefit_name: "Pag-IBIG",
        log_type: "CONTRIBUTION",
        loan_id: null,
        deducted_amount: toNum(r.benefit_pagibig),
      });
    }

    // Loans (Note: System loans have loan_id = null usually.
    // If we have detailed loan logs manually (loan_id != null), suppress these summary rows.)

    // Check SSS Loan Detail
    const hasSssLoan = hasLoanDetail.has(`${r.cutoff_id}|${uId}|SSS|${r.payroll_run_id?.payroll_run_id || r.payroll_run_id || "null"}`);
    if (!hasSssLoan && toNum(r.benefit_loan_sss) > 0) {
      pushToMap({
        ...common,
        benefit_log_id: `LOAN-SSS-${r.id}`,
        benefit_code: "SSS",
        benefit_name: "SSS",
        log_type: "LOAN",
        loan_id: null,
        deducted_amount: toNum(r.benefit_loan_sss),
      });
    }

    // Check Pagibig Loan Detail
    const hasPagibigLoan = hasLoanDetail.has(`${r.cutoff_id}|${uId}|PAGIBIG|${r.payroll_run_id?.payroll_run_id || r.payroll_run_id || "null"}`);
    if (!hasPagibigLoan && toNum(r.benefit_loan_pagibig) > 0) {
      pushToMap({
        ...common,
        benefit_log_id: `LOAN-HDMF-${r.id}`,
        benefit_code: "PAGIBIG",
        benefit_name: "Pag-IBIG",
        log_type: "LOAN",
        loan_id: null,
        deducted_amount: toNum(r.benefit_loan_pagibig),
      });
    }
  }

  // --- PROCESS MANUAL LOGS (benefit_logs) ---
  for (const r of rowsManual) {
    const user = r.user_id || {};

    // Determine Payroll Ref No display
    // Priority: payroll_detail_id > payroll_run_id
    let refNo = "Manual";
    if (r.payroll_detail_id) {
      refNo = r.payroll_detail_id;
    } else if (r.payroll_run_id && Number(r.payroll_run_id) !== 0) {
      refNo = String(r.payroll_run_id);
    }

    const manualRow: BenefitLogRow = {
      benefit_log_id: r.benefit_log_id,
      benefit_code: r.benefit_code,
      benefit_name: r.benefit_code === "PAGIBIG" ? "Pag-IBIG" : r.benefit_code === "PHILHEALTH" ? "PhilHealth" : r.benefit_code,
      cutoff_id: r.cutoff_id,
      cutoff_start: r.cutoff_start || (typeof r.payroll_run_id === "object" && r.payroll_run_id !== null ? r.payroll_run_id?.cutoff_start : null),
      cutoff_end: r.cutoff_end || (typeof r.payroll_run_id === "object" && r.payroll_run_id !== null ? r.payroll_run_id?.cutoff_end : null),
      cutoff_type: r.cutoff_type || (typeof r.payroll_run_id === "object" && r.payroll_run_id !== null ? r.payroll_run_id?.cutoff_type : null),
      user_id: r.user_id?.user_id || r.user_id,
      employee_name: fullnameFromUser(user),

      log_type: r.log_type,
      loan_id: r.loan_id,

      source_amount: r.source_amount ? toNum(r.source_amount) : 0,
      deducted_amount: toNum(r.deducted_amount),

      payroll_run_id: typeof r.payroll_run_id === "object" ? r.payroll_run_id?.id : r.payroll_run_id,
      payroll_ref_no: refNo,

      note: r.note,
      created_date: r.created_date,
      posted_at: r.created_date,

      account_no: null // Will be populated in final pass
    };

    const key = getKey(manualRow);
    const existing = logMap.get(key);

    if (existing) {
      // MERGE LOGIC (User Request: "treat same data as one not add/total them")
      // The manual log takes precedence over the system log for the same key.

      // Overwrite amounts
      existing.deducted_amount = manualRow.deducted_amount;
      existing.source_amount = manualRow.source_amount;

      // Overwrite note if manual log has one
      if (manualRow.note) {
        existing.note = manualRow.note;
      }

      // If manual log has a specific payroll ref (from payroll_detail_id), use it
      if (manualRow.payroll_ref_no !== "Manual") {
        existing.payroll_ref_no = manualRow.payroll_ref_no;
      }

      // Preserve cutoff date ranges if manual log has them
      if (manualRow.cutoff_start && manualRow.cutoff_end) {
        existing.cutoff_start = manualRow.cutoff_start;
        existing.cutoff_end = manualRow.cutoff_end;
        existing.cutoff_type = manualRow.cutoff_type;
      }

      // We keep the 'existing' object in the map, effectively updating it in-place.
    } else {
      // INSERT NEW
      logMap.set(key, manualRow);
    }
  }

  // Convert Map to Array
  const logs = Array.from(logMap.values());

  // Final pass to set correct account_no based on benefit_code
  // We need to look up ANY row from system or manual that has the user details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMap = new Map<number | string, any>();

  // Populate user map from both sources
  rowsSystem.forEach(r => {
    const u = r.user_id;
    if (u && u.user_id) userMap.set(u.user_id, u);
  });
  rowsManual.forEach(r => {
    const u = r.user_id;
    if (u && u.user_id) userMap.set(u.user_id, u);
  });

  for (const log of logs) {
    const u = userMap.get(log.user_id) || {};

    if (log.benefit_code === "SSS") {
      log.account_no = u.user_sss || null;
    } else if (log.benefit_code === "PHILHEALTH") {
      log.account_no = u.user_philhealth || null;
    } else if (log.benefit_code === "PAGIBIG") {
      log.account_no = u.user_pagibig || null;
    }
  }

  // Sort by date descending (posted_at or created_date)
  logs.sort((a, b) => {
    const da = new Date(a.created_date || 0).getTime();
    const db = new Date(b.created_date || 0).getTime();
    return db - da; // Descending
  });

  return logs;
}

// --------------------
// Employee Benefits Coverage & Report
// --------------------

export function isUserDeleted(u: UserData): boolean {
  if (u.is_deleted === true || u.is_deleted === 1) return true;
  if (typeof u.is_deleted === "object" && u.is_deleted !== null) {
    const data = (u.is_deleted as { data?: number[] })?.data;
    if (Array.isArray(data) && data[0] === 1) return true;
  }
  return false;
}

export function isUserActiveEmployee(u: UserData): boolean {
  if (isUserDeleted(u)) return false;
  // If is_employee is explicitly 0, false, or "0", they are not an active employee
  if (u.is_employee === 0 || u.is_employee === false) return false;
  if (typeof u.is_employee === "object" && u.is_employee !== null) {
    const data = (u.is_employee as { data?: number[] })?.data;
    if (Array.isArray(data) && data[0] === 0) return false;
  }
  return true;
}

export function round2(x: number): number {
  const n0 = Number(x ?? 0);
  if (!Number.isFinite(n0)) return 0;
  return Math.round(n0 * 100) / 100;
}

export interface SimpleSalarySchedule {
  schedule_id: number;
  monthly_rate: number | string;
}

let inFlightSalarySchedules: Promise<SimpleSalarySchedule[]> | null = null;
export async function fetchSalarySchedules(): Promise<SimpleSalarySchedule[]> {
  if (inFlightSalarySchedules) return inFlightSalarySchedules;
  inFlightSalarySchedules = (async () => {
    try {
      const json = await apiFetch("/items/salary_schedules?limit=2000&fields=schedule_id,monthly_rate");
      return (json?.data || []) as SimpleSalarySchedule[];
    } catch {
      return [];
    } finally {
      setTimeout(() => {
        inFlightSalarySchedules = null;
      }, 1000);
    }
  })();
  return inFlightSalarySchedules;
}

export async function fetchUserWages(): Promise<UserWageRecord[]> {
  try {
    const json = await apiFetch(
      "/items/user_wage_management?limit=5000&fields=id,user_id,daily_wage,encrypted_daily_wage,monthly_rate,sss_contribution_monthly,philhealth_contribution_monthly,pagibig_contribution_monthly,working_days_per_month,schedule_id,cutoff_wage_date_update,updated_by,updated_date&sort=-id"
    );
    return (json?.data || []) as UserWageRecord[];
  } catch (err) {
    console.warn("fetchUserWages full query failed, trying fallback:", err);
    try {
      const json = await apiFetch(
        "/items/user_wage_management?limit=5000&fields=id,user_id,daily_wage,monthly_rate,sss_contribution_monthly,philhealth_contribution_monthly,pagibig_contribution_monthly&sort=-id"
      );
      return (json?.data || []) as UserWageRecord[];
    } catch {
      return [];
    }
  }
}

export function buildEmployeeBenefitCoverages(args: {
  users: UserData[];
  wages: UserWageRecord[];
  departments: Department[];
  loans: BenefitLoan[];
  salarySchedules?: SimpleSalarySchedule[];
  isGovernment?: boolean;
  includeInactive?: boolean;
}): EmployeeBenefitCoverage[] {
  const { users, wages, departments, loans, salarySchedules = [], isGovernment = false, includeInactive = false } = args;

  const deptMap = new Map<number, string>();
  for (const d of departments) {
    deptMap.set(d.department_id, d.department_name);
  }

  // Salary schedule map (schedule_id -> monthly_rate)
  const schedMap = new Map<number, number>();
  for (const s of salarySchedules) {
    const sid = toNum(s.schedule_id);
    const m = toNum(s.monthly_rate);
    if (sid > 0 && m > 0) {
      schedMap.set(sid, m);
    }
  }

  // Wage records mapped safely by normalized user_id
  const wageMap = new Map<number, UserWageRecord>();
  for (const w of wages) {
    const rawUid =
      typeof w.user_id === "object" && w.user_id !== null
        ? (w.user_id as { user_id?: unknown; id?: unknown }).user_id ?? (w.user_id as { user_id?: unknown; id?: unknown }).id
        : w.user_id;
    const uid = toNum(rawUid);
    if (uid > 0) {
      const existing = wageMap.get(uid);
      if (!existing) {
        wageMap.set(uid, w);
      } else {
        const existingHasRate =
          toNum(existing.monthly_rate) > 0 ||
          toNum(existing.monthly_wage) > 0 ||
          toNum(existing.daily_wage) > 0 ||
          toNum(existing.daily_rate) > 0 ||
          Boolean(existing.schedule_id);
        const currentHasRate =
          toNum(w.monthly_rate) > 0 ||
          toNum(w.monthly_wage) > 0 ||
          toNum(w.daily_wage) > 0 ||
          toNum(w.daily_rate) > 0 ||
          Boolean(w.schedule_id);

        if (!existingHasRate && currentHasRate) {
          wageMap.set(uid, w);
        } else if (toNum(w.id) > toNum(existing.id)) {
          wageMap.set(uid, w);
        }
      }
    }
  }

  // Active loans map by user_id
  const loansByUser = new Map<number, EmployeeActiveLoanSummary[]>();
  for (const l of loans) {
    if (l.status !== "ACTIVE") continue;
    const cur = loansByUser.get(l.user_id) || [];
    cur.push({
      loan_id: l.loan_id,
      benefit_code: l.benefit_code,
      loan_name: l.loan_name,
      reference_no: l.reference_no,
      principal_amount: toNum(l.principal_amount),
      amortization_amount: toNum(l.amortization_amount),
      remaining_balance: toNum(l.remaining_balance),
      deduct_on: l.deduct_on,
      status: l.status,
    });
    loansByUser.set(l.user_id, cur);
  }

  // Filter out inactive or deleted employees by default
  const targetUsers = includeInactive ? users : users.filter((u) => isUserActiveEmployee(u));

  const results: EmployeeBenefitCoverage[] = [];

  for (const u of targetUsers) {
    const uid = toNum(u.user_id);
    const w = wageMap.get(uid);

    let dailyWage = toNum(w?.daily_wage) || toNum(w?.daily_rate);
    const workingDays = toNum(w?.working_days_per_month) || 26;
    let monthlyRate = toNum(w?.monthly_rate) || toNum(w?.monthly_wage);

    // If linked to salary schedule, resolve the monthly rate from schedule
    if (w?.schedule_id) {
      const schedRate = schedMap.get(toNum(w.schedule_id));
      if (schedRate && schedRate > 0) {
        if (monthlyRate === 0) monthlyRate = schedRate;
        if (dailyWage === 0 && workingDays > 0) dailyWage = round2(schedRate / workingDays);
      }
    }

    // AUTOMATIC SYNC: Ensure monthlyRate is ALWAYS computed if dailyWage has a value (> 0)
    if (monthlyRate === 0 && dailyWage > 0) {
      monthlyRate = round2(dailyWage * workingDays);
    } else if (monthlyRate > 0 && dailyWage === 0 && workingDays > 0) {
      dailyWage = round2(monthlyRate / workingDays);
    }

    const rawSss = toNum(w?.sss_contribution_monthly);
    const rawPh = toNum(w?.philhealth_contribution_monthly);
    const rawPagibig = toNum(w?.pagibig_contribution_monthly);

    // Compute SSS / GSIS
    let sssPersonal = 0;
    let sssCounterpart = 0;
    let sssTotal = 0;

    if (isGovernment) {
      if (rawSss > 0) {
        sssPersonal = rawSss;
        sssCounterpart = round2((rawSss / 0.09) * 0.12);
        sssTotal = round2(sssPersonal + sssCounterpart);
      } else if (monthlyRate > 0) {
        const gsis = computeGsis(monthlyRate);
        sssPersonal = gsis.employeeShare;
        sssCounterpart = gsis.governmentShare;
        sssTotal = gsis.totalContribution;
      }
    } else {
      if (rawSss > 0) {
        sssPersonal = rawSss;
        // In PH private sector employer share is approx 2.11x employee share (9.5% ER vs 4.5% EE)
        sssCounterpart = round2(rawSss * (9.5 / 4.5));
        sssTotal = round2(sssPersonal + sssCounterpart);
      }
    }

    const sssDetail: EmployeeBenefitDetail = {
      enrolled: sssPersonal > 0 || Boolean(u.user_sss),
      account_no: u.user_sss || null,
      personal_share: sssPersonal,
      counterpart_share: sssCounterpart,
      total_contribution: sssTotal,
    };

    // Compute PhilHealth
    let phPersonal = 0;
    let phCounterpart = 0;
    let phTotal = 0;

    if (isGovernment) {
      if (rawPh > 0) {
        phPersonal = rawPh;
        phCounterpart = rawPh;
        phTotal = round2(rawPh * 2);
      } else if (monthlyRate > 0) {
        const ph = computePhilHealth(monthlyRate);
        phPersonal = ph.employeeShare;
        phCounterpart = ph.governmentShare;
        phTotal = ph.totalContribution;
      }
    } else {
      if (rawPh > 0) {
        phPersonal = rawPh;
        phCounterpart = rawPh;
        phTotal = round2(rawPh * 2);
      }
    }

    const phDetail: EmployeeBenefitDetail = {
      enrolled: phPersonal > 0 || Boolean(u.user_philhealth),
      account_no: u.user_philhealth || null,
      personal_share: phPersonal,
      counterpart_share: phCounterpart,
      total_contribution: phTotal,
    };

    // Compute Pag-IBIG
    let hdmfPersonal = 0;
    let hdmfCounterpart = 0;
    let hdmfTotal = 0;

    if (isGovernment) {
      if (rawPagibig > 0) {
        hdmfPersonal = rawPagibig;
        hdmfCounterpart = rawPagibig;
        hdmfTotal = round2(rawPagibig * 2);
      } else if (monthlyRate > 0) {
        const hdmf = computePagibig(monthlyRate);
        hdmfPersonal = hdmf.employeeShare;
        hdmfCounterpart = hdmf.governmentShare;
        hdmfTotal = hdmf.totalContribution;
      }
    } else {
      if (rawPagibig > 0) {
        hdmfPersonal = rawPagibig;
        hdmfCounterpart = rawPagibig;
        hdmfTotal = round2(rawPagibig * 2);
      }
    }

    const hdmfDetail: EmployeeBenefitDetail = {
      enrolled: hdmfPersonal > 0 || Boolean(u.user_pagibig),
      account_no: u.user_pagibig || null,
      personal_share: hdmfPersonal,
      counterpart_share: hdmfCounterpart,
      total_contribution: hdmfTotal,
    };

    // Active loans
    const userLoans = loansByUser.get(u.user_id) || [];
    const totalLoanAmortization = round2(
      userLoans.reduce((sum, x) => sum + x.amortization_amount, 0)
    );

    const totalPersonal = round2(sssPersonal + phPersonal + hdmfPersonal);
    const totalCounterpart = round2(sssCounterpart + phCounterpart + hdmfCounterpart);
    const grandTotal = round2(totalPersonal + totalCounterpart);

    const hasSssAmount = sssDetail.personal_share > 0;
    const hasPhAmount = phDetail.personal_share > 0;
    const hasPagibigAmount = hdmfDetail.personal_share > 0;
    const hasSssId = Boolean(u.user_sss);
    const hasPhId = Boolean(u.user_philhealth);
    const hasPagibigId = Boolean(u.user_pagibig);

    const hasSss = hasSssAmount || hasSssId;
    const hasPh = hasPhAmount || hasPhId;
    const hasPagibig = hasPagibigAmount || hasPagibigId;
    const hasLoans = userLoans.length > 0;
    const hasAny = hasSss || hasPh || hasPagibig || hasLoans;
    const hasAll = hasSssAmount && hasPhAmount && hasPagibigAmount;

    const deptName = u.user_department ? deptMap.get(u.user_department) || "Unassigned" : "Unassigned";

    results.push({
      user_id: u.user_id,
      employee_name: `${u.user_fname} ${u.user_lname}`.trim(),
      department_id: u.user_department ?? null,
      department_name: deptName,
      position: u.user_position || null,
      daily_wage: dailyWage,
      monthly_rate: monthlyRate,

      sss: sssDetail,
      philhealth: phDetail,
      pagibig: hdmfDetail,

      loans: userLoans,
      total_loan_amortization: totalLoanAmortization,

      total_personal_share: totalPersonal,
      total_counterpart_share: totalCounterpart,
      grand_total_monthly: grandTotal,

      has_any_benefit: hasAny,
      has_all_benefits: hasAll,
      has_sss: hasSss,
      has_philhealth: hasPh,
      has_pagibig: hasPagibig,
      has_loans: hasLoans,

      has_sss_amount: hasSssAmount,
      has_philhealth_amount: hasPhAmount,
      has_pagibig_amount: hasPagibigAmount,
      has_sss_id: hasSssId,
      has_philhealth_id: hasPhId,
      has_pagibig_id: hasPagibigId,

      is_active: isUserActiveEmployee(u),
      is_deleted: isUserDeleted(u),

      coverage_summary: hasAll ? "FULL" : hasAny ? "PARTIAL" : "NONE",
    });
  }

  // Sort alphabetically by employee name
  results.sort((a, b) => a.employee_name.localeCompare(b.employee_name));

  return results;
}

export async function fetchEmployeeBenefitCoverages(options?: {
  isGovernment?: boolean;
  includeInactive?: boolean;
}): Promise<EmployeeBenefitCoverage[]> {
  const [users, wages, departments, loans, salarySchedules] = await Promise.all([
    fetchUsers().catch(() => [] as UserData[]),
    fetchUserWages().catch(() => [] as UserWageRecord[]),
    fetchDepartments().catch(() => [] as Department[]),
    fetchBenefitLoans().catch(() => [] as BenefitLoan[]),
    fetchSalarySchedules().catch(() => [] as SimpleSalarySchedule[]),
  ]);

  return buildEmployeeBenefitCoverages({
    users,
    wages,
    departments,
    loans,
    salarySchedules,
    isGovernment: options?.isGovernment ?? false,
    includeInactive: options?.includeInactive ?? false,
  });
}

