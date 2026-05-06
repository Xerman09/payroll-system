// modules/payroll-run/providers/payrollRunService.ts
"use client";

import type {
  AttendanceApproval,
  BenefitCode,
  BenefitCutoffSetting,
  BenefitLoanRow,
  CoopSavingsMembershipRow,
  CutoffSetting,
  Department,
  EmployeeAllowance,
  EmployeeLoan,
  HolidayRow,
  ManualEntry,
  ManualEntryType,
  PayrollBreakdownJson,
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollRunStatus,
  PayrollSummary,
  PayrollWorkspace,
  RetroPayRow,
  UserRow,
  WageProfile,
  WageProrationLog,
  CutoffType,
  AllowancePayCycle,
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

  // ✅ Benefit Logs
  benefitLogs: "benefit_logs",
} as const;

// ------------------------------
// helpers
// ------------------------------
function bitToNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v ? 1 : 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes") return 1;
    return 0;
  }
  if (typeof v === "object") {
    const maybe = v as Record<string, unknown>;
    if (maybe?.type === "Buffer" && Array.isArray(maybe?.data)) {
      const data = maybe.data as unknown[];
      return data?.[0] ? 1 : 0;
    }
  }
  return 0;
}

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function s(v: unknown): string {
  return String(v ?? "");
}

function round2(x: number): number {
  const n0 = Number(x ?? 0);
  if (!Number.isFinite(n0)) return 0;
  return Math.round(n0 * 100) / 100;
}

function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function normalizeJsonOrNull(v: unknown): unknown | null {
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
      const parsed = JSON.parse(s0) as unknown;
      return normalizeJsonOrNull(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

function isRecordNotUnique(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  const errors = e?.errors as Array<Record<string, unknown>> | undefined;
  const extensions = errors?.[0]?.extensions as Record<string, unknown> | undefined;

  const code =
    extensions?.code ??
    (e?.extensions as Record<string, unknown> | undefined)?.code ??
    e?.code ??
    null;

  if (code === "RECORD_NOT_UNIQUE") return true;

  const msg = String(errors?.[0]?.message ?? e?.message ?? "").toUpperCase();

  return (
    msg.includes("RECORD_NOT_UNIQUE") ||
    msg.includes("HAS TO BE UNIQUE") ||
    msg.includes("DUPLICATE")
  );
}

async function safeList<T>(
  resource: string,
  params: Record<string, unknown>,
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


// ✅ helpers for unique payroll_ref_no (race-safe)
function yyyymmdd(d: string) {
  return String(d ?? "").slice(0, 10).replace(/-/g, "");
}
function toBase36Id(id: unknown): string {
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
  payrollRunId: number | string;
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
function normalizeCutoff(row: unknown): CutoffSetting {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    id: n(r.id),
    cutoff_type: (r.cutoff_type ?? r.cutoffType) as CutoffType,
    start_date: s(r.start_date),
    end_date: s(r.end_date),
    payout_date: (r.payout_date as string) ?? null,
    status: (r.status as string) ?? null,
  };
}

function normalizeDepartment(row: unknown): Department {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    id: n(r.id ?? r.department_id),
    name: s(r.name ?? r.department_name),
  };
}

function normalizeUser(row: unknown): UserRow {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    id: n(r.id ?? r.user_id),
    first_name: (r.first_name as string) ?? (r.user_fname as string) ?? null,
    last_name: (r.last_name as string) ?? (r.user_lname as string) ?? null,
    department_id: (r.department_id as number) ?? (r.user_department as number) ?? null,
    position: (r.position as string) ?? (r.user_position as string) ?? null,
    is_deleted: bitToNum(r.is_deleted ?? r.isDeleted),
  };
}

function normalizeWage(row: unknown): WageProfile {
  const r = (row ?? {}) as Record<string, unknown>;
  const daily = n(r.daily_wage);
  const hourly = r.hourly_wage != null ? n(r.hourly_wage) : daily > 0 ? daily / 8 : 0;
  const monthly =
    r.monthly_wage != null ? n(r.monthly_wage) : daily > 0 ? daily * 26 : 0;

  return {
    id: n(r.id),
    user_id: n(r.user_id),
    daily_wage: daily,
    hourly_wage: hourly,
    monthly_wage: monthly,
    is_deleted: bitToNum(r.is_deleted ?? r.isDeleted),
    is_card: bitToNum(r.is_card ?? r.isCard),
    isCard: bitToNum(r.isCard ?? r.is_card),

    // ✅ paid_holiday: 1 = entitled to holiday pay; 0 = excluded
    paid_holiday: bitToNum(r.paid_holiday ?? r.paidHoliday),

    sss_employee: n(r.sss_employee ?? r.sss_contribution_monthly),
    philhealth_employee: n(r.philhealth_employee ?? r.philhealth_contribution_monthly),
    pagibig_employee: n(r.pagibig_employee ?? r.pagibig_contribution_monthly),
  };
}

function normalizeRunHeader(row: unknown): PayrollRunHeader {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    payroll_run_id: n(r.payroll_run_id ?? r.id),
    cutoff_id: n(r.cutoff_id),
    cutoff_type: (r.cutoff_type ?? "FIRST") as CutoffType,
    cutoff_start: s(r.cutoff_start),
    cutoff_end: s(r.cutoff_end),
    department_id: r.department_id == null ? null : n(r.department_id),
    status: (r.status ?? "DRAFT") as PayrollRunStatus,
    payroll_ref_no: s(r.payroll_ref_no),
    headcount: n(r.headcount),
    total_gross: n(r.total_gross),
    total_deductions: n(r.total_deductions),
    total_net: n(r.total_net),
    variance_alert_count: n(r.variance_alert_count),
    remarks: (r.remarks as string) ?? null,
    created_by: n(r.created_by),
    created_at: s(r.created_at),
    processed_at: (r.processed_at as string) ?? null,
    posted_by: (r.posted_by as number) ?? null,
    posted_at: (r.posted_at as string) ?? null,
  };
}

function normalizeBenefitSetting(row: unknown): BenefitCutoffSetting {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    id: n(r.id),
    benefit_code: (r.benefit_code as string) as BenefitCode,
    benefit_name: s(r.benefit_name),
    cutoff: (r.cutoff as string) as CutoffType,
    is_active: n(r.is_active ?? 0),
    effective_from: r.effective_from ? s(r.effective_from) : null,
    effective_to: r.effective_to ? s(r.effective_to) : null,
  };
}

function normalizeEmployeeLoan(row: unknown): EmployeeLoan {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    loan_id: n(r.loan_id ?? r.id),
    user_id: n(r.user_id),
    loan_type: s(r.loan_type),
    monthly_payment: n(r.monthly_payment),
    start_date: s(r.start_date),
    end_date: r.end_date ? s(r.end_date) : null,
    status: s(r.status),
  };
}

function normalizeAllowance(row: unknown): EmployeeAllowance {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    allowance_id: n(r.allowance_id ?? r.id),
    user_id: n(r.user_id),
    amount: n(r.amount),
    description: (r.description as string) ?? null,

    cutoff_start: r.cutoff_start ? s(r.cutoff_start) : null,
    cutoff_end: r.cutoff_end ? s(r.cutoff_end) : null,

    is_recurring: bitToNum(r.is_recurring),
    is_active: bitToNum(r.is_active),
    pay_cycle: (r.pay_cycle as AllowancePayCycle) ?? "N/A",

    start_date: r.start_date ? s(r.start_date) : null,
    end_date: r.end_date ? s(r.end_date) : null,

    is_processed: bitToNum(r.is_processed),
  };
}

// ✅ Wage proration normalization (effective-date driven)
function normalizeProrationLog(row: unknown): WageProrationLog {
  const r = row as Record<string, unknown>;
  const effRaw =
    r?.effective_date ??
    r?.effectivity_date ??
    r?.effectiveDate ??
    r?.effectivityDate ??
    "";

  const eff = String(effRaw ?? "").trim();
  const effective_date = eff.length >= 10 ? eff.slice(0, 10) : eff;

  return {
    id: n(r?.id),
    user_id: n(r?.user_id),
    previous_daily_wage: n(
      r?.previous_daily_wage ??
      r?.previous_daily_rate ??
      r?.old_daily_wage ??
      r?.old_daily_rate,
    ),
    new_daily_wage: n(
      r?.new_daily_wage ?? r?.new_daily_rate ?? r?.daily_wage ?? r?.daily_rate,
    ),
    effective_date,
    created_at:
      r?.created_at != null
        ? String(r.created_at)
        : r?.date_created != null
          ? String(r.date_created)
          : null,
  };
}

/**
 * Manual category normalization
 */
function normalizeManualCategory(row: unknown): string | null {
  const r = row as Record<string, unknown>;
  const raw =
    r?.category ??
    r?.deduction_type ??
    r?.entry_category ??
    r?.entryCategory ??
    r?.category_name ??
    null;

  const fromType = r?.type;
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
  const user = args.user as UserRow;
  const wage = args.wage as WageProfile;

  const uDel = bitToNum(user?.is_deleted);
  const wDel = bitToNum(wage?.is_deleted ?? wage?.isCard); // alias
  return !(uDel === 1 || wDel === 1);
}

export async function listCutoffs(): Promise<CutoffSetting[]> {
  const rows = await api.listItems<CutoffSetting>(RES.cutoffs, { sort: "-id", limit: 50 });
  return (rows ?? []).map(normalizeCutoff);
}

export async function listDepartments(): Promise<Department[]> {
  const rows = await api.listItems<Department>(RES.departments, { sort: "department_name", limit: 200 });
  return (rows ?? []).map(normalizeDepartment);
}

export async function findExistingPostedRun(args: {
  cutoffId: number;
  departmentId: number | null;
  cutoffStart?: string;
  cutoffEnd?: string;
}): Promise<PayrollRunHeader | null> {
  const { cutoffId, departmentId, cutoffStart, cutoffEnd } = args;

  const rows = await api.listItems<PayrollRunHeader>(RES.payrollRun, {
    "filter[cutoff_id][_eq]": cutoffId,

    ...(cutoffStart ? { "filter[cutoff_start][_eq]": cutoffStart } : {}),
    ...(cutoffEnd ? { "filter[cutoff_end][_eq]": cutoffEnd } : {}),

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
  cutoffStart?: string;
  cutoffEnd?: string;
}): Promise<PayrollRunHeader | null> {
  const { cutoffId, departmentId, cutoffStart, cutoffEnd } = args;

  const rows = await api.listItems<PayrollRunHeader>(RES.payrollRun, {
    "filter[cutoff_id][_eq]": cutoffId,

    ...(cutoffStart ? { "filter[cutoff_start][_eq]": cutoffStart } : {}),
    ...(cutoffEnd ? { "filter[cutoff_end][_eq]": cutoffEnd } : {}),

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
  return `PR-${dep}-${args.cutoff.start_date.replace(/-/g, "")}-${args.cutoff.end_date.replace(/-/g, "")}`;
}

async function postedRunHasOnHoldEmployees(payrollRunId: number): Promise<boolean> {
  const pid = n(payrollRunId);
  if (!pid) return false;

  const rows = await safeList<Record<string, unknown>>(
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
    cutoffStart: args.cutoff.start_date,
    cutoffEnd: args.cutoff.end_date,
  });
  if (existingDraft) return existingDraft;

  // 2) ✅ NEW: if there is a POSTED run BUT it still has on-hold employees,
  // reuse it as the active rerunnable run (DO NOT CREATE A NEW HEADER).
  const posted = await findExistingPostedRun({
    cutoffId,
    departmentId: args.departmentId,
    cutoffStart: args.cutoff.start_date,
    cutoffEnd: args.cutoff.end_date,
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

  let created: Record<string, unknown>;
  try {
    created = await api.createItem<Record<string, unknown>>(RES.payrollRun, {
      ...basePayload,
      payroll_ref_no: makeTempPayrollRefNo({ cutoffId, departmentId: args.departmentId }),
    });
  } catch (e: unknown) {
    if (isRecordNotUnique(e)) {
      const again = await findExistingDraftRun({ cutoffId, departmentId: args.departmentId });
      if (again) return again;
    }
    throw e;
  }

  const payrollRunId = n(created?.payroll_run_id ?? created?.id);
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
  } catch (e: unknown) {
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

  const updated = await api.getItem<Record<string, unknown>>(RES.payrollRun, pid, {});
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
    cutoffStart: args.cutoff.start_date,
    cutoffEnd: args.cutoff.end_date,
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
      : normalizeDepartment(await api.getItem<Record<string, unknown>>(RES.departments, departmentId, {}));

  const rawEmployees = await api.listItemsWithMeta<Record<string, unknown>>(RES.users, {
    ...(departmentId == null ? {} : { "filter[user_department][_eq]": departmentId }),
    limit: 5000,
  });

  const companyName = (rawEmployees.meta as Record<string, unknown> | undefined)?.companyName as string | undefined;

  const employees = (rawEmployees.data ?? []).map(normalizeUser);
  const userIds = employees.map((u) => u.id);

  const wagesArr = userIds.length
    ? (
      await api.listItems<Record<string, unknown>>(RES.wages, {
        "filter[user_id][_in]": userIds.join(","),
        limit: 5000,
      })
    ).map(normalizeWage)
    : [];

  const wages = new Map<number, WageProfile>();
  for (const w of wagesArr) wages.set(w.user_id, w);

  const holidays = await safeList<HolidayRow>(RES.holidays, {
    "filter[holiday_date][_between]": `${cutoff.start_date},${cutoff.end_date}`,
    limit: 500,
  });

  const lwdDates = new Set<string>();
  for (const h of holidays ?? []) {
    const rawLwd = h.last_working_day;
    const d = s(rawLwd).slice(0, 10);
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      lwdDates.add(d);
    }
  }

  const attendanceArr = userIds.length
    ? await api.listItems<AttendanceApproval>(RES.attendance, {
      "filter[employee_id][_in]": userIds.join(","),
      "filter[status][_eq]": "approved",
      limit: 50000,
      ...(lwdDates.size > 0
        ? {
          "filter[_or][0][date_schedule][_between]": `${cutoff.start_date},${cutoff.end_date}`,
          "filter[_or][1][date_schedule][_in]": Array.from(lwdDates).join(","),
        }
        : {
          "filter[date_schedule][_between]": `${cutoff.start_date},${cutoff.end_date}`,
        }),
    })
    : [];

  const attendance = new Map<number, AttendanceApproval[]>();
  for (const row of attendanceArr ?? []) {
    const r = row as AttendanceApproval;
    const empId = n(r.employee_id);
    if (!attendance.has(empId)) attendance.set(empId, []);
    attendance.get(empId)!.push({
      ...r,
      night_diff_minutes: n(r.night_diff_minutes),
    });
  }

  // ✅ Wage proration logs (effective-date driven within cutoff window)
  const prorationRows = userIds.length
    ? await safeList<Record<string, unknown>>(RES.wageProration, {
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

  wageProrationLogs.forEach((rows, uid) => {
    rows.sort((a, b) => {
      if (a.effective_date !== b.effective_date)
        return a.effective_date < b.effective_date ? -1 : 1;
      const ca = String(a.created_at ?? "");
      const cb = String(b.created_at ?? "");
      if (ca !== cb) return ca < cb ? -1 : 1;
      return n(a.id) - n(b.id);
    });
    wageProrationLogs.set(uid, rows);
  });

  // Manual additions/deductions (per-cutoff overlap)
  const adds = userIds.length
    ? await safeList<ManualEntry>(RES.otherAdds, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[cutoff_start][_lte]": cutoff.end_date,
      "filter[cutoff_end][_gte]": cutoff.start_date,
      limit: 20000,
    })
    : [];

  const deds = userIds.length
    ? await safeList<ManualEntry>(RES.otherDeds, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[cutoff_start][_lte]": cutoff.end_date,
      "filter[cutoff_end][_gte]": cutoff.start_date,
      limit: 20000,
    })
    : [];

  // DR payments as system deductions (read-only)
  const drPays = userIds.length
    ? await safeList<Record<string, unknown>>(RES.drPayments, {
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
    const aRow = a as Record<string, unknown>;
    const entry: ManualEntry = {
      id: n(aRow.id),
      cutoff_id: cutoff.id,
      user_id: n(aRow.user_id),
      type: "EARNING",
      desc: s(aRow.description ?? aRow.desc ?? "Manual Addition"),
      amount: n(aRow.amount),
      category: null,
    };
    pushME(n(aRow.user_id), entry);
  }

  for (const d of deds ?? []) {
    const dRow = d as Record<string, unknown>;
    const entry: ManualEntry = {
      id: n(dRow.id),
      cutoff_id: cutoff.id,
      user_id: n(dRow.user_id),
      type: "DEDUCTION",
      desc: s(dRow.description ?? dRow.desc ?? "Manual Deduction"),
      amount: n(dRow.amount),
      category: normalizeManualCategory(dRow as unknown),
    };
    pushME(n(dRow.user_id), entry);
  }

  for (const p of drPays ?? []) {
    const pRow = p as Record<string, unknown>;
    const userId = n(pRow.employee_id);
    const drId = n(pRow.dr_payment_id ?? pRow.id);
    const drNo = s(pRow.delivery_receipt_number ?? "");
    const amt = n(pRow.amount_paid);

    if (!userId || !drId || amt <= 0) continue;

    const entry: ManualEntry = {
      id: -Math.abs(drId),
      cutoff_id: cutoff.id,
      user_id: userId,
      type: "DEDUCTION",
      desc: `${drNo || `#${drId}`}`,
      amount: amt,
      category: "DR_PAYMENT",
    };

    pushME(userId, entry);
  }

  // ✅ Retro Pay (strict containment: retro_start >= cutoff_start AND retro_end <= cutoff_end)
  const retroArrRaw = userIds.length
    ? await safeList<Record<string, unknown>>(RES.retro_pay, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[cutoff_start][_gte]": cutoff.start_date,
      "filter[cutoff_end][_lte]": cutoff.end_date,
      "filter[is_processed][_eq]": 0,
      limit: 20000,
    })
    : [];

  const retroPays = new Map<number, RetroPayRow[]>();
  for (const raw of (retroArrRaw ?? []) as Record<string, unknown>[]) {
    const userId = n(raw.user_id);
    if (!userId) continue;

    const row: RetroPayRow = {
      retro_id: n(raw.retro_id ?? raw.id),
      user_id: userId,
      amount: n(raw.amount),
      description: (raw.description as string) ?? null,
      cutoff_start: s(raw.cutoff_start).slice(0, 10),
      cutoff_end: s(raw.cutoff_end).slice(0, 10),
      is_processed: bitToNum(raw.is_processed),
      created_by: (raw.created_by as number) ?? null,
      created_date: s(raw.created_date ?? raw.created_at ?? raw.date_created ?? ""),
      updated_by: (raw.updated_by as number) ?? null,
      updated_date: s(raw.updated_date ?? raw.updated_at ?? raw.date_updated ?? ""),
    };

    if (!retroPays.has(userId)) retroPays.set(userId, []);
    retroPays.get(userId)!.push(row);
  }

  // ✅ COOP Savings Membership (NO cutoff fields; uses start_date/end_date + monthly_amount)
  const coopArrRaw = userIds.length
    ? await safeList<Record<string, unknown>>(RES.coop_savings, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[is_active][_eq]": 1,
      "filter[start_date][_lte]": cutoff.end_date,
      "filter[_or][0][end_date][_null]": "true",
      "filter[_or][1][end_date][_gte]": cutoff.start_date,
      limit: 20000,
    })
    : [];

  const coopSavingsMemberships = new Map<number, CoopSavingsMembershipRow[]>();
  for (const raw of (coopArrRaw ?? []) as Record<string, unknown>[]) {
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
      created_by: (raw.created_by as number) ?? null,
      created_date: s(raw.created_date ?? raw.created_at ?? raw.date_created ?? ""),
      updated_by: (raw.updated_by as number) ?? null,
      updated_date: s(raw.updated_date ?? raw.updated_at ?? raw.date_updated ?? ""),
    };

    if (!coopSavingsMemberships.has(userId)) coopSavingsMemberships.set(userId, []);
    coopSavingsMemberships.get(userId)!.push(row);
  }

  const rawBenefitSettings = await safeList<BenefitCutoffSetting>(RES.benefitSettings, {
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
    ? await safeList<Record<string, unknown>>(RES.employeeLoans, {
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
    ? await safeList<Record<string, unknown>>(RES.benefitLoans, {
      "filter[user_id][_in]": userIds.join(","),
      "filter[status][_eq]": "ACTIVE",
      "filter[remaining_balance][_gt]": 0,
      limit: 5000,
    })
    : [];

  const benefitLoans = new Map<number, BenefitLoanRow[]>();
  for (const r of rawBenefitLoans ?? []) {
    const userId = n(r.user_id);
    if (!benefitLoans.has(userId)) benefitLoans.set(userId, []);
    benefitLoans.get(userId)!.push(r as unknown as BenefitLoanRow);
  }

  const rawAllowances = userIds.length
    ? await safeList<Record<string, unknown>>(RES.allowances, {
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
    companyName,
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
    }) as PayrollComputedLine;

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
      companyName: ws.companyName,
    },
  };
}

// --- On-hold helpers ---------------------------------------------------------
export function isEmployeeOnHold(user: UserRow): boolean {
  const u = (user ?? {}) as unknown as Record<string, unknown>;
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
  const l = (line ?? {}) as unknown as Record<string, unknown>;
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
  let eq = true;
  a.forEach((v, k) => {
    if (Boolean(b.get(k)) !== Boolean(v)) eq = false;
  });
  return eq;
}

export async function loadPersistedHoldMap(payrollRunId: number): Promise<Map<number, boolean>> {
  const pid = n(payrollRunId);
  const map = new Map<number, boolean>();
  if (!pid) return map;

  const rows = await safeList<Record<string, unknown>>(
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
 * Load posted employees map from payroll_run_employee.
 * Returns a map of user_id -> true for employees that are posted (on_hold != 1).
 * This is used in the payroll rerun scenario to make posted employees read-only.
 */
export async function loadPostedEmployeesMap(payrollRunId: number): Promise<Map<number, boolean>> {
  const pid = n(payrollRunId);
  const map = new Map<number, boolean>();
  if (!pid) return map;

  const rows = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": pid,
      "filter[on_hold][_neq]": 1,  // Get employees that are NOT on hold (i.e., posted)
      limit: 50000,
      fields: "user_id,on_hold",
      sort: "user_id",
    },
    [],
  );

  for (const r of rows ?? []) {
    const uid = n(r?.user_id);
    if (!uid) continue;
    map.set(uid, true);  // Mark as posted
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
  const payrollRunId = n(args.payrollRun?.payroll_run_id);
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

  const payload: Record<string, unknown> = {
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

  const created = await api.createItem<Record<string, unknown>>(resource, payload);

  return {
    id: n(created?.id),
    cutoff_id: args.cutoff.id,
    user_id: args.userId,
    type: args.type,
    desc: s(created?.description ?? args.desc),
    amount: n(created?.amount ?? args.amount),
    category: args.type === "DEDUCTION" ? normalizeManualCategory(created) : null,
  };
}

export async function updateManualEntry(args: {
  entryId: number;
  type: ManualEntryType;
  desc: string;
  amount: number;
  category?: string | null;
}): Promise<void> {
  const resource = resourceForManualType(args.type);

  const payload: Record<string, unknown> = {
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
    args.cutoff.payout_date ||
    args.cutoff.end_date;

  const payload: Record<string, unknown> = {
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

  const created = await api.createItem<Record<string, unknown>>(RES.drPayments, payload);

  const drId = n(created?.dr_payment_id ?? created?.id);
  const drNo = s(created?.delivery_receipt_number ?? payload.delivery_receipt_number);
  const amt = n(created?.amount_paid ?? payload.amount_paid);

  return {
    id: -Math.abs(drId || Date.now()),
    cutoff_id: args.cutoff.id,
    user_id: args.userId,
    type: "DEDUCTION",
    desc: `${drNo || `#${drId || "NEW"}`}`,
    amount: amt,
    category: "DR_PAYMENT",
  };
}

function drIdFromManualEntry(e: ManualEntry): number {
  const meta = (e.meta as Record<string, unknown>)?.dr_payment_id ?? (e.meta as Record<string, unknown>)?.source_id ?? null;
  const id = n(meta);
  if (id > 0) return id;

  const fallback = Math.abs(n(e.id));
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

  const payload: Record<string, unknown> = {
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
  const entry = { id: -Math.abs(args.drPaymentId) } as unknown as ManualEntry;
  await updateDRPayment({
    entry,
    desc: String(args.drReceiptNo ?? "").trim(),
    amount: Number(args.amount ?? 0),
    remarks: args.remarks,
  });
}

export async function deleteDRPaymentDeduction(args: { drPaymentId: number }): Promise<void> {
  const entry = { id: -Math.abs(args.drPaymentId) } as unknown as ManualEntry;
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
}): Record<string, unknown> {
  const l = args.line;

  const cutoffLabel =
    (args.cutoff.cutoff_type ? String(args.cutoff.cutoff_type) : "") +
    ` ${s(args.cutoff.start_date)}-${s(args.cutoff.end_date)}`;

  const onHold = bitToNum(l.on_hold);

  const totalAdditions =
    n(l.total_additions) ||
    round2(
      n(l.allowance) +
      n(l.manual_additions) +
      n(l.ot_amount) +
      n(l.holiday_pay) +
      n(l.rest_day_amount) +
      n(l.night_diff_amount) +
      n(l.leave_amount) +
      n(l.retro_pay),
    );

  const totalDeductions =
    n(l.total_deductions) ||
    round2(
      n(l.late_deduction) +
      n(l.undertime_deduction) +
      n(l.shortage_deduction) +
      n(l.dr_deduction) +
      n(l.manual_deductions) +
      n(l.other_deductions) +
      n(l.loan_total) +
      n(l.benefit_loan_total) +
      n(l.benefit_sss) +
      n(l.benefit_philhealth) +
      n(l.benefit_pagibig) +
      n(l.coop_savings),
    );

  const grossPay = n(l.gross_pay) || round2(n(l.basic_pay) + totalAdditions);
  const netPay = n(l.net_pay) || round2(grossPay - totalDeductions);

  const previousNet = n(l.previous_net_pay ?? 0);
  const varianceAmount =
    n(l.variance_amount) || round2(n(l.variance_amount_ui) || (netPay - previousNet));

  const prorationJson = normalizeJsonOrNull(l.proration_json);
  const breakdownJson = normalizeJsonOrNull(l.breakdown_json);

  const sssLoan = n(l.benefit_loan_sss ?? 0);
  const pagibigLoan = n(l.benefit_loan_pagibig ?? 0);

  return {
    payroll_run_id: args.payrollRunId,
    user_id: args.userId,

    employee_name: l.employee_name,
    position: l.position ?? null,
    department_name: l.department_name ?? null,
    position_name: l.position_name ?? l.position ?? null,
    department_name_snapshot:
      l.department_name_snapshot ??
      l.department_snapshot ??
      l.department_name ??
      null,

    cutoff_start: s(args.cutoff.start_date),
    cutoff_end: s(args.cutoff.end_date),
    cutoff_label: cutoffLabel.trim() || null,
    cutoff_type: args.cutoff.cutoff_type ?? null,
    cutoff_id: n(args.cutoff.id) || null,

    daily_rate: n(l.daily_rate),
    basic_daily_rate: n(l.basic_daily_rate ?? l.daily_rate),
    hourly_rate: n(l.hourly_rate),
    monthly_rate: n(l.monthly_rate),

    total_days_worked: n(l.total_days_worked),
    total_work_minutes: n(l.total_work_minutes),
    late_minutes: n(l.late_minutes),
    undertime_minutes: n(l.undertime_minutes),
    overtime_minutes: n(l.overtime_minutes),
    night_diff_minutes: n(l.night_diff_minutes),
    total_hours_worked: n(l.total_hours_worked),

    basic_pay: n(l.basic_pay),
    ot_amount: n(l.ot_amount),
    leave_amount: n(l.leave_amount ?? 0),
    retro_pay: n(l.retro_pay),
    retro_remarks: l.retro_remarks ?? null,

    holiday: n(l.holiday ?? l.holiday_days),
    holiday_pay: n(l.holiday_pay),
    holiday_days: n(l.holiday_days),
    rest_day_amount: n(l.rest_day_amount),
    night_diff_amount: n(l.night_diff_amount),

    allowance: n(l.allowance),
    manual_additions: n(l.manual_additions),

    late_deduction: n(l.late_deduction),
    undertime_deduction: n(l.undertime_deduction),
    shortage_deduction: n(l.shortage_deduction),

    benefit_pagibig: n(l.benefit_pagibig),
    benefit_philhealth: n(l.benefit_philhealth),
    benefit_sss: n(l.benefit_sss),

    loan_vale: n(l.loan_vale),
    loan_car: n(l.loan_car),
    loan_coop: n(l.loan_coop),
    loan_total: n(l.loan_total),

    benefit_loan_sss: sssLoan,
    benefit_loan_pagibig: pagibigLoan,
    benefit_loan_total: n(l.benefit_loan_total ?? 0),

    coop_savings: n(l.coop_savings ?? 0),
    coop_loan: n(l.coop_loan ?? 0),

    dr_deduction: n(l.dr_deduction),
    other_deductions: n(l.other_deductions),
    manual_deductions: n(l.manual_deductions),

    total_additions: round2(totalAdditions),
    total_deductions: round2(totalDeductions),
    gross_pay: round2(grossPay),
    net_pay: round2(netPay),

    is_prorated: bitToNum(l.is_prorated ?? 0),
    proration_json: prorationJson,
    breakdown_json: breakdownJson,

    previous_net_pay: round2(previousNet),
    variance_amount_ui: round2(n(l.variance_amount_ui ?? varianceAmount)),
    variance_amount: round2(varianceAmount),
    variance_pct: n(l.variance_pct ?? 0),
    variance_flag: bitToNum(l.variance_flag),

    on_hold: onHold,
    is_card: bitToNum(l.is_card ?? 0),
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

  meta?: unknown | null;
};

function buildItemPayloadsFromBreakdown(args: {
  payrollRunEmployeeId: number;
  payrollRunId: number;
  userId: number;
  cutoff: CutoffSetting;
  breakdown: unknown | null;
}): PayrollRunEmployeeItemPayload[] {
  const b = (args.breakdown ?? null) as PayrollBreakdownJson | null;
  if (!b || typeof b !== "object") return [];

  const out: PayrollRunEmployeeItemPayload[] = [];
  const base = {
    payroll_run_employee_id: args.payrollRunEmployeeId,
    payroll_run_id: args.payrollRunId,
    user_id: args.userId,
    cutoff_start: s(args.cutoff.start_date),
    cutoff_end: s(args.cutoff.end_date),
  };

  const earnings = b?.earnings ?? {};
  const deductions = b?.deductions ?? {};

  // 1) Allowances
  arr<Record<string, unknown>>(earnings?.allowance_items as Record<string, unknown>[]).forEach((it, idx) => {
    const allowanceId = n(it?.allowance_id ?? it?.id);
    const key = allowanceId ? `ALW:${allowanceId}` : `ALW:IDX${idx + 1}`;

    const amount = round2(n(it?.amount_this_cutoff ?? it?.amount ?? it?.amount_full ?? 0));
    if (amount === 0) return;

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
  });

  // 2) Manual additions
  arr<Record<string, unknown>>(earnings?.manual_addition_items).forEach((it, idx) => {
    const itemKeyRaw = it?.item_key ?? it?.key ?? null;
    const sourceIdRaw = n(it?.source_id ?? it?.id ?? 0);
    const sourceId = sourceIdRaw > 0 ? sourceIdRaw : Math.abs(sourceIdRaw);

    const key = (itemKeyRaw && s(itemKeyRaw)) || (sourceId ? `MA:${sourceId}` : `MA:IDX${idx + 1}`);

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) return;

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
  });

  // 2.1) Retro pay items
  arr<Record<string, unknown>>(earnings?.retro_items ?? earnings?.retro_pay_items).forEach((it, idx) => {
    const sourceIdRaw = n(it?.source_id ?? it?.retro_id ?? it?.id ?? 0);
    const sourceId = sourceIdRaw > 0 ? sourceIdRaw : Math.abs(sourceIdRaw);
    const key = sourceId ? `RP:${sourceId}` : `RP:IDX${idx + 1}`;

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) return;

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
  });

  // 3) Employee loans
  arr<Record<string, unknown>>(deductions?.employee_loan_items as Record<string, unknown>[]).forEach((it, idx) => {
    const itemKeyRaw = it?.item_key ?? it?.key ?? null;
    const loanIdRaw = n(it?.loan_id ?? it?.source_id ?? it?.id ?? 0);
    const loanId = loanIdRaw > 0 ? loanIdRaw : Math.abs(loanIdRaw);

    const key = (itemKeyRaw && s(itemKeyRaw)) || (loanId ? `EL:${loanId}` : `EL:IDX${idx + 1}`);

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) return;

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
  });

  // 4) Benefit loans
  const benefitLoanItems = arr<Record<string, unknown>>((deductions as Record<string, unknown>)?.benefit_loans ? (deductions.benefit_loans as Record<string, unknown>)?.items : null);
  benefitLoanItems.forEach((it, idx) => {
    const loanIdRaw = n(it?.loan_id ?? it?.id ?? 0);
    const loanId = loanIdRaw > 0 ? loanIdRaw : Math.abs(loanIdRaw);
    const key = loanId ? `BL:${loanId}` : `BL:IDX${idx + 1}`;

    const amount = round2(n(it?.amount_this_cutoff ?? it?.amount ?? 0));
    if (amount === 0) return;

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
  });

  // 5) Manual deductions (ensure source_id NEVER negative)
  arr<Record<string, unknown>>(deductions?.manual_deduction_items as Record<string, unknown>[]).forEach((it, idx) => {
    const itemKeyRaw = it?.item_key ?? it?.key ?? null;

    const sourceIdRaw = n(it?.source_id ?? it?.id ?? 0);
    const absId = Math.abs(sourceIdRaw);
    const sourceId = absId > 0 ? absId : 0;

    const key = (itemKeyRaw && s(itemKeyRaw)) || (sourceId ? `MD:${sourceId}` : `MD:IDX${idx + 1}`);

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) return;

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
        isDR ? { ...((it?.meta as Record<string, unknown>) ?? {}), original_source_id: sourceIdRaw } : it?.meta ?? null,
      ),
    });
  });

  // 5.1) COOP savings membership items
  arr<Record<string, unknown>>(deductions?.coop_savings_items).forEach((it, idx) => {
    const membershipId = it?.membership_id != null ? s(it.membership_id) : "";
    const sourceId = n(it?.source_id ?? it?.id ?? 0);
    const key = membershipId
      ? `CSM:${membershipId}`
      : sourceId
        ? `CSM:${sourceId}`
        : `CSM:IDX${idx + 1}`;

    const amount = round2(n(it?.amount ?? 0));
    if (amount === 0) return;

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
      meta: normalizeJsonOrNull((it?.meta as Record<string, unknown>) ?? null),
    });
  });

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

  let rows: Record<string, unknown>[] = [];
  try {
    rows = await safeList<Record<string, unknown>>(
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
  breakdownJson: unknown | null;
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
      await api.createItem<Record<string, unknown>>(RES.payrollLineItems, p);
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

  const existing = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": payrollRunId,
      limit: 50000,
      sort: "user_id",
    },
    [],
  );

  const existingByUser = new Map<number, Record<string, unknown>>();
  for (const r of existing ?? []) {
    const uid = n(r?.user_id ?? r?.employee_id ?? r?.userId ?? r?.employeeId);
    if (!uid) continue;
    existingByUser.set(uid, r);
  }

  const keepUserIds = new Set<number>();
  const tasks: Array<() => Promise<void>> = [];

  for (const line of lines) {
    const l = line as unknown as Record<string, unknown>;
    const userId =
      n(line.user_id) ||
      n(l.employee_id) ||
      n(l.userId) ||
      n(l.id);

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
          const created = await api.createItem<Record<string, unknown>>(RES.payrollLines, payload);
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
        const created = await api.createItem<Record<string, unknown>>(RES.payrollLines, payload);
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

  // ✅ Fetch payroll run to get payroll_ref_no
  let payrollRefNo: string | null = null;
  try {
    const cur = await api.getItem<PayrollRunHeader>(RES.payrollRun, pid, { fields: "payroll_run_id,payroll_ref_no" });
    payrollRefNo = cur?.payroll_ref_no ? String(cur.payroll_ref_no) : null;
  } catch {
    // if read fails, fall through and try patch (existing behavior)
  }

  if (!payrollRefNo) {
    throw new Error("Cannot post payroll: payroll_ref_no not found");
  }

  // ✅ Update accumulations before marking as POSTED
  // Note: Idempotency is handled within each function using payroll_ref_no + user_id tracking
  try {
    await updateEmployeeLoanAccumulations({ payrollRunId: pid, payrollRefNo });
  } catch (e: unknown) {
    const err = e as Error;
    throw new Error(`Failed to update employee loan accumulations: ${err.message}`);
  }

  try {
    await updateBenefitLoanAccumulations({ payrollRunId: pid, payrollRefNo });
  } catch (e: unknown) {
    const err = e as Error;
    throw new Error(`Failed to update benefit loan accumulations: ${err.message}`);
  }

  try {
    await updateCoopSavingsAccumulations({ payrollRunId: pid, payrollRefNo });
  } catch (e: unknown) {
    const err = e as Error;
    throw new Error(`Failed to update coop savings accumulations: ${err.message}`);
  }

  try {
    await createBenefitLogs({ payrollRunId: pid, payrollRefNo });
  } catch (e: unknown) {
    console.error("Failed to create benefit logs:", e);
    // Don't block posting for logging failure, just warn
  }

  try {
    await updateOneTimeAllowancesAsProcessed({ payrollRunId: pid, payrollRefNo });
  } catch (e: unknown) {
    console.error("Failed to process one-time allowances:", e);
  }

  try {
    await updateRetroPaysAsProcessed({ payrollRunId: pid, payrollRefNo });
  } catch (e: unknown) {
    console.error("Failed to process retro pays:", e);
  }

  try {
    await updateDRPaymentsAsProcessed({ payrollRunId: pid, payrollRefNo });
  } catch (e: unknown) {
    console.error("Failed to process DR Payments:", e);
  }

  // Mark as POSTED
  await api.patchItem(RES.payrollRun, pid, {
    status: "POSTED",
    posted_by: args.postedBy,
    posted_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  });
}

/**
 * Update accumulated amounts for employee loans based on payroll deductions.
 * Also validates that accumulated amount doesn't exceed loan amount and auto-closes fully paid loans.
 * Uses payroll_ref_no-based idempotency via last_paid_cutoff_id.
 */
async function updateEmployeeLoanAccumulations(args: { payrollRunId: number; payrollRefNo: string }): Promise<void> {
  const payrollRefNo = args.payrollRefNo;

  // 1. Fetch all payroll_run_employee records for this run (excluding on-hold)
  const employees = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": args.payrollRunId,
      "filter[on_hold][_neq]": 1,
      fields: "user_id,breakdown_json,on_hold",
      limit: 5000,
    },
    [],
  );

  // 2. Extract employee_loan_items from breakdown_json.deductions
  const updates: Array<{ loan_id: number; amount: number }> = [];

  for (const emp of employees) {
    const breakdown = normalizeJsonOrNull(emp.breakdown_json) as PayrollBreakdownJson | null;
    const deductions = (breakdown?.deductions as Record<string, unknown>) ?? {};
    const loanItems = arr<{ source_table?: string; source_id?: number | string; amount: number }>(
      deductions?.employee_loan_items,
    );

    for (const item of loanItems) {
      if (item.source_table === "employee_loan" && item.source_id) {
        updates.push({
          loan_id: n(item.source_id),
          amount: n(item.amount),
        });
      }
    }
  }

  // 3. Group by loan_id and sum amounts (in case same loan appears multiple times)
  const grouped = new Map<number, number>();
  for (const u of updates) {
    grouped.set(u.loan_id, (grouped.get(u.loan_id) || 0) + u.amount);
  }

  // 4. Update each loan's accumulated_amount with validation and auto-close
  for (const [loanId, deductedAmount] of Array.from(grouped)) {
    try {
      // Read current loan data
      const loan = await api.getItem<Record<string, unknown>>(RES.employeeLoans, loanId, {
        fields: "loan_id,accumulated_amount,loan_amount,interest_amount,status,last_paid_cutoff_id",
      });

      // ✅ Idempotency check: skip if already processed for this payroll
      const lastPaidCutoffId = loan.last_paid_cutoff_id ? String(loan.last_paid_cutoff_id) : null;
      if (lastPaidCutoffId === payrollRefNo) {
        continue;
      }

      const currentAccumulated = n(loan.accumulated_amount);
      const loanAmount = n(loan.loan_amount);
      const interestAmount = n(loan.interest_amount);
      const totalPayable = round2(loanAmount + interestAmount);

      // Calculate new accumulated amount
      let newAccumulated = round2(currentAccumulated + deductedAmount);

      // ✅ Validation: ensure accumulated doesn't exceed total payable
      if (newAccumulated > totalPayable) {
        newAccumulated = totalPayable;
      }

      // ✅ Auto-close logic: if fully paid, mark as PAID
      const shouldClose = newAccumulated >= totalPayable;
      const newStatus = shouldClose ? "PAID" : loan.status;

      await api.patchItem(RES.employeeLoans, loanId, {
        accumulated_amount: newAccumulated,
        status: newStatus,
        last_paid_cutoff_id: payrollRefNo,
      });
    } catch (e: unknown) {
      console.error(`[updateEmployeeLoanAccumulations] Failed to update loan ${loanId}:`, e);
      throw e;
    }
  }
}

/**
 * Update accumulated amounts for benefit loans (SSS, PAGIBIG).
 * Also validates and auto-closes fully paid loans.
 * Uses payroll_ref_no-based idempotency via last_paid_cutoff_id.
 */
async function updateBenefitLoanAccumulations(args: { payrollRunId: number; payrollRefNo: string }): Promise<void> {
  const payrollRefNo = args.payrollRefNo;

  // 1. Fetch all payroll_run_employee records (excluding on-hold)
  const employees = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": args.payrollRunId,
      "filter[on_hold][_neq]": 1,
      fields: "user_id,benefit_loan_sss,benefit_loan_pagibig,on_hold",
      limit: 5000,
    },
    [],
  );

  // 2. Extract benefit loan amounts
  const updates: Array<{ user_id: number; benefit_code: string; amount: number }> = [];

  for (const emp of employees) {
    const userId = n(emp.user_id);
    const sssAmount = n(emp.benefit_loan_sss);
    const pagibigAmount = n(emp.benefit_loan_pagibig);

    if (sssAmount > 0) {
      updates.push({ user_id: userId, benefit_code: "SSS", amount: sssAmount });
    }
    if (pagibigAmount > 0) {
      updates.push({ user_id: userId, benefit_code: "PAGIBIG", amount: pagibigAmount });
    }
  }

  // 3. Find and update each benefit loan
  for (const u of updates) {
    try {
      // Find active benefit loan for this user and benefit code
      const loans = await safeList<Record<string, unknown>>(
        RES.benefitLoans,
        {
          "filter[user_id][_eq]": u.user_id,
          "filter[benefit_code][_eq]": u.benefit_code,
          "filter[status][_eq]": "ACTIVE",
          limit: 1,
        },
        [],
      );

      if (loans.length === 0) {
        continue;
      }

      const loan = loans[0];
      const loanId = n(loan.loan_id ?? loan.id);

      // ✅ Idempotency check: skip if already processed for this payroll
      const lastPaidCutoffId = loan.last_paid_cutoff_id ? String(loan.last_paid_cutoff_id) : null;
      if (lastPaidCutoffId === payrollRefNo) {
        continue;
      }

      const currentAccumulated = n(loan.accumulated_amount);
      const totalPayable = n(loan.total_payable);
      const currentRemaining = n(loan.remaining_balance);
      const paidInstallments = n(loan.paid_installments);

      // Calculate new values
      let newAccumulated = round2(currentAccumulated + u.amount);
      let newRemaining = round2(currentRemaining - u.amount);

      // ✅ Validation: ensure accumulated doesn't exceed total payable
      if (newAccumulated > totalPayable) {
        console.warn(
          `[updateBenefitLoanAccumulations] Loan ${loanId}: accumulated (${newAccumulated}) would exceed total payable (${totalPayable}). Capping at total payable.`,
        );
        newAccumulated = totalPayable;
        newRemaining = 0;
      }

      // Ensure remaining balance doesn't go negative
      newRemaining = Math.max(0, newRemaining);

      // ✅ Auto-close logic: if fully paid, mark as CLOSED
      const shouldClose = newAccumulated >= totalPayable || newRemaining <= 0;
      const newStatus = shouldClose ? "CLOSED" : "ACTIVE";

      await api.patchItem(RES.benefitLoans, loanId, {
        accumulated_amount: newAccumulated,
        remaining_balance: newRemaining,
        paid_installments: paidInstallments + 1,
        status: newStatus,
        last_paid_cutoff_id: payrollRefNo,
      });
    } catch (e: unknown) {
      console.error(
        `[updateBenefitLoanAccumulations] Failed to update ${u.benefit_code} loan for user ${u.user_id}:`,
        e,
      );
      throw e;
    }
  }
}

/**
 * Update `is_processed=1` for one-time allowances applied in this cutoff.
 */
async function updateOneTimeAllowancesAsProcessed(args: { payrollRunId: number; payrollRefNo: string }): Promise<void> {
  const employees = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": args.payrollRunId,
      "filter[on_hold][_neq]": 1,
      fields: "breakdown_json",
      limit: 5000,
    },
    []
  );

  const allowanceIds = new Set<number>();
  for (const emp of employees) {
    const breakdown = normalizeJsonOrNull(emp.breakdown_json) as PayrollBreakdownJson | null;
    const items = arr<{ source_table?: string; source_id?: number }>(breakdown?.earnings?.allowance_items);
    for (const item of items) {
      if (item.source_table === "employee_allowance" && item.source_id) {
        allowanceIds.add(n(item.source_id));
      }
    }
  }

  if (allowanceIds.size === 0) return;

  // Fetch these allowances to confirm which ones are one-time
  const allowances = await safeList<Record<string, unknown>>(
    RES.allowances,
    {
      "filter[allowance_id][_in]": Array.from(allowanceIds).join(","),
      "filter[is_recurring][_eq]": 0,
      "filter[is_processed][_eq]": 0,
      fields: "allowance_id",
      limit: 5000,
    },
    []
  );

  const idsToProcess = allowances.map(a => n(a.allowance_id)).filter(id => id > 0);
  if (idsToProcess.length === 0) return;

  await runWithConcurrency(
    idsToProcess.map(id => async () => {
      await api.patchItem(RES.allowances, id, { is_processed: 1 });
    }),
    6
  );
}

/**
 * Update `is_processed=1` for retro pays applied in this cutoff.
 */
async function updateRetroPaysAsProcessed(args: { payrollRunId: number; payrollRefNo: string }): Promise<void> {
  const employees = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": args.payrollRunId,
      "filter[on_hold][_neq]": 1,
      fields: "breakdown_json",
      limit: 5000,
    },
    []
  );

  const retroIds = new Set<number>();
  for (const emp of employees) {
    const breakdown = normalizeJsonOrNull(emp.breakdown_json) as PayrollBreakdownJson | null;
    const earnings = (breakdown?.earnings as Record<string, unknown>) ?? {};
    const items = arr<{ source_table?: string; source_id?: number }>(earnings.retro_pay_items ?? earnings.retro_items_all);
    for (const item of items) {
      if (item.source_table === "retro_pay" && item.source_id) {
        retroIds.add(n(item.source_id));
      }
    }
  }

  if (retroIds.size === 0) return;

  const retroPays = await safeList<Record<string, unknown>>(
    RES.retro_pay,
    {
      "filter[retro_id][_in]": Array.from(retroIds).join(","),
      "filter[is_processed][_eq]": 0,
      fields: "retro_id",
      limit: 5000,
    },
    []
  );

  const idsToProcess = retroPays.map(r => n(r.retro_id)).filter(id => id > 0);
  if (idsToProcess.length === 0) return;

  await runWithConcurrency(
    idsToProcess.map(id => async () => {
      await api.patchItem(RES.retro_pay, id, { is_processed: 1 });
    }),
    6
  );
}

/**
 * Update `is_posted_to_payroll=1` for DR Payments applied in this cutoff.
 */
async function updateDRPaymentsAsProcessed(args: { payrollRunId: number; payrollRefNo: string }): Promise<void> {
  const employees = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": args.payrollRunId,
      "filter[on_hold][_neq]": 1,
      fields: "breakdown_json",
      limit: 5000,
    },
    []
  );

  const drIds = new Set<number>();
  for (const emp of employees) {
    const breakdown = normalizeJsonOrNull(emp.breakdown_json) as PayrollBreakdownJson | null;
    const deductions = (breakdown?.deductions as Record<string, unknown>) ?? {};
    const drItems = arr<{ category?: string; source_id?: number | string }>(deductions.manual_deduction_items);
    for (const item of drItems) {
      if (item.category === "DR_PAYMENT" && item.source_id) {
        // compute.ts sends negative ids for drPayments: id: -Math.abs(drId)
        const absoluteId = Math.abs(n(item.source_id));
        if (absoluteId > 0) drIds.add(absoluteId);
      }
    }
  }

  if (drIds.size === 0) return;

  const drPays = await safeList<Record<string, unknown>>(
    RES.drPayments,
    {
      "filter[dr_payment_id][_in]": Array.from(drIds).join(","),
      "filter[is_posted_to_payroll][_eq]": 0,
      fields: "dr_payment_id",
      limit: 5000,
    },
    []
  );

  const idsToProcess = drPays.map(d => n(d.dr_payment_id)).filter(id => id > 0);
  if (idsToProcess.length === 0) return;

  await runWithConcurrency(
    idsToProcess.map(id => async () => {
      await api.patchItem(RES.drPayments, id, {
        is_posted_to_payroll: 1,
        payroll_ref_no: args.payrollRefNo,
      });
    }),
    6
  );
}

/**
 * Update total collection for coop savings memberships.
 * Uses payroll_ref_no-based idempotency via last_paid_cutoff_id.
 */
async function updateCoopSavingsAccumulations(args: { payrollRunId: number; payrollRefNo: string }): Promise<void> {
  const payrollRefNo = args.payrollRefNo;

  // 1. Fetch all payroll_run_employee records (excluding on-hold)
  const employees = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": args.payrollRunId,
      "filter[on_hold][_neq]": 1,
      fields: "user_id,breakdown_json,on_hold",
      limit: 5000,
    },
    [],
  );

  // 2. Extract coop_savings_items from breakdown_json.deductions
  const updates: Array<{ membership_id: string; amount: number }> = [];

  for (const emp of employees) {
    const breakdown = normalizeJsonOrNull(emp.breakdown_json) as PayrollBreakdownJson | null;
    const deductions = (breakdown?.deductions as Record<string, unknown>) ?? {};
    const coopItems = arr<{ source_table?: string; membership_id?: string; amount: number }>(
      deductions?.coop_savings_items,
    );

    for (const item of coopItems) {
      if (item.source_table === "coop_savings_membership" && item.membership_id) {
        updates.push({
          membership_id: String(item.membership_id),
          amount: n(item.amount),
        });
      }
    }
  }

  // 3. Group by membership_id and sum amounts
  const grouped = new Map<string, number>();
  for (const u of updates) {
    grouped.set(u.membership_id, (grouped.get(u.membership_id) || 0) + u.amount);
  }

  // 4. Update each membership's total_collection
  for (const [membershipId, amount] of Array.from(grouped)) {
    try {
      // Find membership by membership_id
      const memberships = await safeList<Record<string, unknown>>(
        RES.coop_savings,
        {
          "filter[membership_id][_eq]": membershipId,
          limit: 1,
        },
        [],
      );

      if (memberships.length === 0) {
        continue;
      }

      const membership = memberships[0];
      const id = n(membership.id);

      // ✅ Idempotency check: skip if already processed for this payroll
      const lastPaidCutoffId = membership.last_paid_cutoff_id ? String(membership.last_paid_cutoff_id) : null;
      if (lastPaidCutoffId === payrollRefNo) {
        continue;
      }

      const currentCollection = n(membership.total_collection);
      const currentMonths = n(membership.total_months);

      const newCollection = round2(currentCollection + amount);
      const newMonths = currentMonths + 1;

      await api.patchItem(RES.coop_savings, id, {
        total_collection: newCollection,
        total_months: newMonths,
        last_paid_cutoff_id: payrollRefNo,
      });
    } catch (e: unknown) {
      console.error(
        `[updateCoopSavingsAccumulations] Failed to update membership ${membershipId}:`,
        e,
      );
      throw e;
    }
  }
}

/**
 * Creates or updates benefit logs for contributions and loans.
 *
 * Strategy:
 * - CONTRIBUTIONS: delete existing rows first, then insert fresh.
 *   Reason: MySQL treats NULL != NULL in unique indexes, so the DB unique constraint
 *   `uq_blog_unique(cutoff_id, user_id, benefit_code, log_type, loan_id)` does NOT
 *   prevent duplicate contribution rows (loan_id IS NULL). Delete+insert is the only
 *   reliable approach.
 * - LOANS: upsert (check by loan_id, patch if found, insert if not).
 *   Reason: loan_id IS NOT NULL so the unique constraint works correctly for loans.
 */
async function createBenefitLogs(args: { payrollRunId: number; payrollRefNo: string }): Promise<void> {
  const payrollRunId = n(args.payrollRunId);
  if (!payrollRunId) return;

  // 1. Fetch header to get cutoff_id and dates
  const header = await api.getItem<PayrollRunHeader>(RES.payrollRun, payrollRunId, {
    fields: "cutoff_id,cutoff_start,cutoff_end,cutoff_type",
  });
  if (!header?.cutoff_id) {
    console.warn(`[createBenefitLogs] Missing cutoff_id for run ${payrollRunId}`);
    return;
  }
  const cutoffId = n(header.cutoff_id);
  const cutoffStart = header.cutoff_start ?? null;
  const cutoffEnd = header.cutoff_end ?? null;
  const cutoffType = header.cutoff_type ?? null;

  // 2. Fetch all employee lines (excluding on-hold)
  const employees = await safeList<Record<string, unknown>>(
    RES.payrollLines,
    {
      "filter[payroll_run_id][_eq]": payrollRunId,
      "filter[on_hold][_neq]": 1,
      fields: "user_id,benefit_sss,benefit_philhealth,benefit_pagibig,benefit_loan_sss,benefit_loan_pagibig,breakdown_json",
      limit: 5000,
    },
    [],
  );

  if (!employees.length) return;

  const userIds = Array.from(new Set(employees.map(e => n(e.user_id)).filter(id => id > 0)));

  // ─────────────────────────────────────────────────────────────────────────
  // STEP A: Handle CONTRIBUTIONS — Upsert via JS Map
  // MySQL NULL != NULL in unique indexes, so the DB unique constraint
  // does not prevent duplicate contribution rows (loan_id IS NULL).
  // Safe fix: query existing rows, build a JS map, and upsert exactly like loans.
  // ─────────────────────────────────────────────────────────────────────────

  const userIdSet = new Set(userIds);

  // A1. Fetch existing CONTRIBUTION logs for affected users in this cutoff, build lookup map.
  const existingContribMap = new Map<string, number>(); // key: "userId|benefitCode|payrollRunId" → record id
  const allContributions = await safeList<Record<string, unknown>>(
    RES.benefitLogs,
    {
      "filter[cutoff_id][_eq]": cutoffId,
      "filter[log_type][_eq]": "CONTRIBUTION",
      fields: "benefit_log_id,user_id,benefit_code,payroll_run_id",
      limit: 5000,
    },
    [],
  );

  for (const log of allContributions.filter(l => userIdSet.has(n(l.user_id)))) {
    const id = n(log.benefit_log_id ?? log.id);
    if (!id) continue;
    const pId = n(log.payroll_run_id);
    const key = `${n(log.user_id)}|${String(log.benefit_code).toUpperCase()}|${pId}`;
    existingContribMap.set(key, id);
  }

  // A2. Build and upsert CONTRIBUTION rows
  const contributionLogs: Record<string, unknown>[] = [];
  for (const emp of employees) {
    const userId = n(emp.user_id);
    if (!userId) continue;

    const sss = n(emp.benefit_sss);
    const ph = n(emp.benefit_philhealth);
    const hdmf = n(emp.benefit_pagibig);

    if (sss > 0) {
      contributionLogs.push({
        cutoff_id: cutoffId,
        cutoff_start: cutoffStart,
        cutoff_end: cutoffEnd,
        cutoff_type: cutoffType,
        user_id: userId,
        benefit_code: "SSS",
        log_type: "CONTRIBUTION",
        source_amount: sss,
        deducted_amount: sss,
        payroll_run_id: payrollRunId,
        payroll_detail_id: null,
      });
    }
    if (ph > 0) {
      contributionLogs.push({
        cutoff_id: cutoffId,
        cutoff_start: cutoffStart,
        cutoff_end: cutoffEnd,
        cutoff_type: cutoffType,
        user_id: userId,
        benefit_code: "PHILHEALTH",
        log_type: "CONTRIBUTION",
        source_amount: ph,
        deducted_amount: ph,
        payroll_run_id: payrollRunId,
        payroll_detail_id: null,
      });
    }
    if (hdmf > 0) {
      contributionLogs.push({
        cutoff_id: cutoffId,
        cutoff_start: cutoffStart,
        cutoff_end: cutoffEnd,
        cutoff_type: cutoffType,
        user_id: userId,
        benefit_code: "PAGIBIG",
        log_type: "CONTRIBUTION",
        source_amount: hdmf,
        deducted_amount: hdmf,
        payroll_run_id: payrollRunId,
        payroll_detail_id: null,
      } as Record<string, unknown>);
    }
  }

  if (contributionLogs.length > 0) {
    const insTasks = contributionLogs.map(payload => async () => {
      const key = `${payload.user_id}|${String(payload.benefit_code).toUpperCase()}|${payrollRunId}`;
      const existingId = existingContribMap.get(key);
      try {
        if (existingId) {
          await api.patchItem(RES.benefitLogs, existingId, {
            source_amount: payload.source_amount,
            deducted_amount: payload.deducted_amount,
            payroll_run_id: payload.payroll_run_id,
            payroll_detail_id: payload.payroll_detail_id,
            cutoff_start: payload.cutoff_start,
            cutoff_end: payload.cutoff_end,
            cutoff_type: payload.cutoff_type,
          });
        } else {
          await api.createItem(RES.benefitLogs, payload);
        }
      } catch (e: unknown) {
        if (!isRecordNotUnique(e)) {
          console.warn(`[createBenefitLogs] Failed to upsert contribution for user=${payload.user_id} code=${payload.benefit_code}:`, e);
        }
      }
    });
    await runWithConcurrency(insTasks, 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP B: Handle LOANS — upsert (loan_id IS NOT NULL, unique constraint works)
  // ─────────────────────────────────────────────────────────────────────────

  // B1. Fetch existing LOAN logs for affected users in this cutoff, build lookup map.
  // ⚠️ Same as above: avoid _in filter, fetch all loans for this cutoff and filter in JS.
  const existingLoanMap = new Map<string, number>(); // key: "userId|benefitCode|loanId|payrollRunId" → record id
  const allLoans = await safeList<Record<string, unknown>>(
    RES.benefitLogs,
    {
      "filter[cutoff_id][_eq]": cutoffId,
      "filter[log_type][_eq]": "LOAN",
      fields: "benefit_log_id,user_id,benefit_code,loan_id,payroll_run_id",
      limit: 5000,
    },
    [],
  );

  for (const log of allLoans.filter(l => userIdSet.has(n(l.user_id)))) {
    const id = n(log.benefit_log_id ?? log.id);
    if (!id) continue;
    const pId = n(log.payroll_run_id);
    const key = `${n(log.user_id)}|${String(log.benefit_code).toUpperCase()}|${n(log.loan_id)}|${pId}`;
    existingLoanMap.set(key, id);
  }

  // B2. Build and upsert LOAN rows
  const loanLogs: unknown[] = [];
  for (const emp of employees) {
    const userId = n(emp.user_id);
    if (!userId) continue;

    const breakdown = normalizeJsonOrNull(emp.breakdown_json) as PayrollBreakdownJson | null;
    const deductions = (breakdown?.deductions as Record<string, unknown>) ?? {};
     const bLoansRaw = deductions?.benefit_loans;
     const benefitLoanItems = Array.isArray(bLoansRaw) ? bLoansRaw : arr<unknown>( (bLoansRaw as Record<string, unknown> | null)?.items );
 
     for (const r of benefitLoanItems) {
       const item = (r ?? {}) as Record<string, unknown>;
       const loanId = n(item.loan_id ?? item.id);
       const amt = n(item.amount_this_cutoff ?? item.amount);
       const code = String(item.benefit_code || "").toUpperCase();

      if (loanId > 0 && amt > 0 && (code === "SSS" || code === "PAGIBIG")) {
        loanLogs.push({
          cutoff_id: cutoffId,
          cutoff_start: cutoffStart,
          cutoff_end: cutoffEnd,
          cutoff_type: cutoffType,
          user_id: userId,
          benefit_code: code as BenefitCode,
          log_type: "LOAN",
          loan_id: loanId,
          source_amount: amt,
          deducted_amount: amt,
          payroll_run_id: payrollRunId,
          payroll_detail_id: null,
        });
      }
    }
  }

  if (loanLogs.length > 0) {
    const loanTasks = loanLogs.map(p => async () => {
      const payload = p as Record<string, unknown>;
      const key = `${payload.user_id}|${String(payload.benefit_code).toUpperCase()}|${n(payload.loan_id)}|${payrollRunId}`;
      const existingId = existingLoanMap.get(key);
      try {
        if (existingId) {
          await api.patchItem(RES.benefitLogs, existingId, {
            source_amount: payload.source_amount,
            deducted_amount: payload.deducted_amount,
            payroll_run_id: payload.payroll_run_id,
            payroll_detail_id: payload.payroll_detail_id,
            cutoff_start: payload.cutoff_start,
            cutoff_end: payload.cutoff_end,
            cutoff_type: payload.cutoff_type,
          });
        } else {
          await api.createItem(RES.benefitLogs, payload);
        }
      } catch (e: unknown) {
        if (!isRecordNotUnique(e)) {
          console.warn(`[createBenefitLogs] Failed to upsert loan for user=${payload.user_id} code=${payload.benefit_code} loan_id=${payload.loan_id}:`, e);
        }
      }
    });
    await runWithConcurrency(loanTasks, 10);
  }
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
  const s0 = (args.summary ?? {}) as Record<string, unknown>;

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
