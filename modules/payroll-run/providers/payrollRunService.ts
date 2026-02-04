// modules/payroll-run/providers/payrollRunService.ts
"use client";

import type {
  BenefitCode,
  BenefitCutoffSetting,
  CoopSavingsMembershipRow,
  CutoffSetting,
  Department,
  EmployeeAllowance,
  EmployeeLoan,
  HolidayRow,
  ManualEntry,
  ManualEntryType,
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollSummary,
  PayrollWorkspace,
  RetroPayRow,
  UserRow,
  WageProfile,
  WageProrationLog,
} from "../types";

import { computeEmployeeLine } from "../utils/compute";
import * as api from "./payrollApi";

export const RES = {
  payrollRun: "payroll_run",
  payrollLines: "payroll_run_employee",

  // ✅ Option A normalized line items
  payrollLineItems: "payroll_run_employee_item",

  cutoffs: "cutoff_settings",
  departments: "department",
  users: "user",
  wages: "user_wage_management",
  attendance: "attendance_approval",
  holidays: "holiday_calendar",

  otherAdds: "payroll_other_additions",
  otherDeds: "payroll_other_deductions",

  benefitSettings: "benefit_cutoff_settings",
  employeeLoans: "employee_loan",
  benefitLoans: "benefit_loans",

  allowances: "employee_allowance",

  // ✅ Option B tables
  retro_pay: "retro_pay",
  coop_savings: "coop_savings_membership",

  // ✅ Wage proration logs
  wageProration: "user_wage_proration_log",

  // ✅ DR payments fetched as system deductions
  drPayments: "dr_payment",
} as const;

// ------------------------------
// helpers
// ------------------------------
function bitToNum(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v ? 1 : 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes") return 1;
    return 0;
  }
  if (typeof v === "object") {
    const maybe = v as any;
    if (maybe?.type === "Buffer" && Array.isArray(maybe?.data)) {
      return maybe.data?.[0] ? 1 : 0;
    }
  }
  return 0;
}

function n(v: any): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function s(v: any): string {
  return String(v ?? "");
}

function round2(x: number): number {
  const n0 = Number(x ?? 0);
  if (!Number.isFinite(n0)) return 0;
  return Math.round(n0 * 100) / 100;
}

function arr<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function normalizeJsonOrNull(v: any): any | null {
  if (v === null || v === undefined) return null;

  if (typeof v === "object") {
    if (Array.isArray(v)) return v.length ? v : null;
    const keys = Object.keys(v);
    return keys.length ? v : null;
  }

  if (typeof v === "string") {
    const s0 = v.trim();
    if (!s0) return null;
    try {
      const parsed = JSON.parse(s0);
      return normalizeJsonOrNull(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

function isRecordNotUnique(err: any): boolean {
  const code =
    err?.errors?.[0]?.extensions?.code ??
    err?.extensions?.code ??
    err?.code ??
    null;

  if (code === "RECORD_NOT_UNIQUE") return true;

  const msg = String(err?.errors?.[0]?.message ?? err?.message ?? "").toUpperCase();

  return (
    msg.includes("RECORD_NOT_UNIQUE") ||
    msg.includes("HAS TO BE UNIQUE") ||
    msg.includes("DUPLICATE")
  );
}

async function safeList<T>(
  resource: string,
  params: Record<string, any>,
  fallback: T[] = [],
): Promise<T[]> {
  try {
    return await api.listItems<T>(resource, params);
  } catch (e) {
    console.warn(`[payrollRunService] listItems failed for ${resource} - payrollRunService.ts:151`, e);
    return fallback;
  }
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 8,
): Promise<T[]> {
  const limit = Math.max(1, Math.floor(concurrency || 1));
  const results: T[] = [];
  let i = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= tasks.length) return;
      results[idx] = await tasks[idx]();
    }
  });

  await Promise.all(workers);
  return results;
}

function withRerunSuffix(base: string, attempt: number) {
  const clean = String(base ?? "").trim();
  const a = Math.max(1, Math.floor(attempt || 1));
  return clean ? `${clean}-R${a}` : `PR-R${a}`;
}

// ✅ helpers for unique payroll_ref_no (race-safe)
function yyyymmdd(d: string) {
  return String(d ?? "").slice(0, 10).replaceAll("-", "");
}
function toBase36Id(id: any): string {
  const s0 = String(id ?? "").trim();
  if (!s0) return "";
  try {
    if (/^\d+$/.test(s0)) return BigInt(s0).toString(36).toUpperCase();
  } catch { }
  const num = Number(s0);
  if (Number.isSafeInteger(num) && num > 0) return num.toString(36).toUpperCase();
  return s0.replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase();
}
function makeTempPayrollRefNo(args: { cutoffId: number; departmentId: number | null }) {
  const dep = args.departmentId == null ? "ALL" : String(args.departmentId);
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TMP-${args.cutoffId}-${dep}-${Date.now()}-${rnd}`.slice(0, 50);
}
function formatFinalPayrollRefNo(args: {
  cutoffStart: string;
  cutoffEnd: string;
  departmentId: number | null;
  payrollRunId: any;
  baseRef?: string | null;
}) {
  const dep = args.departmentId == null ? "ALL" : String(args.departmentId);
  const idTok = toBase36Id(args.payrollRunId) || String(args.payrollRunId ?? "").trim();

  let base = String(
    args.baseRef ??
    `PR-${dep}-${yyyymmdd(args.cutoffStart)}-${yyyymmdd(args.cutoffEnd)}`,
  )
    .trim()
    .replace(/\s+/g, "-");

  const room = Math.max(10, 50 - (idTok.length + 1));
  if (base.length > room) base = base.slice(0, room);

  return `${base}-${idTok}`;
}

// ------------------------------
// normalizers
// ------------------------------
function normalizeCutoff(row: any): CutoffSetting {
  return {
    id: n(row.id),
    cutoff_type: (row.cutoff_type ?? row.cutoffType) as any,
    start_date: s(row.start_date),
    end_date: s(row.end_date),
    payout_date: row.payout_date ?? null,
    status: row.status ?? null,
  };
}

function normalizeDepartment(row: any): Department {
  return {
    id: n(row.id ?? row.department_id),
    name: s(row.name ?? row.department_name),
    ...row,
  } as Department;
}

function normalizeUser(row: any): UserRow {
  return {
    id: n(row.id ?? row.user_id),
    first_name: row.first_name ?? row.user_fname ?? null,
    last_name: row.last_name ?? row.user_lname ?? null,
    department_id: row.department_id ?? row.user_department ?? null,
    position: row.position ?? row.user_position ?? null,
    is_deleted: bitToNum(row.is_deleted ?? row.isDeleted),
    ...row,
  } as UserRow;
}

function normalizeWage(row: any): WageProfile {
  const daily = n(row.daily_wage);
  const hourly = row.hourly_wage != null ? n(row.hourly_wage) : daily > 0 ? daily / 8 : 0;
  const monthly =
    row.monthly_wage != null ? n(row.monthly_wage) : daily > 0 ? daily * 26 : 0;

  return {
    id: n(row.id),
    user_id: n(row.user_id),
    daily_wage: daily,
    hourly_wage: hourly,
    monthly_wage: monthly,
    is_deleted: bitToNum(row.is_deleted ?? row.isDeleted),

    sss_employee: n(row.sss_employee ?? row.sss_contribution_monthly),
    philhealth_employee: n(row.philhealth_employee ?? row.philhealth_contribution_monthly),
    pagibig_employee: n(row.pagibig_employee ?? row.pagibig_contribution_monthly),

    ...row,
  } as WageProfile;
}

function normalizeRunHeader(row: any): PayrollRunHeader {
  return {
    payroll_run_id: n(row.payroll_run_id ?? row.id),
    cutoff_id: n(row.cutoff_id),
    cutoff_type: (row.cutoff_type ?? "FIRST") as any,
    cutoff_start: s(row.cutoff_start),
    cutoff_end: s(row.cutoff_end),
    department_id: row.department_id == null ? null : n(row.department_id),
    status: (row.status ?? "DRAFT") as any,
    payroll_ref_no: s(row.payroll_ref_no),
    headcount: n(row.headcount),
    total_gross: n(row.total_gross),
    total_deductions: n(row.total_deductions),
    total_net: n(row.total_net),
    variance_alert_count: n(row.variance_alert_count),
    remarks: row.remarks ?? null,
    created_by: n(row.created_by),
    created_at: s(row.created_at),
    processed_at: row.processed_at ?? null,
    posted_by: row.posted_by ?? null,
    posted_at: row.posted_at ?? null,
  };
}

function normalizeBenefitSetting(row: any): BenefitCutoffSetting {
  return {
    id: n(row.id),
    benefit_code: row.benefit_code as any,
    benefit_name: s(row.benefit_name),
    cutoff: row.cutoff as any,
    is_active: n(row.is_active ?? 0),
    effective_from: row.effective_from ? s(row.effective_from) : null,
    effective_to: row.effective_to ? s(row.effective_to) : null,
  };
}

function normalizeEmployeeLoan(row: any): EmployeeLoan {
  return {
    loan_id: n(row.loan_id ?? row.id),
    user_id: n(row.user_id),
    loan_type: row.loan_type as any,
    monthly_payment: n(row.monthly_payment),
    start_date: s(row.start_date),
    end_date: row.end_date ? s(row.end_date) : null,
    status: row.status as any,
  };
}

function normalizeAllowance(row: any): EmployeeAllowance {
  return {
    allowance_id: n(row.allowance_id ?? row.id),
    user_id: n(row.user_id),
    amount: n(row.amount),
    description: row.description ?? null,

    cutoff_start: row.cutoff_start ? s(row.cutoff_start) : null,
    cutoff_end: row.cutoff_end ? s(row.cutoff_end) : null,

    is_recurring: bitToNum(row.is_recurring),
    is_active: bitToNum(row.is_active),
    pay_cycle: (row.pay_cycle ?? "N/A") as any,

    start_date: row.start_date ? s(row.start_date) : null,
    end_date: row.end_date ? s(row.end_date) : null,

    is_processed: bitToNum(row.is_processed),
  };
}

// ✅ Wage proration normalization (effective-date driven)
function normalizeProrationLog(row: any): WageProrationLog {
  const effRaw =
    row?.effective_date ??
    row?.effectivity_date ??
    row?.effectiveDate ??
    row?.effectivityDate ??
    "";

  const eff = String(effRaw ?? "").trim();
  const effective_date = eff.length >= 10 ? eff.slice(0, 10) : eff;

  return {
    id: n(row?.id),
    user_id: n(row?.user_id),
    previous_daily_wage: n(
      row?.previous_daily_wage ??
      row?.previous_daily_rate ??
      row?.old_daily_wage ??
      row?.old_daily_rate,
    ),
    new_daily_wage: n(
      row?.new_daily_wage ?? row?.new_daily_rate ?? row?.daily_wage ?? row?.daily_rate,
    ),
    effective_date,
    created_at:
      row?.created_at != null
        ? String(row.created_at)
        : row?.date_created != null
          ? String(row.date_created)
          : null,
  };
}

/**
 * Manual category normalization
 */
function normalizeManualCategory(row: any): string | null {
  const raw =
    row?.category ??
    row?.deduction_type ??
    row?.entry_category ??
    row?.entryCategory ??
    row?.category_name ??
    null;

  const fromType = row?.type;
  const pick =
    raw ??
    (fromType &&
      !["EARNING", "DEDUCTION"].includes(String(fromType).toUpperCase())
      ? fromType
      : null);

  if (pick == null) return null;

  const v = String(pick).trim().toUpperCase();
  return v ? v : null;
}

// ------------------------------
// public API
// ------------------------------
export function isActiveByDeletedFlags(args: { user?: UserRow | null; wage?: WageProfile | null }): boolean {
  const uDel = bitToNum((args.user as any)?.is_deleted ?? (args.user as any)?.isDeleted);
  const wDel = bitToNum((args.wage as any)?.is_deleted ?? (args.wage as any)?.isDeleted);
  return !(uDel === 1 || wDel === 1);
}

export async function listCutoffs(): Promise<CutoffSetting[]> {
  const rows = await api.listItems<any>(RES.cutoffs, { sort: "-id", limit: 50 });
  return (rows ?? []).map(normalizeCutoff);
}

export async function listDepartments(): Promise<Department[]> {
  const rows = await api.listItems<any>(RES.departments, { sort: "department_name", limit: 200 });
  return (rows ?? []).map(normalizeDepartment);
}

export async function findExistingPostedRun(args: {
  cutoffId: number;
  departmentId: number | null;
}): Promise<PayrollRunHeader | null> {
  const { cutoffId, departmentId } = args;

  const rows = await api.listItems<any>(RES.payrollRun, {
    "filter[cutoff_id][_eq]": cutoffId,

    ...(departmentId == null
      ? { "filter[department_id][_null]": "true" }
      : { "filter[department_id][_eq]": departmentId }),

    "filter[status][_eq]": "POSTED",
    sort: "-payroll_run_id",
    limit: 1,
  });

  return rows?.[0] ? normalizeRunHeader(rows[0]) : null;
}

/**
 * Draft/Active run = DRAFT or PROCESSED
 * (PROCESSING is not in your payroll_run.status enum)
 */
export async function findExistingDraftRun(args: {
  cutoffId: number;
  departmentId: number | null;
}): Promise<PayrollRunHeader | null> {
  const { cutoffId, departmentId } = args;

  const rows = await api.listItems<any>(RES.payrollRun, {
    "filter[cutoff_id][_eq]": cutoffId,

    ...(departmentId == null
      ? { "filter[department_id][_null]": "true" }
      : { "filter[department_id][_eq]": departmentId }),

    // ✅ matches table enum
    "filter[status][_in]": "DRAFT,PROCESSED",
    sort: "-payroll_run_id",
    limit: 1,
  });

  return rows?.[0] ? normalizeRunHeader(rows[0]) : null;
}

// ✅ make it short + stable (prevents long department-name refs)
export function generatePayrollRefNo(args: { cutoff: CutoffSetting; department?: Department | null }) {
  const dep = args.department?.id != null ? String(args.department.id) : "ALL";
  return `PR-${dep}-${args.cutoff.start_date.replaceAll("-", "")}-${args.cutoff.end_date.replaceAll("-", "")}`;
}

async function postedRunHasOnHoldEmployees(payrollRunId: number): Promise<boolean> {
  const pid = n(payrollRunId);
  if (!pid) return false;

  const rows = await safeList<any>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": pid,
      "filter[on_hold][_eq]": 1,
      limit: 1,
      fields: "id",
    },
    [],
  );

  return (rows?.length ?? 0) > 0;
}

/**
 * Idempotent “get or create” for payroll_run
 * - returns existing DRAFT/PROCESSED run if present
 * - else creates with TEMP ref then patches to FINAL ref (id-suffixed)
 */
export async function createOrGetActiveRun(args: {
  cutoff: CutoffSetting;
  departmentId: number | null;
  createdBy: number;
  basePayrollRefNo?: string;
}): Promise<PayrollRunHeader> {
  const cutoffId = n(args.cutoff?.id);
  if (!cutoffId) throw new Error("Invalid cutoff.id");

  // 1) Prefer existing DRAFT/PROCESSED
  const existingDraft = await findExistingDraftRun({
    cutoffId,
    departmentId: args.departmentId,
  });
  if (existingDraft) return existingDraft;

  // 2) ✅ NEW: if there is a POSTED run BUT it still has on-hold employees,
  // reuse it as the active rerunnable run (DO NOT CREATE A NEW HEADER).
  const posted = await findExistingPostedRun({
    cutoffId,
    departmentId: args.departmentId,
  });
  if (posted) {
    const hasHold = await postedRunHasOnHoldEmployees(posted.payroll_run_id);
    if (hasHold) return posted;
  }

  // 3) else create a new DRAFT run
  const basePayload = {
    cutoff_id: cutoffId,
    cutoff_type: args.cutoff.cutoff_type,
    cutoff_start: args.cutoff.start_date,
    cutoff_end: args.cutoff.end_date,
    department_id: args.departmentId,
    status: "DRAFT",
    headcount: 0,
    total_gross: 0,
    total_deductions: 0,
    total_net: 0,
    variance_alert_count: 0,
    created_by: args.createdBy,
  };

  let created: any;
  try {
    created = await api.createItem<any>(RES.payrollRun, {
      ...basePayload,
      payroll_ref_no: makeTempPayrollRefNo({ cutoffId, departmentId: args.departmentId }),
    });
  } catch (e: any) {
    if (isRecordNotUnique(e)) {
      const again = await findExistingDraftRun({ cutoffId, departmentId: args.departmentId });
      if (again) return again;
    }
    throw e;
  }

  const payrollRunId = created?.payroll_run_id ?? created?.id;
  const pid = n(payrollRunId);
  if (!pid) throw new Error("Create payroll_run failed: missing payroll_run_id");

  const finalRef = formatFinalPayrollRefNo({
    cutoffStart: args.cutoff.start_date,
    cutoffEnd: args.cutoff.end_date,
    departmentId: args.departmentId,
    payrollRunId,
    baseRef: args.basePayrollRefNo ?? null,
  });

  try {
    await api.patchItem(RES.payrollRun, pid, { payroll_ref_no: finalRef });
  } catch (e: any) {
    if (isRecordNotUnique(e)) {
      const fallback = `${finalRef.slice(0, Math.max(1, 47))}-${Math.random()
        .toString(36)
        .slice(2, 4)
        .toUpperCase()}`;
      await api.patchItem(RES.payrollRun, pid, { payroll_ref_no: fallback });
    } else {
      throw e;
    }
  }

  const updated = await api.getItem<any>(RES.payrollRun, pid, {});
  return normalizeRunHeader(updated);
}

export async function createDraftRun(args: {
  cutoff: CutoffSetting;
  departmentId: number | null;
  createdBy: number;
  payrollRefNo: string;
}): Promise<PayrollRunHeader> {
  const posted = await findExistingPostedRun({
    cutoffId: args.cutoff.id,
    departmentId: args.departmentId,
  });

  if (posted) {
    const hasHold = await postedRunHasOnHoldEmployees(posted.payroll_run_id);

    // If POSTED and no holds → rerun blocked (same as before)
    if (!hasHold) {
      throw new Error(
        `Payroll already POSTED and no on-hold employees remain. Rerun blocked. (Ref: ${posted.payroll_ref_no || posted.payroll_run_id})`,
      );
    }

    // ✅ NEW: POSTED but has holds → reuse this SAME run (do not create new)
    return posted;
  }

  // No posted run → normal behavior (create/get DRAFT/PROCESSED)
  return await createOrGetActiveRun({
    cutoff: args.cutoff,
    departmentId: args.departmentId,
    createdBy: args.createdBy,
    basePayrollRefNo: args.payrollRefNo,
  });
}


// ------------------------------
// workspace load + compute
// ------------------------------
function dateLTE(a: string, b: string) {
  return a <= b;
}
function dateGTE(a: string, b: string) {
  return a >= b;
}
function overlapsRange(args: { from: string | null; to: string | null; start: string; end: string }) {
  const from = args.from ?? "0000-01-01";
  const to = args.to ?? "9999-12-31";
  return dateLTE(from, args.end) && dateGTE(to, args.start);
}

export async function loadWorkspace(args: {
  cutoff: CutoffSetting;
  departmentId: number | null;
}): Promise<PayrollWorkspace> {
  const { cutoff, departmentId } = args;

  const department =
    departmentId == null
      ? null
      : normalizeDepartment(await api.getItem<any>(RES.departments, departmentId, {}));

  const rawEmployees = await api.listItems<any>(RES.users, {
    ...(departmentId == null ? {} : { "filter[user_department][_eq]": departmentId }),
    limit: 5000,
  });

  const employees = (rawEmployees ?? []).map(normalizeUser);
  const userIds = employees.map((u) => u.id);

  const wagesArr = userIds.length
    ? (
      await api.listItems<any>(RES.wages, {
        "filter[user_id][_in]": userIds.join(","),
        limit: 5000,
      })
    ).map(normalizeWage)
    : [];

  const wages = new Map<number, WageProfile>();
  for (const w of wagesArr) wages.set(w.user_id, w);

  const attendanceArr = userIds.length
    ? await api.listItems<any>(RES.attendance, {
      "filter[employee_id][_in]": userIds.join(","),
      "filter[date_schedule][_between]": `${cutoff.start_date},${cutoff.end_date}`,
      "filter[status][_eq]": "approved",
      limit: 50000,
    })
    : [];

  const attendance = new Map<number, any[]>();
  for (const row of attendanceArr ?? []) {
    const empId = n(row.employee_id);
    if (!attendance.has(empId)) attendance.set(empId, []);
    attendance.get(empId)!.push({
      ...row,
      night_diff_minutes: row.night_diff_minutes ?? 0,
    });
  }

  const holidays = await safeList<HolidayRow>(RES.holidays, {
    "filter[holiday_date][_between]": `${cutoff.start_date},${cutoff.end_date}`,
    limit: 500,
  });

  // ✅ Wage proration logs (effective-date driven within cutoff window)
  const prorationRows = userIds.length
    ? await safeList<any>(RES.wageProration, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[effective_date][_lte]": cutoff.end_date,
      sort: "effective_date,created_at,id",
      limit: 20000,
    })
    : [];

  const wageProrationLogs = new Map<number, WageProrationLog[]>();
  for (const raw of prorationRows ?? []) {
    const r = normalizeProrationLog(raw);
    const uid = n(r.user_id);
    if (!uid || !r.effective_date) continue;
    if (!wageProrationLogs.has(uid)) wageProrationLogs.set(uid, []);
    wageProrationLogs.get(uid)!.push(r);
  }

  for (const [uid, rows] of wageProrationLogs.entries()) {
    rows.sort((a, b) => {
      if (a.effective_date !== b.effective_date)
        return a.effective_date < b.effective_date ? -1 : 1;
      const ca = String(a.created_at ?? "");
      const cb = String(b.created_at ?? "");
      if (ca !== cb) return ca < cb ? -1 : 1;
      return n(a.id) - n(b.id);
    });
    wageProrationLogs.set(uid, rows);
  }

  // Manual additions/deductions (per-cutoff overlap)
  const adds = userIds.length
    ? await safeList<any>(RES.otherAdds, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[cutoff_start][_lte]": cutoff.end_date,
      "filter[cutoff_end][_gte]": cutoff.start_date,
      limit: 20000,
    })
    : [];

  const deds = userIds.length
    ? await safeList<any>(RES.otherDeds, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[cutoff_start][_lte]": cutoff.end_date,
      "filter[cutoff_end][_gte]": cutoff.start_date,
      limit: 20000,
    })
    : [];

  // DR payments as system deductions (read-only)
  const drPays = userIds.length
    ? await safeList<any>(RES.drPayments, {
      "filter[employee_id][_in]": userIds.join(","),
      "filter[cutoff_from][_lte]": cutoff.end_date,
      "filter[cutoff_to][_gte]": cutoff.start_date,
      "filter[payment_method][_eq]": "PAYROLL_DEDUCTION",
      "filter[is_posted_to_payroll][_eq]": 0,
      limit: 20000,
    })
    : [];

  const manualEntries = new Map<number, ManualEntry[]>();
  function pushME(user_id: number, e: ManualEntry) {
    if (!manualEntries.has(user_id)) manualEntries.set(user_id, []);
    manualEntries.get(user_id)!.push(e);
  }

  for (const a of adds ?? []) {
    const entry = {
      id: n(a.id),
      cutoff_id: cutoff.id,
      user_id: n(a.user_id),
      type: "EARNING",
      desc: s(a.description ?? a.desc ?? "Manual Addition"),
      amount: n(a.amount),
      category: null,
    } as any as ManualEntry;
    pushME(n(a.user_id), entry);
  }

  for (const d of deds ?? []) {
    const entry = {
      id: n(d.id),
      cutoff_id: cutoff.id,
      user_id: n(d.user_id),
      type: "DEDUCTION",
      desc: s(d.description ?? d.desc ?? "Manual Deduction"),
      amount: n(d.amount),
      category: normalizeManualCategory(d),
    } as any as ManualEntry;
    pushME(n(d.user_id), entry);
  }

  for (const p of drPays ?? []) {
    const userId = n(p.employee_id);
    const drId = n(p.dr_payment_id ?? p.id);
    const drNo = s(p.delivery_receipt_number ?? "");
    const amt = n(p.amount_paid);

    if (!userId || !drId || amt <= 0) continue;

    const entry = {
      id: -Math.abs(drId),
      cutoff_id: cutoff.id,
      user_id: userId,
      type: "DEDUCTION",
      desc: `${drNo || `#${drId}`}`,
      amount: amt,
      category: "DR_PAYMENT",
    } as any as ManualEntry;

    pushME(userId, entry);
  }

  // ✅ Retro Pay (strict containment: retro_start >= cutoff_start AND retro_end <= cutoff_end)
  const retroArr = userIds.length
    ? await safeList<any>(RES.retro_pay, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[cutoff_start][_gte]": cutoff.start_date,
      "filter[cutoff_end][_lte]": cutoff.end_date,
      "filter[is_processed][_eq]": 0,
      limit: 20000,
    })
    : [];

  const retroPays = new Map<number, RetroPayRow[]>();
  for (const raw of retroArr ?? []) {
    const userId = n(raw.user_id);
    if (!userId) continue;

    const row: RetroPayRow = {
      retro_id: n(raw.retro_id ?? raw.id),
      user_id: userId,
      amount: n(raw.amount),
      description: raw.description ?? null,
      cutoff_start: s(raw.cutoff_start).slice(0, 10),
      cutoff_end: s(raw.cutoff_end).slice(0, 10),
      is_processed: bitToNum(raw.is_processed),
      created_by: raw.created_by ?? null,
      created_date: raw.created_date ?? raw.created_at ?? null,
      updated_by: raw.updated_by ?? null,
      updated_date: raw.updated_date ?? raw.updated_at ?? null,
      ...raw,
    };

    if (!retroPays.has(userId)) retroPays.set(userId, []);
    retroPays.get(userId)!.push(row);
  }

  // ✅ COOP Savings Membership (NO cutoff fields; uses start_date/end_date + monthly_amount)
  const coopArr = userIds.length
    ? await safeList<any>(RES.coop_savings, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[is_active][_eq]": 1,
      "filter[start_date][_lte]": cutoff.end_date,
      "filter[_or][0][end_date][_null]": "true",
      "filter[_or][1][end_date][_gte]": cutoff.start_date,
      limit: 20000,
    })
    : [];

  const coopSavingsMemberships = new Map<number, CoopSavingsMembershipRow[]>();
  for (const raw of coopArr ?? []) {
    const userId = n(raw.user_id);
    if (!userId) continue;

    const row: CoopSavingsMembershipRow = {
      id: n(raw.id),
      user_id: userId,
      membership_id: s(raw.membership_id),
      monthly_amount: n(raw.monthly_amount),
      total_collection: n(raw.total_collection),
      total_months: n(raw.total_months),
      start_date: s(raw.start_date).slice(0, 10),
      end_date: raw.end_date ? s(raw.end_date).slice(0, 10) : null,
      is_active: bitToNum(raw.is_active),
      created_by: raw.created_by ?? null,
      created_date: raw.created_date ?? raw.created_at ?? null,
      updated_by: raw.updated_by ?? null,
      updated_date: raw.updated_date ?? raw.updated_at ?? null,
      ...raw,
    };

    if (!coopSavingsMemberships.has(userId)) coopSavingsMemberships.set(userId, []);
    coopSavingsMemberships.get(userId)!.push(row);
  }

  const rawBenefitSettings = await safeList<any>(RES.benefitSettings, {
    "filter[is_active][_eq]": 1,
    limit: 50,
  });

  const benefitSettings = (rawBenefitSettings ?? [])
    .map(normalizeBenefitSetting)
    .filter((b) => b.is_active === 1);

  const codes: BenefitCode[] = ["SSS", "PHILHEALTH", "PAGIBIG"];

  const benefitMultipliers: Record<BenefitCode, number> = {
    SSS: 0,
    PHILHEALTH: 0,
    PAGIBIG: 0,
  };

  for (const code of codes) {
    const effectiveSetting = benefitSettings
      .filter((b) => b.benefit_code === code)
      .filter((b) =>
        overlapsRange({
          from: b.effective_from,
          to: b.effective_to,
          start: cutoff.start_date,
          end: cutoff.end_date,
        }),
      )[0];

    benefitMultipliers[code] =
      effectiveSetting && effectiveSetting.cutoff === cutoff.cutoff_type ? 1 : 0;
  }

  const rawLoans = userIds.length
    ? await safeList<any>(RES.employeeLoans, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[status][_eq]": "ACTIVE",
      limit: 5000,
    })
    : [];

  const employeeLoans = new Map<number, EmployeeLoan[]>();
  for (const r of rawLoans ?? []) {
    const loan = normalizeEmployeeLoan(r);
    const ok = overlapsRange({
      from: loan.start_date,
      to: loan.end_date,
      start: cutoff.start_date,
      end: cutoff.end_date,
    });
    if (!ok) continue;

    if (!employeeLoans.has(loan.user_id)) employeeLoans.set(loan.user_id, []);
    employeeLoans.get(loan.user_id)!.push(loan);
  }

  const rawBenefitLoans = userIds.length
    ? await safeList<any>(RES.benefitLoans, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[status][_eq]": "ACTIVE",
      "filter[remaining_balance][_gt]": 0,
      limit: 5000,
    })
    : [];

  const benefitLoans = new Map<number, any[]>();
  for (const r of rawBenefitLoans ?? []) {
    const userId = n(r.user_id);
    if (!benefitLoans.has(userId)) benefitLoans.set(userId, []);
    benefitLoans.get(userId)!.push(r);
  }

  const rawAllowances = userIds.length
    ? await safeList<any>(RES.allowances, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[is_active][_eq]": 1,
      limit: 20000,
    })
    : [];

  const allowances = new Map<number, EmployeeAllowance[]>();
  for (const r of rawAllowances ?? []) {
    const a = normalizeAllowance(r);
    if (a.is_active !== 1) continue;
    if (a.is_recurring !== 1 && (a.is_processed ?? 0) === 1) continue;

    const inCutoffWindow = (() => {
      if (a.cutoff_start && a.cutoff_end) {
        return overlapsRange({
          from: a.cutoff_start,
          to: a.cutoff_end,
          start: cutoff.start_date,
          end: cutoff.end_date,
        });
      }

      if (a.start_date || a.end_date) {
        return overlapsRange({
          from: a.start_date ?? null,
          to: a.end_date ?? null,
          start: cutoff.start_date,
          end: cutoff.end_date,
        });
      }

      return true;
    })();

    if (!inCutoffWindow) continue;

    if (!allowances.has(a.user_id)) allowances.set(a.user_id, []);
    allowances.get(a.user_id)!.push(a);
  }

  const activeEmployees = employees.filter((u) =>
    isActiveByDeletedFlags({ user: u, wage: wages.get(u.id) ?? null }),
  );

  return {
    cutoff,
    department,
    employees: activeEmployees,
    wages,
    attendance,
    holidays,
    manualEntries,

    // ✅ Option B tables in workspace
    retroPays,
    coopSavingsMemberships,

    benefitSettings,
    benefitMultipliers,
    employeeLoans,
    benefitLoans,

    allowances,

    wageProrationLogs,
  } as PayrollWorkspace;
}

export function computeRegister(args: {
  ws: PayrollWorkspace;
  holdMap: Map<number, boolean>;
  previousNetMap?: Map<number, number>;
}): { lines: PayrollComputedLine[]; summary: PayrollSummary } {
  const { ws, holdMap, previousNetMap } = args;

  const depName = ws.department?.name ?? null;

  const lines: PayrollComputedLine[] = [];
  let headcount = 0;
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let varianceAlerts = 0;

  for (const u of ws.employees) {
    const wage = ws.wages.get(u.id) ?? null;
    const att = ws.attendance.get(u.id) ?? [];
    const me = ws.manualEntries.get(u.id) ?? [];
    const loans = ws.employeeLoans.get(u.id) ?? [];
    const bLoans = ws.benefitLoans?.get(u.id) ?? [];
    const alw = ws.allowances?.get(u.id) ?? [];
    const prLogs = ws.wageProrationLogs?.get(u.id) ?? [];
    const onHold = Boolean(holdMap.get(u.id));

    const retro = ws.retroPays?.get(u.id) ?? [];
    const coop = ws.coopSavingsMemberships?.get(u.id) ?? [];

    const prevNet = previousNetMap?.get(u.id) ?? 0;

    const line = computeEmployeeLine({
      user: u,
      wage,
      attendance: att,
      holidays: ws.holidays,
      cutoffStart: ws.cutoff.start_date,
      cutoffEnd: ws.cutoff.end_date,
      manualEntries: me,
      departmentName: depName,
      previousNetPay: prevNet,
      onHold,

      benefitMultipliers: ws.benefitMultipliers,
      employeeLoans: loans,

      benefitLoans: bLoans,
      cutoffType: ws.cutoff.cutoff_type,
      cutoffId: ws.cutoff.id,

      allowances: alw,
      wageProrationLogs: prLogs,

      retroPays: retro,
      coopSavingsMemberships: coop,
    });

    lines.push(line);

    if (!onHold) {
      headcount += 1;
      totalGross += line.gross_pay;
      totalDeductions += line.total_deductions;
      totalNet += line.net_pay;
      if (line.variance_flag) varianceAlerts += 1;
    }
  }

  return {
    lines,
    summary: {
      headcount,
      total_gross: round2(totalGross),
      total_deductions: round2(totalDeductions),
      total_net: round2(totalNet),
      variance_alerts: varianceAlerts,
    },
  };
}

// --- On-hold helpers ---------------------------------------------------------
export function isEmployeeOnHold(user: UserRow): boolean {
  const u: any = user ?? {};
  return (
    bitToNum(
      u.on_hold ??
      u.is_on_hold ??
      u.isHold ??
      u.hold ??
      u.payroll_hold ??
      u.payroll_on_hold ??
      0,
    ) === 1
  );
}

export function isLineOnHold(line: PayrollComputedLine, holdMap?: Map<number, boolean>): boolean {
  const l: any = line ?? {};
  const userId =
    n(l.user_id ?? l.userId ?? l.employee_id ?? l.employeeId ?? l.id) || 0;

  const fromMap = holdMap ? Boolean(holdMap.get(userId)) : false;
  const fromLine = bitToNum(l.on_hold ?? l.onHold ?? l.hold ?? l.is_on_hold ?? 0) === 1;

  return fromMap || fromLine;
}

export function filterPayslipLines(
  lines: PayrollComputedLine[],
  holdMap?: Map<number, boolean>,
): PayrollComputedLine[] {
  return (Array.isArray(lines) ? lines : []).filter((ln) => !isLineOnHold(ln, holdMap));
}

function normalizeHoldMapForUsers(
  userIds: number[],
  src?: Map<number, boolean> | null,
): Map<number, boolean> {
  const out = new Map<number, boolean>();
  const m = src ?? new Map<number, boolean>();
  for (const id of userIds) out.set(id, Boolean(m.get(id)));
  return out;
}

function holdMapEquals(a: Map<number, boolean>, b: Map<number, boolean>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a.entries()) {
    if (Boolean(b.get(k)) !== Boolean(v)) return false;
  }
  return true;
}

async function loadPersistedHoldMap(payrollRunId: number): Promise<Map<number, boolean>> {
  const pid = n(payrollRunId);
  const map = new Map<number, boolean>();
  if (!pid) return map;

  const rows = await safeList<any>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": pid,
      limit: 50000,
      fields: "user_id,on_hold",
      sort: "user_id",
    },
    [],
  );

  for (const r of rows ?? []) {
    const uid = n(r?.user_id);
    if (!uid) continue;
    map.set(uid, bitToNum(r?.on_hold) === 1);
  }

  return map;
}

/**
 * Enforces on-hold behavior:
 * - Computes register normally, but provides payslipLines that exclude on-hold.
 * - If there is at least one on-hold employee AND the saved run is not aligned,
 *   it reruns persistence (saveLines + updateRunTotals).
 */
export async function enforceOnHoldEmployeesAndMaybeRerun(args: {
  payrollRun: PayrollRunHeader;
  ws: PayrollWorkspace;
  holdMap: Map<number, boolean>;
  previousNetMap?: Map<number, number>;
  persist?: boolean; // default true
}): Promise<{
  lines: PayrollComputedLine[];
  payslipLines: PayrollComputedLine[];
  summary: PayrollSummary;
  holdUserIds: number[];
  didRerun: boolean;
  rerunReason: string | null;
}> {
  const payrollRunId = n(args.payrollRun?.payroll_run_id ?? (args.payrollRun as any)?.id);
  if (!payrollRunId) throw new Error("Invalid payrollRunId.");

  const status = String(args.payrollRun?.status ?? "DRAFT").toUpperCase();

  const userIds = (args.ws.employees ?? []).map((u) => n(u.id)).filter((x) => x > 0);
  const desiredHold = normalizeHoldMapForUsers(userIds, args.holdMap);

  const computed = computeRegister({
    ws: args.ws,
    holdMap: desiredHold,
    previousNetMap: args.previousNetMap,
  });

  const payslipLines = filterPayslipLines(computed.lines, desiredHold);
  const holdUserIds = userIds.filter((id) => Boolean(desiredHold.get(id)));

  // Load persisted holds to determine whether a POSTED run is "unfinished"
  const persistedHold = await loadPersistedHoldMap(payrollRunId);
  const persistedHoldNormalized = normalizeHoldMapForUsers(userIds, persistedHold);
  const postedHadHolds = Array.from(persistedHoldNormalized.values()).some(Boolean);

  // ✅ POSTED runs are only rerunnable if they are "unfinished"
  if (status === "POSTED" && !postedHadHolds) {
    return {
      ...computed,
      payslipLines,
      holdUserIds,
      didRerun: false,
      rerunReason: "Run is POSTED and has no on-hold employees; rerun blocked.",
    };
  }

  const holdChanged = !holdMapEquals(desiredHold, persistedHoldNormalized);

  const totalsMismatch =
    n(args.payrollRun.headcount) !== n(computed.summary.headcount) ||
    Math.abs(n(args.payrollRun.total_gross) - n(computed.summary.total_gross)) > 0.005 ||
    Math.abs(n(args.payrollRun.total_deductions) - n(computed.summary.total_deductions)) > 0.005 ||
    Math.abs(n(args.payrollRun.total_net) - n(computed.summary.total_net)) > 0.005;

  const rerunNeeded = holdChanged || totalsMismatch;
  const persist = args.persist !== false;

  if (persist && rerunNeeded) {
    await saveLines({
      payrollRunId,
      cutoff: args.ws.cutoff,
      lines: computed.lines,

      // ✅ Important: if updating an already POSTED run, do not auto-delete old rows
      preserveExistingUsers: status === "POSTED",
    });

    await updateRunTotals({
      payrollRunId,
      summary: computed.summary,
    });

    return {
      ...computed,
      payslipLines,
      holdUserIds,
      didRerun: true,
      rerunReason: holdChanged
        ? status === "POSTED"
          ? "POSTED run (unfinished) updated: on-hold flags changed."
          : "On-hold flags changed."
        : status === "POSTED"
          ? "POSTED run (unfinished) updated: header totals/headcount mismatch."
          : "Header totals/headcount mismatch.",
    };
  }

  return {
    ...computed,
    payslipLines,
    holdUserIds,
    didRerun: false,
    rerunReason: rerunNeeded ? "persist=false (skipped persistence)" : null,
  };
}

// ✅ NEW: stamp DR payments as posted to payroll
export async function postDRPaymentsToPayroll(args: {
  cutoff: CutoffSetting;
  payrollRefNo: string;
  employeeIds: number[];
}): Promise<void> {
  const employeeIds = (args.employeeIds ?? []).filter((x) => Number.isFinite(x) && x > 0);
  if (!employeeIds.length) return;

  const rows = await safeList<any>(RES.drPayments, {
    "filter[employee_id][_in]": employeeIds.join(","),
    "filter[cutoff_from][_lte]": args.cutoff.end_date,
    "filter[cutoff_to][_gte]": args.cutoff.start_date,
    "filter[payment_method][_eq]": "PAYROLL_DEDUCTION",
    "filter[is_posted_to_payroll][_eq]": 0,
    limit: 20000,
  });

  if (!rows.length) return;

  await Promise.all(
    rows.map((r) => {
      const id = n(r.dr_payment_id ?? r.id);
      if (!id) return Promise.resolve();
      return api.patchItem(RES.drPayments, id, {
        is_posted_to_payroll: 1,
        payroll_ref_no: args.payrollRefNo,
      });
    }),
  );
}

// ------------------------------
// Manual Entries CRUD (Adjustments)
// ------------------------------
function resourceForManualType(type: ManualEntryType) {
  return type === "EARNING" ? RES.otherAdds : RES.otherDeds;
}

export async function createManualEntry(args: {
  cutoff: CutoffSetting;
  userId: number;
  type: ManualEntryType;
  desc: string;
  amount: number;
  category?: string | null;
  createdBy?: number | null;
}): Promise<ManualEntry> {
  const resource = resourceForManualType(args.type);

  const payload: Record<string, any> = {
    user_id: args.userId,
    amount: args.amount,
    description: args.desc,
    cutoff_start: args.cutoff.start_date,
    cutoff_end: args.cutoff.end_date,
    created_by: args.createdBy ?? null,
  };

  if (args.type === "DEDUCTION") {
    const tRaw = args.category == null ? "" : String(args.category);
    const t = tRaw.trim().toUpperCase();
    payload.type = t === "SHORTAGE" ? "SHORTAGE" : "MANUAL";
  }

  const created = await api.createItem<any>(resource, payload);

  return ({
    id: n(created?.id),
    cutoff_id: args.cutoff.id,
    user_id: args.userId,
    type: args.type,
    desc: s(created?.description ?? args.desc),
    amount: n(created?.amount ?? args.amount),
    category: args.type === "DEDUCTION" ? normalizeManualCategory(created) : null,
  } as any) as ManualEntry;
}

export async function updateManualEntry(args: {
  entryId: number;
  type: ManualEntryType;
  desc: string;
  amount: number;
  category?: string | null;
}): Promise<void> {
  const resource = resourceForManualType(args.type);

  const payload: Record<string, any> = {
    description: args.desc,
    amount: args.amount,
  };

  if (args.type === "DEDUCTION" && args.category !== undefined) {
    const tRaw = args.category == null ? "" : String(args.category);
    const t = tRaw.trim().toUpperCase();
    payload.type = t === "SHORTAGE" ? "SHORTAGE" : "MANUAL";
  }

  await api.patchItem(resource, args.entryId, payload);
}

export async function deleteManualEntry(args: {
  entryId: number;
  type: ManualEntryType;
}): Promise<void> {
  if (!Number.isFinite(args.entryId) || args.entryId <= 0) {
    throw new Error("Invalid entry id (cannot delete).");
  }

  const resource = resourceForManualType(args.type);
  await api.deleteItem(resource, args.entryId);
}

export async function createDRPaymentDeduction(args: {
  cutoff: CutoffSetting;
  userId: number;
  drNo: string;
  amount: number;
  paymentDate?: string | null;
  remarks?: string | null;
  createdBy?: number | null;
}): Promise<ManualEntry> {
  const payment_date =
    (args.paymentDate && String(args.paymentDate).trim()) ||
    (args.cutoff as any)?.payout_date ||
    args.cutoff.end_date;

  const payload: Record<string, any> = {
    employee_id: args.userId,
    delivery_receipt_number: String(args.drNo ?? "").trim(),
    cutoff_from: args.cutoff.start_date,
    cutoff_to: args.cutoff.end_date,
    payroll_ref_no: null,
    is_posted_to_payroll: 0,
    payment_date,
    amount_paid: Number(args.amount ?? 0),
    payment_method: "PAYROLL_DEDUCTION",
    remarks:
      args.remarks == null || String(args.remarks).trim() === ""
        ? null
        : String(args.remarks).trim(),
    created_by: args.createdBy ?? null,
  };

  const created = await api.createItem<any>(RES.drPayments, payload);

  const drId = n(created?.dr_payment_id ?? created?.id);
  const drNo = s(created?.delivery_receipt_number ?? payload.delivery_receipt_number);
  const amt = n(created?.amount_paid ?? payload.amount_paid);

  return ({
    id: -Math.abs(drId || Date.now()),
    cutoff_id: args.cutoff.id,
    user_id: args.userId,
    type: "DEDUCTION",
    desc: `${drNo || `#${drId || "NEW"}`}`,
    amount: amt,
    category: "DR_PAYMENT",
  } as any) as ManualEntry;
}

function drIdFromManualEntry(e: ManualEntry): number {
  const meta = (e as any)?.dr_payment_id ?? (e as any)?.source_id ?? null;
  const id = n(meta);
  if (id > 0) return id;

  const fallback = Math.abs(n((e as any)?.id));
  return fallback > 0 ? fallback : 0;
}

function stripDRPrefix(desc: string): string {
  const s0 = String(desc ?? "").trim();
  const m = /^DR\s*PAYMENT\s*:\s*(.+)$/i.exec(s0);
  return (m?.[1] ?? s0).trim();
}

export async function updateDRPayment(args: {
  entry: ManualEntry;
  desc: string;
  amount: number;
  remarks?: string | null;
}): Promise<void> {
  const id = drIdFromManualEntry(args.entry);
  if (!id) throw new Error("Invalid DR payment id.");

  const payload: Record<string, any> = {
    delivery_receipt_number: stripDRPrefix(args.desc),
    amount_paid: Number(args.amount ?? 0),
  };

  if (args.remarks !== undefined) {
    payload.remarks =
      args.remarks == null || String(args.remarks).trim() === ""
        ? null
        : String(args.remarks).trim();
  }

  await api.patchItem(RES.drPayments, id, payload);
}

export async function deleteDRPayment(args: { entry: ManualEntry }): Promise<void> {
  const id = drIdFromManualEntry(args.entry);
  if (!id) throw new Error("Invalid DR payment id.");
  await api.deleteItem(RES.drPayments, id);
}

// ✅ Compatibility exports (used by PayrollRunModule.tsx)
export async function updateDRPaymentDeduction(args: {
  drPaymentId: number;
  drReceiptNo: string;
  amount: number;
  remarks?: string | null;
}): Promise<void> {
  const entry = { id: -Math.abs(args.drPaymentId) } as any;
  await updateDRPayment({
    entry,
    desc: String(args.drReceiptNo ?? "").trim(),
    amount: Number(args.amount ?? 0),
    remarks: args.remarks,
  });
}

export async function deleteDRPaymentDeduction(args: { drPaymentId: number }): Promise<void> {
  const entry = { id: -Math.abs(args.drPaymentId) } as any;
  await deleteDRPayment({ entry });
}

// ------------------------------
// payroll_run_employee persistence
// ------------------------------
function buildPayrollRunEmployeePayload(args: {
  payrollRunId: number;
  cutoff: CutoffSetting;
  userId: number;
  line: PayrollComputedLine;
}): Record<string, any> {
  const l: any = args.line;

  const cutoffLabel =
    (args.cutoff.cutoff_type ? String(args.cutoff.cutoff_type) : "") +
    ` ${s(args.cutoff.start_date)}-${s(args.cutoff.end_date)}`;

  const onHold = bitToNum(l?.on_hold ?? l?.onHold ?? l?.hold ?? 0);

  const totalAdditions =
    n(l?.total_additions) ||
    round2(
      n(l?.allowance) +
      n(l?.manual_additions) +
      n(l?.ot_amount) +
      n(l?.holiday_pay) +
      n(l?.rest_day_amount) +
      n(l?.night_diff_amount) +
      n(l?.leave_amount) +
      n(l?.retro_pay),
    );

  const totalDeductions =
    n(l?.total_deductions) ||
    round2(
      n(l?.late_deduction) +
      n(l?.undertime_deduction) +
      n(l?.shortage_deduction) +
      n(l?.dr_deduction) +
      n(l?.manual_deductions) +
      n(l?.other_deductions) +
      n(l?.loan_total) +
      n(l?.benefit_loan_total) +
      n(l?.benefit_sss) +
      n(l?.benefit_philhealth) +
      n(l?.benefit_pagibig) +
      n(l?.coop_savings),
    );

  const grossPay = n(l?.gross_pay) || round2(n(l?.basic_pay) + totalAdditions);
  const netPay = n(l?.net_pay) || round2(grossPay - totalDeductions);

  const previousNet = n(l?.previous_net_pay ?? l?.previousNetPay ?? 0);
  const varianceAmount =
    n(l?.variance_amount) || round2(n(l?.variance_amount_ui) || (netPay - previousNet));

  const prorationJson = normalizeJsonOrNull(l?.proration_json ?? l?.prorationJson);
  const breakdownJson = normalizeJsonOrNull(l?.breakdown_json ?? l?.breakdownJson);

  const sssLoan = n(l?.benefit_sss_loan ?? l?.benefit_loan_sss ?? 0);
  const pagibigLoan = n(l?.benefit_pagibig_loan ?? l?.benefit_loan_pagibig ?? 0);

  return {
    payroll_run_id: args.payrollRunId,
    user_id: args.userId,

    employee_name: l?.employee_name ?? l?.employeeName ?? null,
    position: l?.position ?? null,
    department_name: l?.department_name ?? l?.departmentName ?? null,
    position_name: l?.position_name ?? l?.positionName ?? l?.position ?? null,
    department_name_snapshot:
      l?.department_name_snapshot ??
      l?.departmentSnapshot ??
      l?.department_name ??
      l?.departmentName ??
      null,

    cutoff_start: s(args.cutoff.start_date),
    cutoff_end: s(args.cutoff.end_date),
    cutoff_label: cutoffLabel.trim() || null,
    cutoff_type: args.cutoff.cutoff_type ?? null,
    cutoff_id: n(args.cutoff.id) || null,

    daily_rate: n(l?.daily_rate ?? l?.daily_wage ?? l?.dailyRate ?? 0),
    basic_daily_rate: n(
      l?.basic_daily_rate ?? l?.basicDailyRate ?? l?.daily_rate ?? l?.daily_wage ?? 0,
    ),
    hourly_rate: n(l?.hourly_rate ?? l?.hourly_wage ?? l?.hourlyRate ?? 0),
    monthly_rate: n(l?.monthly_rate ?? l?.monthly_wage ?? l?.monthlyRate ?? 0),

    total_days_worked: n(l?.total_days_worked ?? l?.days_worked ?? l?.daysWorked ?? 0),
    total_work_minutes: n(l?.total_work_minutes ?? l?.work_minutes ?? l?.workMinutes ?? 0),
    late_minutes: n(l?.late_minutes ?? 0),
    undertime_minutes: n(l?.undertime_minutes ?? 0),
    overtime_minutes: n(l?.overtime_minutes ?? 0),
    night_diff_minutes: n(l?.night_diff_minutes ?? 0),
    total_hours_worked: n(l?.total_hours_worked ?? l?.hours_worked ?? l?.hoursWorked ?? 0),

    basic_pay: n(l?.basic_pay ?? 0),
    ot_amount: n(l?.ot_amount ?? 0),
    leave_amount: n(l?.leave_amount ?? 0),
    retro_pay: n(l?.retro_pay ?? 0),
    retro_remarks: l?.retro_remarks ?? null,

    holiday: n(l?.holiday ?? l?.holiday_days ?? 0),
    holiday_pay: n(l?.holiday_pay ?? 0),
    holiday_days: n(l?.holiday_days ?? 0),
    rest_day_amount: n(l?.rest_day_amount ?? 0),
    night_diff_amount: n(l?.night_diff_amount ?? 0),

    allowance: n(l?.allowance ?? l?.allowance_total ?? 0),
    manual_additions: n(l?.manual_additions ?? l?.manual_adds ?? l?.manualAdds ?? 0),

    late_deduction: n(l?.late_deduction ?? 0),
    undertime_deduction: n(l?.undertime_deduction ?? 0),
    shortage_deduction: n(l?.shortage_deduction ?? 0),

    benefit_pagibig: n(l?.benefit_pagibig ?? l?.pagibig_employee ?? l?.pagibig ?? 0),
    benefit_philhealth: n(l?.benefit_philhealth ?? l?.philhealth_employee ?? l?.philhealth ?? 0),
    benefit_sss: n(l?.benefit_sss ?? l?.sss_employee ?? l?.sss ?? 0),

    loan_vale: n(l?.loan_vale ?? 0),
    loan_car: n(l?.loan_car ?? 0),
    loan_coop: n(l?.loan_coop ?? 0),
    loan_total: n(l?.loan_total ?? l?.loans_total ?? 0),

    benefit_sss_loan: sssLoan,
    benefit_loan_sss: sssLoan,
    benefit_pagibig_loan: pagibigLoan,
    benefit_loan_pagibig: pagibigLoan,
    benefit_loan_total: n(l?.benefit_loan_total ?? l?.benefit_loans_total ?? 0),

    coop_savings: n(l?.coop_savings ?? 0),
    coop_loan: n(l?.coop_loan ?? 0),

    dr_deduction: n(l?.dr_deduction ?? 0),
    other_deductions: n(l?.other_deductions ?? 0),
    manual_deductions: n(l?.manual_deductions ?? 0),

    total_additions: round2(totalAdditions),
    total_deductions: round2(totalDeductions),
    gross_pay: round2(grossPay),
    net_pay: round2(netPay),

    is_prorated: bitToNum(l?.is_prorated ?? l?.isProrated ?? 0),
    proration_json: prorationJson,
    breakdown_json: breakdownJson,

    previous_net_pay: round2(previousNet),
    variance_amount_ui: round2(n(l?.variance_amount_ui ?? varianceAmount)),
    variance_amount: round2(varianceAmount),
    variance_pct: n(l?.variance_pct ?? 0),
    variance_flag: bitToNum(l?.variance_flag ?? 0),

    on_hold: onHold,
  };
}

/**
 * ------------------------------
 * Option A: Normalize breakdown_json items into payroll_run_employee_item
 * ------------------------------
 */
type PayrollRunEmployeeItemPayload = {
  payroll_run_employee_id: number;
  payroll_run_id: number;
  user_id: number;
  cutoff_start: string;
  cutoff_end: string;

  item_key: string;
  item_type: "EARNING" | "DEDUCTION";
  category: string;

  code?: string | null;
  description?: string | null;
  amount: number;

  source_table?: string | null;
  source_id?: number | null;

  meta?: any | null;
};

function buildItemPayloadsFromBreakdown(args: {
  payrollRunEmployeeId: number;
  payrollRunId: number;
  userId: number;
  cutoff: CutoffSetting;
  breakdown: any | null;
}): PayrollRunEmployeeItemPayload[] {
  const b = args.breakdown ?? null;
  if (!b || typeof b !== "object") return [];

  const out: PayrollRunEmployeeItemPayload[] = [];
  const base = {
    payroll_run_employee_id: args.payrollRunEmployeeId,
    payroll_run_id: args.payrollRunId,
    user_id: args.userId,
    cutoff_start: s(args.cutoff.start_date),
    cutoff_end: s(args.cutoff.end_date),
  };

  const earnings = (b as any)?.earnings ?? {};
  const deductions = (b as any)?.deductions ?? {};

  // 1) Allowances
  for (const [idx, it] of arr<any>(earnings?.allowance_items).entries()) {
    const allowanceId = n(it?.allowance_id ?? it?.id);
    const key = allowanceId ? `ALW:${allowanceId}` : `ALW:IDX${idx + 1}`;

    const amount = round2(n(it?.amount_this_cutoff ?? it?.amount ?? it?.amount_full ?? 0));
    if (amount === 0) continue;

    out.push({
      ...base,
      item_key: key,
      item_type: "EARNING",
      category: "ALLOWANCE",
      code: it?.pay_cycle != null ? s(it.pay_cycle) : null,
      description: it?.description != null ? s(it.description) : "Allowance",
      amount,
      source_table: "employee_allowance",
      source_id: allowanceId > 0 ? allowanceId : null,
      meta: normalizeJsonOrNull({
        pay_cycle: it?.pay_cycle ?? null,
        is_recurring: it?.is_recurring ?? null,
        amount_full: it?.amount_full ?? null,
        amount_this_cutoff: it?.amount_this_cutoff ?? null,
        source: it?.source ?? null,
      }),
    });
  }

  // 2) Manual additions
  for (const [idx, it] of arr<any>(earnings?.manual_addition_items).entries()) {
    const itemKeyRaw = it?.item_key ?? it?.key ?? null;
    const sourceIdRaw = n(it?.source_id ?? it?.id ?? 0);
    const sourceId = sourceIdRaw > 0 ? sourceIdRaw : Math.abs(sourceIdRaw);

    const key = (itemKeyRaw && s(itemKeyRaw)) || (sourceId ? `MA:${sourceId}` : `MA:IDX${idx + 1}`);

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) continue;

    out.push({
      ...base,
      item_key: key,
      item_type: "EARNING",
      category: "MANUAL_ADDITION",
      code: it?.code != null ? s(it.code) : null,
      description: it?.description != null ? s(it.description) : "Manual Addition",
      amount,
      source_table: it?.source_table != null ? s(it.source_table) : "manual",
      source_id: sourceId > 0 ? sourceId : null,
      meta: normalizeJsonOrNull(it?.meta ?? null),
    });
  }

  // 2.1) Retro pay items
  for (const [idx, it] of arr<any>(earnings?.retro_items ?? earnings?.retro_pay_items).entries()) {
    const sourceIdRaw = n(it?.source_id ?? it?.retro_id ?? it?.id ?? 0);
    const sourceId = sourceIdRaw > 0 ? sourceIdRaw : Math.abs(sourceIdRaw);
    const key = sourceId ? `RP:${sourceId}` : `RP:IDX${idx + 1}`;

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) continue;

    const desc =
      (it?.description != null ? s(it.description) : "") ||
      (it?.label != null ? s(it.label) : "") ||
      "Retro Pay";

    out.push({
      ...base,
      item_key: key,
      item_type: "EARNING",
      category: "RETRO_PAY",
      code: null,
      description: desc,
      amount,
      source_table: "retro_pay",
      source_id: sourceId > 0 ? sourceId : null,
      meta: normalizeJsonOrNull(it?.meta ?? null),
    });
  }

  // 3) Employee loans
  for (const [idx, it] of arr<any>(deductions?.employee_loan_items).entries()) {
    const itemKeyRaw = it?.item_key ?? it?.key ?? null;
    const loanIdRaw = n(it?.loan_id ?? it?.source_id ?? it?.id ?? 0);
    const loanId = loanIdRaw > 0 ? loanIdRaw : Math.abs(loanIdRaw);

    const key = (itemKeyRaw && s(itemKeyRaw)) || (loanId ? `EL:${loanId}` : `EL:IDX${idx + 1}`);

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) continue;

    out.push({
      ...base,
      item_key: key,
      item_type: "DEDUCTION",
      category: "EMPLOYEE_LOAN",
      code: it?.code != null ? s(it.code) : null,
      description: it?.description != null ? s(it.description) : "Employee Loan",
      amount,
      source_table: it?.source_table != null ? s(it.source_table) : "employee_loan",
      source_id: loanId > 0 ? loanId : null,
      meta: normalizeJsonOrNull(it?.meta ?? null),
    });
  }

  // 4) Benefit loans
  const benefitLoanItems = arr<any>(deductions?.benefit_loans?.items);
  for (const [idx, it] of benefitLoanItems.entries()) {
    const loanIdRaw = n(it?.loan_id ?? it?.id ?? 0);
    const loanId = loanIdRaw > 0 ? loanIdRaw : Math.abs(loanIdRaw);
    const key = loanId ? `BL:${loanId}` : `BL:IDX${idx + 1}`;

    const amount = round2(n(it?.amount_this_cutoff ?? it?.amount ?? 0));
    if (amount === 0) continue;

    out.push({
      ...base,
      item_key: key,
      item_type: "DEDUCTION",
      category: "BENEFIT_LOAN",
      code: it?.benefit_code != null ? s(it.benefit_code) : null,
      description:
        it?.loan_name != null
          ? s(it.loan_name)
          : it?.benefit_code != null
            ? `Benefit Loan: ${s(it.benefit_code)}`
            : "Benefit Loan",
      amount,
      source_table: "benefit_loans",
      source_id: loanId > 0 ? loanId : null,
      meta: normalizeJsonOrNull({
        reference_no: it?.reference_no ?? null,
        amortization_amount: it?.amortization_amount ?? null,
        deduct_on: it?.deduct_on ?? null,
        amount_this_cutoff: it?.amount_this_cutoff ?? null,
      }),
    });
  }

  // 5) Manual deductions (ensure source_id NEVER negative)
  for (const [idx, it] of arr<any>(deductions?.manual_deduction_items).entries()) {
    const itemKeyRaw = it?.item_key ?? it?.key ?? null;

    const sourceIdRaw = n(it?.source_id ?? it?.id ?? 0);
    const absId = Math.abs(sourceIdRaw);
    const sourceId = absId > 0 ? absId : 0;

    const key = (itemKeyRaw && s(itemKeyRaw)) || (sourceId ? `MD:${sourceId}` : `MD:IDX${idx + 1}`);

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) continue;

    const cat =
      it?.category != null && String(it.category).trim()
        ? String(it.category).trim().toUpperCase()
        : "MANUAL_DEDUCTION";

    const isDR = cat === "DR_PAYMENT";
    const sourceTable =
      isDR ? "dr_payment" : it?.source_table != null ? s(it.source_table) : "manual";

    out.push({
      ...base,
      item_key: key,
      item_type: "DEDUCTION",
      category: cat,
      code: it?.code != null ? s(it.code) : null,
      description: it?.description != null ? s(it.description) : "Manual Deduction",
      amount,
      source_table: sourceTable,
      source_id: sourceId > 0 ? sourceId : null,
      meta: normalizeJsonOrNull(
        isDR ? { ...(it?.meta ?? null), original_source_id: sourceIdRaw } : it?.meta ?? null,
      ),
    });
  }

  // 5.1) COOP savings membership items
  for (const [idx, it] of arr<any>(deductions?.coop_savings_items).entries()) {
    const membershipId = it?.membership_id != null ? s(it.membership_id) : "";
    const sourceId = n(it?.source_id ?? it?.id ?? 0);
    const key = membershipId
      ? `CSM:${membershipId}`
      : sourceId
        ? `CSM:${sourceId}`
        : `CSM:IDX${idx + 1}`;

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) continue;

    out.push({
      ...base,
      item_key: key,
      item_type: "DEDUCTION",
      category: "COOP_SAVINGS_MEMBERSHIP",
      code: null,
      description: it?.label != null ? s(it.label) : "COOP Savings Membership",
      amount,
      source_table: "coop_savings_membership",
      source_id: Number.isFinite(sourceId) && sourceId > 0 ? sourceId : null,
      meta: normalizeJsonOrNull(it?.meta ?? null),
    });
  }

  const seen = new Set<string>();
  return out.filter((x) => {
    const k = String(x.item_key ?? "").trim();
    if (!k) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function deleteAllLineItemsForEmployee(args: { payrollRunEmployeeId: number }): Promise<void> {
  const preId = n(args.payrollRunEmployeeId);
  if (!preId) return;

  let rows: any[] = [];
  try {
    rows = await safeList<any>(
      RES.payrollLineItems,
      {
        "filter[payroll_run_employee_id][_eq]": preId,
        limit: 50000,
      },
      [],
    );
  } catch {
    return;
  }

  if (!rows.length) return;

  const tasks = rows.map((r) => async () => {
    const id = n(r?.id ?? r?.item_id);
    if (!id) return;
    await api.deleteItem(RES.payrollLineItems, id);
  });

  await runWithConcurrency(tasks, 10);
}

async function syncLineItemsForEmployee(args: {
  payrollRunEmployeeId: number;
  payrollRunId: number;
  userId: number;
  cutoff: CutoffSetting;
  breakdownJson: any | null;
}): Promise<void> {
  const preId = n(args.payrollRunEmployeeId);
  if (!preId) return;

  await deleteAllLineItemsForEmployee({ payrollRunEmployeeId: preId });

  const payloads = buildItemPayloadsFromBreakdown({
    payrollRunEmployeeId: preId,
    payrollRunId: n(args.payrollRunId),
    userId: n(args.userId),
    cutoff: args.cutoff,
    breakdown: args.breakdownJson,
  });

  if (!payloads.length) return;

  try {
    const tasks = payloads.map((p) => async () => {
      await api.createItem<any>(RES.payrollLineItems, p);
    });
    await runWithConcurrency(tasks, 10);
  } catch (e) {
    console.warn("[payrollRunService] syncLineItems failed - payrollRunService.ts:1989", e);
  }
}

export async function saveLines(args: {
  payrollRunId: number;
  cutoff: CutoffSetting;
  lines: PayrollComputedLine[];
  preserveExistingUsers?: boolean;
}): Promise<void> {
  const payrollRunId = n(args.payrollRunId);
  if (!payrollRunId) throw new Error("Invalid payrollRunId.");

  const preserveExistingUsers = args.preserveExistingUsers === true;

  const lines = Array.isArray(args.lines) ? args.lines : [];

  const existing = await safeList<any>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": payrollRunId,
      limit: 50000,
      sort: "user_id",
    },
    [],
  );

  const existingByUser = new Map<number, any>();
  for (const r of existing ?? []) {
    const uid = n(r?.user_id ?? r?.employee_id ?? r?.userId ?? r?.employeeId);
    if (!uid) continue;
    existingByUser.set(uid, r);
  }

  const keepUserIds = new Set<number>();
  const tasks: Array<() => Promise<void>> = [];

  for (const line of lines) {
    const userId =
      n((line as any)?.user_id) ||
      n((line as any)?.employee_id) ||
      n((line as any)?.userId) ||
      n((line as any)?.id);

    if (!userId) continue;

    keepUserIds.add(userId);

    const payload = buildPayrollRunEmployeePayload({
      payrollRunId,
      cutoff: args.cutoff,
      userId,
      line,
    });

    const ex = existingByUser.get(userId);

    if (ex) {
      const id = n(ex?.id);
      if (!id) {
        tasks.push(async () => {
          const created = await api.createItem<any>(RES.payrollLines, payload);
          const preId = n(created?.id ?? created?.payroll_run_employee_id);
          await syncLineItemsForEmployee({
            payrollRunEmployeeId: preId,
            payrollRunId,
            userId,
            cutoff: args.cutoff,
            breakdownJson: payload.breakdown_json ?? null,
          });
        });
      } else {
        tasks.push(async () => {
          await api.patchItem(RES.payrollLines, id, payload);
          await syncLineItemsForEmployee({
            payrollRunEmployeeId: id,
            payrollRunId,
            userId,
            cutoff: args.cutoff,
            breakdownJson: payload.breakdown_json ?? null,
          });
        });
      }
    } else {
      tasks.push(async () => {
        const created = await api.createItem<any>(RES.payrollLines, payload);
        const preId = n(created?.id ?? created?.payroll_run_employee_id);
        await syncLineItemsForEmployee({
          payrollRunEmployeeId: preId,
          payrollRunId,
          userId,
          cutoff: args.cutoff,
          breakdownJson: payload.breakdown_json ?? null,
        });
      });
    }
  }

  // ✅ Only delete removed users if NOT preserving (i.e., for non-POSTED updates)
  if (!preserveExistingUsers) {
    for (const r of existing ?? []) {
      const uid = n(r?.user_id ?? r?.employee_id ?? r?.userId ?? r?.employeeId);
      if (!uid) continue;
      if (keepUserIds.has(uid)) continue;

      const id = n(r?.id);
      if (!id) continue;

      tasks.push(async () => {
        await deleteAllLineItemsForEmployee({ payrollRunEmployeeId: id });
        await api.deleteItem(RES.payrollLines, id);
      });
    }
  }

  await runWithConcurrency(tasks, 6);
}

export async function postRun(args: { payrollRunId: number; postedBy: number }): Promise<void> {
  const pid = n(args.payrollRunId);
  if (!pid) return;

  // ✅ do not touch an already POSTED run (prevents repost side-effects)
  try {
    const cur = await api.getItem<any>(RES.payrollRun, pid, { fields: "payroll_run_id,status" });
    const st = String(cur?.status ?? "").toUpperCase();
    if (st === "POSTED") return;
  } catch {
    // if read fails, fall through and try patch (existing behavior)
  }

  await api.patchItem(RES.payrollRun, pid, {
    status: "POSTED",
    posted_by: args.postedBy,
    posted_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  });
}


// ✅ persist computed totals to payroll_run header
export async function updateRunTotals(args: {
  payrollRunId: number;
  summary?: PayrollSummary | null;

  headcount?: number;
  total_gross?: number;
  total_deductions?: number;
  total_net?: number;
  variance_alert_count?: number;

  totalNet?: number;
  activeHeadcount?: number;
  varianceAlerts?: number;
}): Promise<void> {
  const s0: any = args.summary ?? {};

  const headcount = n(args.headcount ?? s0.headcount ?? args.activeHeadcount ?? s0.activeHeadcount);
  const total_gross = n(args.total_gross ?? s0.total_gross ?? s0.totalGross ?? s0.gross);
  const total_deductions = n(
    args.total_deductions ?? s0.total_deductions ?? s0.totalDeductions ?? s0.deductions,
  );
  const total_net = n(args.total_net ?? s0.total_net ?? args.totalNet ?? s0.totalNet ?? s0.net);
  const variance_alert_count = n(
    args.variance_alert_count ?? s0.variance_alerts ?? args.varianceAlerts ?? s0.varianceAlerts,
  );

  await api.patchItem(RES.payrollRun, args.payrollRunId, {
    headcount,
    total_gross,
    total_deductions,
    total_net,
    variance_alert_count,
  });
}
