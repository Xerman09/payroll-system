// modules/payroll-run/utils/compute.ts

import type {
  BenefitCode,
  EmployeeAllowance,
  EmployeeLoan,
  HolidayRow,
  ManualEntry,
  PayrollComputedLine,
  UserRow,
  WageProfile,
} from "../types";

/**
 * Currency formatter (PHP)
 */
export function formatPHP(amount: number): string {
  const v = Number(amount ?? 0);
  const safe = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

function n(v: any): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function upper(v: any): string {
  return String(v ?? "").trim().toUpperCase();
}

/**
 * IMPORTANT:
 * Your ManualEntry.type is used as the entry kind: "EARNING" | "DEDUCTION".
 * But payroll_other_deductions often has its own "type" (MANUAL/SHORTAGE).
 *
 * So we normalize a separate "category" signal here.
 */
function entryCategory(e: any): string {
  // Prefer category (our canonical field)
  const cat =
    e?.category ??
    e?.deduction_type ??
    e?.deductionType ??
    e?.other_deduction_type ??
    e?.otherDeductionType ??
    e?.deduction_kind ??
    e?.deductionKind ??
    null;

  if (cat != null && String(cat).trim() !== "") return upper(cat);

  // Fallback: if someone mistakenly stored MANUAL/SHORTAGE inside e.type (instead of EARNING/DEDUCTION)
  const t = upper(e?.type);
  if (t && t !== "EARNING" && t !== "DEDUCTION") return t;

  return "";
}

function isCategory(e: ManualEntry, cat: string) {
  return entryCategory(e) === upper(cat);
}

/**
 * Assumptions about attendance rows (from attendance_approval):
 * - date_schedule: "YYYY-MM-DD"
 * - work_minutes, late_minutes, undertime_minutes, overtime_minutes
 * - night_diff_minutes (optional / may be missing)
 */
type AttendanceApprovalRow = {
  employee_id?: number;
  date_schedule: string;
  work_minutes?: number;
  late_minutes?: number;
  undertime_minutes?: number;
  overtime_minutes?: number;
  night_diff_minutes?: number;
};

type CutoffType = "FIRST" | "SECOND" | string;

function toISODate(v: any): string {
  const t = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

function dayOfWeekISO(dateYYYYMMDD: string): number {
  const [y, m, d] = dateYYYYMMDD.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.getDay();
}

type HolidayFlags = {
  isRegularHoliday: boolean;
  isSpecialHoliday: boolean;
  isRestDay: boolean;
  holidayName?: string | null;
  holidayTypeRaw?: string | null;
};

function normalizeHolidayType(row: any): string {
  return upper(row?.holiday_type ?? row?.holidayType ?? row?.type ?? row?.holiday_kind ?? "");
}

function normalizeHolidayName(row: any): string {
  const name = row?.holiday_name ?? row?.name ?? row?.description ?? row?.title ?? "";
  return String(name ?? "").trim();
}

function buildHolidayIndex(rows: HolidayRow[]): Map<string, { type: string; name: string }> {
  const map = new Map<string, { type: string; name: string }>();
  for (const r of rows ?? []) {
    const d = toISODate((r as any)?.holiday_date ?? (r as any)?.date ?? (r as any)?.holidayDate);
    if (!d) continue;
    map.set(d, { type: normalizeHolidayType(r), name: normalizeHolidayName(r) });
  }
  return map;
}

/**
 * Rest-day logic (current V1):
 * - Treat Sunday as Rest Day.
 * - If holiday calendar explicitly labels "SUNDAY" / "REST" / "RESTDAY", honor it too.
 */
function resolveHolidayFlags(date: string, holidayIndex: Map<string, { type: string; name: string }>): HolidayFlags {
  const h = holidayIndex.get(date);
  const t = upper(h?.type ?? "");

  const isRegularHoliday = t.includes("REGULAR");
  const isSpecialHoliday = t.includes("SPECIAL");

  const explicitRest =
    t.includes("SUNDAY") || t.includes("RESTDAY") || t === "REST" || t === "RD";

  const isRestDay = explicitRest || dayOfWeekISO(date) === 0;

  return {
    isRegularHoliday,
    isSpecialHoliday,
    isRestDay,
    holidayName: h?.name ?? null,
    holidayTypeRaw: h?.type ?? null,
  };
}

function computeRates(wage: WageProfile | null) {
  const daily = n((wage as any)?.daily_wage ?? (wage as any)?.daily_rate ?? 0);
  const hourly =
    (wage as any)?.hourly_wage != null
      ? n((wage as any)?.hourly_wage)
      : daily > 0
        ? daily / 8
        : 0;
  const monthly =
    (wage as any)?.monthly_wage != null
      ? n((wage as any)?.monthly_wage)
      : daily > 0
        ? daily * 26
        : 0;

  return { daily, hourly, monthly };
}

function fullName(u: UserRow): string {
  const fn = String((u as any)?.first_name ?? (u as any)?.user_fname ?? "").trim();
  const ln = String((u as any)?.last_name ?? (u as any)?.user_lname ?? "").trim();
  const name = `${fn} ${ln}`.trim();
  return name || String((u as any)?.employee_name ?? (u as any)?.name ?? `User #${(u as any)?.id ?? "—"}`);
}

function allowanceAmountThisCutoff(a: EmployeeAllowance, cutoffType: CutoffType): number {
  const pre = (a as any)?.amount_this_cutoff;
  if (pre != null && Number.isFinite(Number(pre))) return n(pre);

  const payCycle = upper((a as any)?.pay_cycle ?? (a as any)?.payCycle ?? "");
  const amt = n((a as any)?.amount);

  if (payCycle.includes("PER_CUTOFF") || payCycle.includes("EACH_CUTOFF")) return amt;
  if (payCycle.includes("FIRST")) return upper(cutoffType) === "FIRST" ? amt : 0;
  if (payCycle.includes("SECOND")) return upper(cutoffType) === "SECOND" ? amt : 0;
  if (payCycle.includes("BOTH") || payCycle.includes("MONTH")) return amt / 2;

  return amt;
}

function computeEmployeeLoansDeduction(employeeLoans: EmployeeLoan[]) {
  let vale = 0;
  let car = 0;
  let coop = 0;

  for (const l of employeeLoans ?? []) {
    const type = upper((l as any)?.loan_type ?? (l as any)?.loanType ?? "");
    const perCutoff = n((l as any)?.monthly_payment) / 2;

    if (type.includes("VALE")) vale += perCutoff;
    else if (type.includes("CAR")) car += perCutoff;
    else if (type.includes("COOP")) coop += perCutoff;
    else vale += perCutoff;
  }

  const total = vale + car + coop;
  return { vale, car, coop, total };
}

function computeBenefitLoansDeduction(args: {
  benefitLoans: any[];
  cutoffType: CutoffType;
  cutoffId: number;
}) {
  let sss = 0;
  let pagibig = 0;

  for (const r of args.benefitLoans ?? []) {
    const status = upper(r?.status);
    if (status && status !== "ACTIVE") continue;

    const remaining = n(r?.remaining_balance);
    if (remaining <= 0) continue;

    const startCutoffId = n(r?.start_cutoff_id);
    if (startCutoffId && args.cutoffId && args.cutoffId < startCutoffId) continue;

    const benefitCode = upper(r?.benefit_code);
    const deductOn = upper(r?.deduct_on);
    const amort = n(r?.amortization_amount);

    let thisCutoff = 0;

    if (deductOn === "BOTH") thisCutoff = amort / 2;
    else if (deductOn === upper(args.cutoffType)) thisCutoff = amort;
    else thisCutoff = 0;

    if (thisCutoff <= 0) continue;

    thisCutoff = Math.min(thisCutoff, remaining);

    if (benefitCode === "SSS") sss += thisCutoff;
    else if (benefitCode === "PAGIBIG" || benefitCode === "PAG-IBIG") pagibig += thisCutoff;
  }

  const total = sss + pagibig;
  return { sss, pagibig, total };
}

function computeGovBenefits(args: {
  wage: WageProfile | null;
  benefitMultipliers: Record<BenefitCode, number>;
}) {
  const sssMonthly = n((args.wage as any)?.sss_employee ?? (args.wage as any)?.sss_contribution_monthly ?? 0);
  const phMonthly = n(
    (args.wage as any)?.philhealth_employee ?? (args.wage as any)?.philhealth_contribution_monthly ?? 0,
  );
  const piMonthly = n((args.wage as any)?.pagibig_employee ?? (args.wage as any)?.pagibig_contribution_monthly ?? 0);

  const mul = args.benefitMultipliers ?? ({} as any);

  const sss = mul.SSS ? sssMonthly * 0.5 : 0;
  const philhealth = mul.PHILHEALTH ? phMonthly * 0.5 : 0;
  const pagibig = mul.PAGIBIG ? piMonthly * 0.5 : 0;

  return { sss, philhealth, pagibig };
}

function round2(v: number) {
  return Math.round(n(v) * 100) / 100;
}

function computeHolidayAndRestPremium(args: {
  date: string;
  basePay8h: number;
  worked: boolean;
  flags: HolidayFlags;
  dailyRate: number;
}) {
  let holidayPay = 0;
  let restDayAmount = 0;

  const { isRegularHoliday, isSpecialHoliday, isRestDay } = args.flags;

  if (isRegularHoliday) {
    if (args.worked) {
      const addFactor = isRestDay ? 1.6 : 1.0;
      holidayPay += args.basePay8h * addFactor;
    } else {
      holidayPay += args.dailyRate;
    }
    return { holidayPay, restDayAmount };
  }

  if (isSpecialHoliday) {
    if (args.worked) {
      const addFactor = isRestDay ? 0.5 : 0.3;
      holidayPay += args.basePay8h * addFactor;
    }
    return { holidayPay, restDayAmount };
  }

  if (isRestDay && args.worked) {
    restDayAmount += args.basePay8h * 0.3;
  }

  return { holidayPay, restDayAmount };
}

/**
 * Main line computation
 */
export function computeEmployeeLine(args: {
  user: UserRow;
  wage: WageProfile | null;
  attendance: AttendanceApprovalRow[];
  holidays: HolidayRow[];

  cutoffStart: string;
  cutoffEnd: string;

  manualEntries: ManualEntry[];
  allowances: EmployeeAllowance[];

  departmentName: string | null;

  previousNetPay?: number;
  onHold?: boolean;

  benefitMultipliers: Record<BenefitCode, number>;
  employeeLoans: EmployeeLoan[];

  benefitLoans: any[];
  cutoffType: CutoffType;
  cutoffId: number;
}): PayrollComputedLine {
  const userId = n((args.user as any)?.id ?? (args.user as any)?.user_id);

  const rates = computeRates(args.wage);
  const dailyRate = rates.daily;
  const hourlyRate = rates.hourly;
  const monthlyRate = rates.monthly;

  let totalDaysWorked = 0;
  let totalWorkMinutes = 0;
  let lateMinutes = 0;
  let undertimeMinutes = 0;
  let overtimeMinutes = 0;
  let nightDiffMinutes = 0;

  let basicPay = 0;
  let otAmount = 0;
  let holidayPay = 0;
  let restDayAmount = 0;
  let nightDiffAmount = 0;

  const holidayIndex = buildHolidayIndex(args.holidays ?? []);
  const holidayDayItems: any[] = [];

  for (const r of args.attendance ?? []) {
    const date = toISODate((r as any)?.date_schedule);
    if (!date) continue;

    const wm = n((r as any)?.work_minutes);
    const lm = n((r as any)?.late_minutes);
    const um = n((r as any)?.undertime_minutes);
    const om = n((r as any)?.overtime_minutes);
    const ndm = n((r as any)?.night_diff_minutes);

    const worked = wm > 0;

    if (worked) totalDaysWorked += 1;

    totalWorkMinutes += wm;
    lateMinutes += lm;
    undertimeMinutes += um;
    overtimeMinutes += om;
    nightDiffMinutes += ndm;

    const baseMinutes8h = Math.max(0, Math.min(wm, 480));
    const basePay8h = (hourlyRate * baseMinutes8h) / 60;

    basicPay += basePay8h;

    const flags = resolveHolidayFlags(date, holidayIndex);

    const prem = computeHolidayAndRestPremium({
      date,
      basePay8h,
      worked,
      flags,
      dailyRate,
    });

    holidayPay += prem.holidayPay;
    restDayAmount += prem.restDayAmount;

    if (flags.isRegularHoliday || flags.isSpecialHoliday || flags.isRestDay) {
      holidayDayItems.push({
        date,
        worked,
        work_minutes: baseMinutes8h,
        base_pay: round2(basePay8h),
        holiday_type: flags.holidayTypeRaw ?? null,
        holiday_name: flags.holidayName ?? null,
        is_rest_day: flags.isRestDay,
        computed: {
          holiday_pay_add: round2(prem.holidayPay),
          rest_day_add: round2(prem.restDayAmount),
        },
      });
    }
  }

  const OT_MULT = 1.25;
  otAmount = (hourlyRate * overtimeMinutes) / 60 * OT_MULT;

  const ND_RATE = 0.1;
  nightDiffAmount = (hourlyRate * nightDiffMinutes) / 60 * ND_RATE;

  const allowanceItems = (args.allowances ?? []).map((a) => {
    const amt = allowanceAmountThisCutoff(a, args.cutoffType);
    return {
      allowance_id: n((a as any)?.allowance_id ?? (a as any)?.id),
      description: (a as any)?.description ?? null,
      pay_cycle: (a as any)?.pay_cycle ?? null,
      amount_this_cutoff: round2(amt),
    };
  });

  const allowanceTotal = allowanceItems.reduce((sum, x) => sum + n(x.amount_this_cutoff), 0);

  // Manual Entries (additions / deductions)
  const entries = Array.isArray(args.manualEntries) ? args.manualEntries : [];
  const additions = entries.filter((e) => upper((e as any)?.type) === "EARNING");
  const deductions = entries.filter((e) => upper((e as any)?.type) === "DEDUCTION");

  const manualAdditionsTotal = additions.reduce((sum, e) => sum + n((e as any)?.amount), 0);

  const drDeduction = deductions
    .filter((e) => isCategory(e, "DR_PAYMENT"))
    .reduce((sum, e) => sum + n((e as any)?.amount), 0);

  const shortageDeduction = deductions
    .filter((e) => isCategory(e, "SHORTAGE"))
    .reduce((sum, e) => sum + n((e as any)?.amount), 0);

  // Other manual deductions excluding DR_PAYMENT and SHORTAGE
  const otherManualDeductionsTotal = deductions
    .filter((e) => !isCategory(e, "DR_PAYMENT") && !isCategory(e, "SHORTAGE"))
    .reduce((sum, e) => sum + n((e as any)?.amount), 0);

  const lateDeduction = (hourlyRate * lateMinutes) / 60;
  const undertimeDeduction = (hourlyRate * undertimeMinutes) / 60;

  const empLoans = computeEmployeeLoansDeduction(args.employeeLoans ?? []);
  const benLoans = computeBenefitLoansDeduction({
    benefitLoans: args.benefitLoans ?? [],
    cutoffType: args.cutoffType,
    cutoffId: args.cutoffId,
  });

  const gov = computeGovBenefits({
    wage: args.wage,
    benefitMultipliers: args.benefitMultipliers ?? ({} as any),
  });

  const grossPay =
    basicPay +
    otAmount +
    holidayPay +
    restDayAmount +
    nightDiffAmount +
    allowanceTotal +
    manualAdditionsTotal;

  const totalDeductions =
    lateDeduction +
    undertimeDeduction +
    shortageDeduction +
    drDeduction +
    empLoans.total +
    benLoans.total +
    gov.sss +
    gov.philhealth +
    gov.pagibig +
    otherManualDeductionsTotal;

  const netPay = grossPay - totalDeductions;

  const prevNet = n(args.previousNetPay ?? 0);
  let variancePct: number | null = null;
  let varianceFlag = false;

  if (prevNet > 0) {
    variancePct = ((netPay - prevNet) / prevNet) * 100;
    varianceFlag = Math.abs(variancePct) >= 20 || Math.abs(netPay - prevNet) >= 2000;
  }

  const breakdown_json = {
    attendance: {
      total_days_worked: totalDaysWorked,
      total_work_minutes: totalWorkMinutes,
      late_minutes: lateMinutes,
      undertime_minutes: undertimeMinutes,
      overtime_minutes: overtimeMinutes,
      night_diff_minutes: nightDiffMinutes,
      flagged_days: holidayDayItems,
    },
    earnings: {
      basic_pay: round2(basicPay),
      ot_amount: round2(otAmount),
      holiday_pay: round2(holidayPay),
      rest_day_amount: round2(restDayAmount),
      night_diff_amount: round2(nightDiffAmount),
      allowance_total: round2(allowanceTotal),
      allowance_items: allowanceItems,
      manual_additions_total: round2(manualAdditionsTotal),
      manual_additions: additions.map((e) => ({
        id: (e as any)?.id ?? null,
        desc: (e as any)?.desc ?? null,
        amount: round2(n((e as any)?.amount)),
      })),
    },
    deductions: {
      late_deduction: round2(lateDeduction),
      undertime_deduction: round2(undertimeDeduction),
      shortage_deduction: round2(shortageDeduction),
      dr_deduction: round2(drDeduction),
      employee_loans: {
        vale: round2(empLoans.vale),
        car: round2(empLoans.car),
        coop: round2(empLoans.coop),
        total: round2(empLoans.total),
      },
      benefit_loans: {
        sss: round2(benLoans.sss),
        pagibig: round2(benLoans.pagibig),
        total: round2(benLoans.total),
      },
      gov_benefits: {
        sss: round2(gov.sss),
        philhealth: round2(gov.philhealth),
        pagibig: round2(gov.pagibig),
      },
      manual_deductions_total: round2(otherManualDeductionsTotal),
      manual_deductions: deductions
        .filter((e) => !isCategory(e, "DR_PAYMENT") && !isCategory(e, "SHORTAGE"))
        .map((e) => ({
          id: (e as any)?.id ?? null,
          desc: (e as any)?.desc ?? null,
          amount: round2(n((e as any)?.amount)),
          category: (e as any)?.category ?? null,
        })),
    },
  };

  const employee_name = fullName(args.user);

  const out: PayrollComputedLine = {
    user_id: userId as any,
    employee_name: employee_name as any,
    department_name: (args.departmentName ?? (args.user as any)?.department_name ?? null) as any,
    position: ((args.user as any)?.position ?? null) as any,

    daily_rate: round2(dailyRate) as any,
    hourly_rate: round2(hourlyRate) as any,
    monthly_rate: round2(monthlyRate) as any,

    total_days_worked: totalDaysWorked as any,
    total_work_minutes: totalWorkMinutes as any,
    late_minutes: lateMinutes as any,
    undertime_minutes: undertimeMinutes as any,
    overtime_minutes: overtimeMinutes as any,
    night_diff_minutes: nightDiffMinutes as any,

    basic_pay: round2(basicPay) as any,
    ot_amount: round2(otAmount) as any,
    holiday_pay: round2(holidayPay) as any,
    rest_day_amount: round2(restDayAmount) as any,
    night_diff_amount: round2(nightDiffAmount) as any,
    allowance: round2(allowanceTotal) as any,
    manual_additions: round2(manualAdditionsTotal) as any,

    late_deduction: round2(lateDeduction) as any,
    undertime_deduction: round2(undertimeDeduction) as any,
    shortage_deduction: round2(shortageDeduction) as any,

    benefit_sss: round2(gov.sss) as any,
    benefit_philhealth: round2(gov.philhealth) as any,
    benefit_pagibig: round2(gov.pagibig) as any,

    manual_deductions: round2(otherManualDeductionsTotal) as any,

    gross_pay: round2(grossPay) as any,
    total_deductions: round2(totalDeductions) as any,
    net_pay: round2(netPay) as any,

    on_hold: Boolean(args.onHold) as any,

    variance_flag: Boolean(varianceFlag) as any,
    variance_pct: variancePct == null ? null : round2(variancePct) as any,

    breakdown_json: breakdown_json as any,
  } as PayrollComputedLine;

  // Extra fields consumed by EmployeeDetailsSheet
  (out as any).dr_deduction = round2(drDeduction);
  (out as any).loan_vale = round2(empLoans.vale);
  (out as any).loan_car = round2(empLoans.car);
  (out as any).loan_coop = round2(empLoans.coop);
  (out as any).loan_total = round2(empLoans.total);

  (out as any).benefit_loan_sss = round2(benLoans.sss);
  (out as any).benefit_loan_pagibig = round2(benLoans.pagibig);
  (out as any).benefit_loan_total = round2(benLoans.total);

  return out;
}
