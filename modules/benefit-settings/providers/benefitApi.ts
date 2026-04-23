

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
} from "../types";

const BASE_API = "/api/benefit";

export async function fetchCompanyConfig(): Promise<{ companyName: string }> {
  try {
    const res = await fetch(`${BASE_API}?path=config`);
    return res.ok ? await res.json() : { companyName: "MEN2 MARKETING CORPORATION" };
  } catch {
    return { companyName: "MEN2 MARKETING CORPORATION" };
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
export async function fetchBenefitSettings(): Promise<BenefitSetting[]> {
  const json = await apiFetch("/items/benefit_cutoff_settings?limit=200");
  return json.data || [];
}

export async function fetchUsers(): Promise<UserData[]> {
  const json = await apiFetch("/items/user?limit=2000&fields=user_id,user_fname,user_lname,user_department");
  return json.data || [];
}

export async function fetchDepartments(): Promise<Department[]> {
  const json = await apiFetch("/items/department?limit=200&fields=department_id,department_name&sort=department_name");
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    apiFetch(pathSystem),
    apiFetch(pathManual),
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
