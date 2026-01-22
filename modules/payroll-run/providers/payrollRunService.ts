// modules/payroll-run/providers/payrollRunService.ts
import type {
  BenefitCode,
  BenefitCutoffSetting,
  CutoffSetting,
  Department,
  EmployeeLoan,
  HolidayRow,
  ManualEntry,
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollSummary,
  PayrollWorkspace,
  UserRow,
  WageProfile,
} from "../types";

import { computeEmployeeLine } from "../utils/compute";
import * as api from "./payrollApi";

export const RES = {
  payrollRun: "payroll_run",
  payrollLines: "payroll_run_employee",

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
} as const;

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
  const monthly = row.monthly_wage != null ? n(row.monthly_wage) : daily > 0 ? daily * 26 : 0;

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

async function safeList<T>(resource: string, params: Record<string, any>, fallback: T[] = []): Promise<T[]> {
  try {
    return await api.listItems<T>(resource, params);
  } catch (e) {
    console.warn(`[payrollRunService] listItems failed for ${resource} - payrollRunService.ts:171`, e);
    return fallback;
  }
}

export function isActiveByDeletedFlags(args: {
  user?: UserRow | null;
  wage?: WageProfile | null;
}): boolean {
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

export async function findExistingDraftRun(args: {
  cutoffId: number;
  departmentId: number | null;
}): Promise<PayrollRunHeader | null> {
  const { cutoffId, departmentId } = args;

  const rows = await api.listItems<any>(RES.payrollRun, {
    "filter[cutoff_id][_eq]": cutoffId,
    ...(departmentId == null ? {} : { "filter[department_id][_eq]": departmentId }),
    "filter[status][_eq]": "DRAFT",
    sort: "-payroll_run_id",
    limit: 1,
  });

  return rows?.[0] ? normalizeRunHeader(rows[0]) : null;
}

export function generatePayrollRefNo(args: { cutoff: CutoffSetting; department?: Department | null }) {
  const dep = args.department?.name ? args.department.name.toUpperCase().replace(/\s+/g, "-") : "ALL";
  return `PR-${dep}-${args.cutoff.start_date.replaceAll("-", "")}-${args.cutoff.end_date.replaceAll("-", "")}`;
}

export async function createDraftRun(args: {
  cutoff: CutoffSetting;
  departmentId: number | null;
  createdBy: number;
  payrollRefNo: string;
}): Promise<PayrollRunHeader> {
  const payload = {
    cutoff_id: args.cutoff.id,
    cutoff_type: args.cutoff.cutoff_type,
    cutoff_start: args.cutoff.start_date,
    cutoff_end: args.cutoff.end_date,
    department_id: args.departmentId,
    status: "DRAFT",
    payroll_ref_no: args.payrollRefNo,
    headcount: 0,
    total_gross: 0,
    total_deductions: 0,
    total_net: 0,
    variance_alert_count: 0,
    created_by: args.createdBy,
  };

  const created = await api.createItem<any>(RES.payrollRun, payload);
  return normalizeRunHeader(created);
}

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

  const department = departmentId == null
    ? null
    : normalizeDepartment(await api.getItem<any>(RES.departments, departmentId, {}));

  const rawEmployees = await api.listItems<any>(RES.users, {
    ...(departmentId == null ? {} : { "filter[user_department][_eq]": departmentId }),
    limit: 5000,
  });

  const employees = (rawEmployees ?? []).map(normalizeUser);
  const userIds = employees.map((u) => u.id);

  const wagesArr = userIds.length
    ? (await api.listItems<any>(RES.wages, {
      "filter[user_id][_in]": userIds.join(","),
      limit: 5000,
    })).map(normalizeWage)
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
    attendance.get(empId)!.push(row);
  }

  const holidays = await safeList<HolidayRow>(RES.holidays, {
    "filter[holiday_date][_between]": `${cutoff.start_date},${cutoff.end_date}`,
    limit: 500,
  });

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

  const manualEntries = new Map<number, ManualEntry[]>();
  function pushME(user_id: number, e: ManualEntry) {
    if (!manualEntries.has(user_id)) manualEntries.set(user_id, []);
    manualEntries.get(user_id)!.push(e);
  }

  for (const a of adds ?? []) {
    pushME(n(a.user_id), {
      id: a.id,
      cutoff_id: cutoff.id,
      user_id: n(a.user_id),
      type: "EARNING",
      desc: s(a.desc ?? a.description ?? "Manual Addition"),
      amount: n(a.amount),
      category: a.category ?? null,
    });
  }
  for (const d of deds ?? []) {
    pushME(n(d.user_id), {
      id: d.id,
      cutoff_id: cutoff.id,
      user_id: n(d.user_id),
      type: "DEDUCTION",
      desc: s(d.desc ?? d.description ?? "Manual Deduction"),
      amount: n(d.amount),
      category: d.category ?? null,
    });
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
        })
      )[0];

    benefitMultipliers[code] = effectiveSetting && effectiveSetting.cutoff === cutoff.cutoff_type ? 1 : 0;
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

  // ✅ Benefit loans:
  // Fetch ACTIVE benefit loans with balance > 0 for these users.
  // Do NOT filter by start_cutoff_id or deduct_on here, so the UI can show "why not deducted"
  // (compute.ts will decide the amount for the current cutoff).
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

  const activeEmployees = employees.filter((u) =>
    isActiveByDeletedFlags({ user: u, wage: wages.get(u.id) ?? null })
  );

  return {
    cutoff,
    department,
    employees: activeEmployees,
    wages,
    attendance,
    holidays,
    manualEntries,

    benefitSettings,
    benefitMultipliers,
    employeeLoans,
    benefitLoans,
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
    const onHold = Boolean(holdMap.get(u.id));

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
      total_gross: Math.round(totalGross * 100) / 100,
      total_deductions: Math.round(totalDeductions * 100) / 100,
      total_net: Math.round(totalNet * 100) / 100,
      variance_alerts: varianceAlerts,
    },
  };
}

export async function updateRunTotals(args: {
  payrollRunId: number;
  summary: PayrollSummary;
}): Promise<void> {
  await api.patchItem(RES.payrollRun, args.payrollRunId, {
    headcount: args.summary.headcount,
    total_gross: args.summary.total_gross,
    total_deductions: args.summary.total_deductions,
    total_net: args.summary.total_net,
    variance_alert_count: args.summary.variance_alerts,
  });
}

export async function saveLines(args: {
  payrollRunId: number;
  cutoff: CutoffSetting;
  lines: PayrollComputedLine[];
}): Promise<void> {
  const { payrollRunId, cutoff, lines } = args;
  // keep your existing implementation
}

export async function postRun(args: {
  payrollRunId: number;
  postedBy: number;
}): Promise<void> {
  await api.patchItem(RES.payrollRun, args.payrollRunId, {
    status: "POSTED",
    posted_by: args.postedBy,
    posted_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  });
}
