// modules/benefit-settings/providers/benefitApi.ts
import type {
  BenefitSetting,
  UserData,
  BenefitLoan,
  BenefitLogRow,
  CutoffSetting,
  LoanBenefitCode,
  DeductOn,
} from "../types";

const BASE_API = "/api/benefit";


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
  const sched = computeLoanCutoffSchedule({ loan: args.loan as any, cutoffs: args.cutoffs });
  return sched.upcoming.some((c) => c.id === args.cutoffId);
}

// --------------------
// Benefit settings (existing)
// --------------------
export async function fetchBenefitSettings(): Promise<BenefitSetting[]> {
  const json = await apiFetch("/items/benefit_cutoff_settings?limit=200");
  return json.data || [];
}

export async function fetchUsers(): Promise<UserData[]> {
  const json = await apiFetch("/items/user?limit=2000&fields=user_id,user_fname,user_lname");
  return json.data || [];
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
export async function fetchCutoffSettings(): Promise<CutoffSetting[]> {
  const json = await apiFetch(
    "/items/cutoff_settings?limit=500&sort=start_date&fields=id,cutoff_type,start_date,end_date,period_status"
  );
  return json.data || [];
}

// --------------------
// Benefit Loans (NEW) - SSS & PAGIBIG only
// --------------------
export async function fetchBenefitLoans(): Promise<BenefitLoan[]> {
  const json = await apiFetch("/items/benefit_loans?limit=2000&sort=-created_date");
  const rows = (json.data || []) as any[];
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
  const fields = [
    "id",
    "cutoff_id",
    "user_id.*",
    "benefit_sss",
    "benefit_philhealth",
    "benefit_pagibig",
    "benefit_loan_sss",
    "benefit_loan_pagibig",
    "payroll_run_id.payroll_ref_no",
    "payroll_run_id.posted_at",
    "created_at"
  ].join(",");

  const path = `/items/payroll_run_employee?limit=5000&filter[payroll_run_id][status][_eq]=POSTED&sort=-created_at&fields=${fields}`;
  const json = await apiFetch(path);
  const rows = (json.data || []) as any[];

  const logs: BenefitLogRow[] = [];

  for (const r of rows) {
    const user = r.user_id || {};
    const pr = r.payroll_run_id || {};

    const common = {
      cutoff_id: r.cutoff_id,
      user_id: r.user_id?.user_id || r.user_id,
      employee_name: fullnameFromUser(user),
      payroll_run_id: r.payroll_run_id?.payroll_run_id || r.payroll_run_id,
      payroll_ref_no: pr.payroll_ref_no || "N/A",
      posted_at: pr.posted_at || null,
      created_date: r.created_at,
      note: null,
    };

    // Contributions
    if (toNum(r.benefit_sss) > 0) {
      logs.push({
        ...common,
        benefit_log_id: `CONTRI-SSS-${r.id}`,
        benefit_code: "SSS",
        benefit_name: "SSS",
        log_type: "CONTRIBUTION",
        loan_id: null,
        source_amount: 0, // Not explicitly in payroll_run_employee as separate source for contri
        deducted_amount: toNum(r.benefit_sss),
      });
    }
    if (toNum(r.benefit_philhealth) > 0) {
      logs.push({
        ...common,
        benefit_log_id: `CONTRI-PH-${r.id}`,
        benefit_code: "PHILHEALTH",
        benefit_name: "PhilHealth",
        log_type: "CONTRIBUTION",
        loan_id: null,
        source_amount: 0,
        deducted_amount: toNum(r.benefit_philhealth),
      });
    }

    if (toNum(r.benefit_pagibig) > 0) {
      logs.push({
        ...common,
        benefit_log_id: `CONTRI-HDMF-${r.id}`,
        benefit_code: "PAGIBIG",
        benefit_name: "Pag-IBIG",
        log_type: "CONTRIBUTION",
        loan_id: null,
        source_amount: 0,
        deducted_amount: toNum(r.benefit_pagibig),
      });
    }

    // Loans
    if (toNum(r.benefit_loan_sss) > 0) {
      logs.push({
        ...common,
        benefit_log_id: `LOAN-SSS-${r.id}`,
        benefit_code: "SSS",
        benefit_name: "SSS",
        log_type: "LOAN",
        loan_id: null,
        source_amount: 0,
        deducted_amount: toNum(r.benefit_loan_sss),
      });
    }
    if (toNum(r.benefit_loan_pagibig) > 0) {
      logs.push({
        ...common,
        benefit_log_id: `LOAN-HDMF-${r.id}`,
        benefit_code: "PAGIBIG",
        benefit_name: "Pag-IBIG",
        log_type: "LOAN",
        loan_id: null,
        source_amount: 0,
        deducted_amount: toNum(r.benefit_loan_pagibig),
      });
    }
  }

  // Final pass to set correct account_no based on benefit_code
  for (const log of logs) {
    const rawRow = rows.find(r => (r.user_id?.user_id || r.user_id) === log.user_id);
    const u = rawRow?.user_id || {};

    if (log.benefit_code === "SSS") {
      log.account_no = u.user_sss || null;
    } else if (log.benefit_code === "PHILHEALTH") {
      log.account_no = u.user_philhealth || null;
    } else if (log.benefit_code === "PAGIBIG") {
      log.account_no = u.user_pagibig || null;
    }
  }

  return logs;
}
