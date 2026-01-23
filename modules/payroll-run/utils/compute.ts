// modules/payroll-run/utils/compute.ts
import type {
  AttendanceApproval,
  BenefitCode,
  EmployeeAllowance,
  EmployeeLoan,
  HolidayRow,
  ManualEntry,
  PayrollComputedLine,
  UserRow,
  WageProfile,
  WageProrationLog,
} from "../types";

type ComputeArgs = {
  user: UserRow;
  wage: WageProfile | null;
  attendance: any[];
  holidays: HolidayRow[];
  cutoffStart: string;
  cutoffEnd: string;
  manualEntries: ManualEntry[];
  departmentName: string | null;
  previousNetPay: number;
  onHold: boolean;

  benefitMultipliers: Record<BenefitCode, number>;
  employeeLoans: EmployeeLoan[];

  benefitLoans?: any[];
  cutoffType?: "FIRST" | "SECOND";
  cutoffId?: number;

  // ✅ Allowances fetched from employee_allowance
  allowances?: EmployeeAllowance[] | any[];

  // ✅ wage proration logs for this user (effective-date driven)
  wageProrationLogs?: WageProrationLog[] | any[];
};

/**
 * Parses a cutoff value in the format "YYYY-MM-DD_YYYY-MM-DD".
 * Falls back to empty strings if malformed.
 */
export function parseCutoffValue(value: string): { start: string; end: string } {
  const parts = String(value ?? "").split("_");
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

function n(v: any): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function s(v: any): string {
  return String(v ?? "");
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function formatPHP(amount: number): string {
  const v = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function buildName(u: UserRow): string {
  const fn = s(u.first_name).trim();
  const ln = s(u.last_name).trim();
  const full = `${fn} ${ln}`.trim();
  return full || `Employee #${u.id}`;
}

function normAttendance(row: any): AttendanceApproval {
  return {
    approval_id: n(row.approval_id ?? row.approvalId ?? row.id),
    employee_id: n(row.employee_id ?? row.employeeId ?? row.user_id ?? row.userId),
    date_schedule: s(row.date_schedule ?? row.dateSchedule),
    work_minutes: n(row.work_minutes ?? row.workMinutes),
    late_minutes: n(row.late_minutes ?? row.lateMinutes),
    undertime_minutes: n(row.undertime_minutes ?? row.undertimeMinutes),
    overtime_minutes: n(row.overtime_minutes ?? row.overtimeMinutes),
    night_diff_minutes: row.night_diff_minutes ?? row.nightDiffMinutes ?? null,
    status: (row.status ?? "approved") as any,
  };
}

type HolidayKind = "regular" | "special" | "company";
type HolidayFlag = "NONE" | "REGULAR" | "SPECIAL";

type HolidayInfo = {
  date: string; // YYYY-MM-DD
  type: HolidayKind;
  description: string;
  is_paid: number; // 0/1
};

function normHoliday(row: any): HolidayInfo {
  return {
    date: s(row.holiday_date ?? row.holidayDate ?? row.date ?? row.holiday_date),
    type: String(row.holiday_type ?? row.holidayType ?? "regular").toLowerCase() as HolidayKind,
    description: s(row.description ?? row.name ?? ""),
    is_paid: n(row.is_paid ?? row.isPaid ?? 1) ? 1 : 0,
  };
}

// Priority if multiple holiday rows exist for same date: regular > special > company
function higherHoliday(a: HolidayKind, b: HolidayKind): HolidayKind {
  const rank: Record<HolidayKind, number> = { regular: 3, special: 2, company: 1 };
  return rank[a] >= rank[b] ? a : b;
}

// Rest Day rule: Sunday only (timezone-stable using UTC)
function isSunday(ymd: string): boolean {
  const d = new Date(`${ymd}T00:00:00Z`);
  return d.getUTCDay() === 0; // 0 = Sunday
}

function toHolidayFlag(h?: HolidayInfo | null): HolidayFlag {
  if (!h) return "NONE";
  const t = String(h.type ?? "").toLowerCase();
  if (t === "regular") return "REGULAR";
  if (t === "special") return "SPECIAL";
  if (t === "company") return "SPECIAL"; // treat company holiday like special
  return "NONE";
}

/**
 * Rate matrix (NO STACKING):
 * - Regular Holiday only => base=2.00, ot=2.60
 * - Rest Day only (Sunday) => base=1.30, ot=1.69
 * - Special + Rest => base=1.50, ot=1.95
 * - Regular + Rest => base=2.60, ot=3.38
 */
function getDayMultipliers(args: {
  isRestDay: boolean;
  holiday: HolidayFlag;
}): { baseMult: number; otMult: number; bucket: "NORMAL" | "REST" | "HOLIDAY" } {
  const { isRestDay, holiday } = args;

  if (isRestDay && holiday === "SPECIAL") return { baseMult: 1.5, otMult: 1.95, bucket: "HOLIDAY" };
  if (isRestDay && holiday === "REGULAR") return { baseMult: 2.6, otMult: 3.38, bucket: "HOLIDAY" };

  if (!isRestDay && holiday === "SPECIAL") return { baseMult: 1.3, otMult: 1.69, bucket: "HOLIDAY" };
  if (!isRestDay && holiday === "REGULAR") return { baseMult: 2.0, otMult: 2.6, bucket: "HOLIDAY" };

  if (isRestDay && holiday === "NONE") return { baseMult: 1.3, otMult: 1.69, bucket: "REST" };

  return { baseMult: 1.0, otMult: 1.0, bucket: "NORMAL" };
}

/* -------------------------------- Allowances -------------------------------- */

type AllowancePayCycle = "N/A" | "PER_CUTOFF" | "PER_MONTH";

type AllowanceNorm = {
  allowance_id: number;
  user_id: number;
  amount: number;
  description: string | null;

  cutoff_start: string | null;
  cutoff_end: string | null;

  is_recurring: number; // 0/1
  is_active: number; // 0/1
  pay_cycle: AllowancePayCycle;

  start_date: string | null;
  end_date: string | null;

  is_processed: number; // 0/1 (usually for one-time)
};

function normAllowance(row: any): AllowanceNorm {
  const payCycleRaw = String(row?.pay_cycle ?? row?.payCycle ?? "N/A").toUpperCase();
  const pay_cycle: AllowancePayCycle =
    payCycleRaw === "PER_CUTOFF" ? "PER_CUTOFF" : payCycleRaw === "PER_MONTH" ? "PER_MONTH" : "N/A";

  const d10 = (v: any) => {
    const x = s(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null;
  };

  return {
    allowance_id: n(row?.allowance_id ?? row?.allowanceId ?? row?.id),
    user_id: n(row?.user_id ?? row?.userId),
    amount: n(row?.amount),
    description: row?.description ?? null,

    cutoff_start: d10(row?.cutoff_start ?? row?.cutoffStart),
    cutoff_end: d10(row?.cutoff_end ?? row?.cutoffEnd),

    is_recurring: n(row?.is_recurring ?? row?.isRecurring) ? 1 : 0,
    is_active: n(row?.is_active ?? row?.isActive) ? 1 : 0,
    pay_cycle,

    start_date: d10(row?.start_date ?? row?.startDate),
    end_date: d10(row?.end_date ?? row?.endDate),

    is_processed: n(row?.is_processed ?? row?.isProcessed) ? 1 : 0,
  };
}

function overlapsWindow(args: { cutoffStart: string; cutoffEnd: string; start?: string | null; end?: string | null }) {
  const { cutoffStart, cutoffEnd } = args;
  const start = args.start ?? null;
  const end = args.end ?? null;

  if (start && start > cutoffEnd) return false;
  if (end && end < cutoffStart) return false;
  return true;
}

function allowanceAmountForCutoff(args: {
  allowances: any[];
  cutoffStart: string;
  cutoffEnd: string;
  cutoffType?: string;
}): { total: number; items: any[] } {
  const cutoffType = String(args.cutoffType ?? "").toUpperCase(); // FIRST|SECOND|"" (optional)

  const rows = (Array.isArray(args.allowances) ? args.allowances : []).map(normAllowance);

  const items: Array<{
    allowance_id: number;
    description: string | null;
    pay_cycle: AllowancePayCycle;
    is_recurring: number;
    amount_full: number;
    amount_this_cutoff: number;
    source: "RECURRING" | "ONE_TIME";
  }> = [];

  for (const a of rows) {
    if (a.amount <= 0) continue;

    // One-time allowance: cutoff_start/cutoff_end match cutoff, usually processed once
    if (!a.is_recurring) {
      if (a.is_processed) continue;
      if (!a.cutoff_start || !a.cutoff_end) continue;
      if (a.cutoff_start !== args.cutoffStart) continue;
      if (a.cutoff_end !== args.cutoffEnd) continue;

      items.push({
        allowance_id: a.allowance_id,
        description: a.description,
        pay_cycle: a.pay_cycle,
        is_recurring: 0,
        amount_full: round2(a.amount),
        amount_this_cutoff: round2(a.amount),
        source: "ONE_TIME",
      });
      continue;
    }

    // Recurring allowance
    if (!a.is_active) continue;
    if (a.pay_cycle === "N/A") continue;

    // window filter (start_date/end_date overlaps cutoff)
    if (
      !overlapsWindow({
        cutoffStart: args.cutoffStart,
        cutoffEnd: args.cutoffEnd,
        start: a.start_date,
        end: a.end_date,
      })
    ) {
      continue;
    }

    // PER_CUTOFF: pay full amount each cutoff
    if (a.pay_cycle === "PER_CUTOFF") {
      items.push({
        allowance_id: a.allowance_id,
        description: a.description,
        pay_cycle: a.pay_cycle,
        is_recurring: 1,
        amount_full: round2(a.amount),
        amount_this_cutoff: round2(a.amount),
        source: "RECURRING",
      });
      continue;
    }

    // PER_MONTH: split across cutoffs (assumes semi-monthly payroll)
    if (a.pay_cycle === "PER_MONTH") {
      const half = round2(a.amount / 2);

      // If cutoffType is not provided, still split 50/50 to avoid overpaying in one cutoff.
      const amountThisCutoff =
        cutoffType === "FIRST" || cutoffType === "SECOND" || !cutoffType ? half : half;

      items.push({
        allowance_id: a.allowance_id,
        description: a.description,
        pay_cycle: a.pay_cycle,
        is_recurring: 1,
        amount_full: round2(a.amount),
        amount_this_cutoff: round2(amountThisCutoff),
        source: "RECURRING",
      });
      continue;
    }
  }

  const total = round2(items.reduce((sum, x) => sum + n(x.amount_this_cutoff), 0));
  return { total, items };
}

/* ------------------------------ Benefit loans ------------------------------ */

function normBenefitLoan(row: any) {
  return {
    loan_id: n(row.loan_id ?? row.id),
    user_id: n(row.user_id),
    benefit_code: String(row.benefit_code ?? "").toUpperCase(),
    loan_name: row.loan_name ?? null,
    reference_no: row.reference_no ?? null,
    amortization_amount: n(row.amortization_amount),
    deduct_on: String(row.deduct_on ?? "BOTH").toUpperCase(), // FIRST|SECOND|BOTH
    start_cutoff_id: n(row.start_cutoff_id),
    remaining_balance: n(row.remaining_balance),
    last_paid_cutoff_id: row.last_paid_cutoff_id == null ? null : n(row.last_paid_cutoff_id),
    status: String(row.status ?? "ACTIVE").toUpperCase(),
  };
}

function benefitLoanAmountForCutoff(args: {
  loan: ReturnType<typeof normBenefitLoan>;
  cutoffType: string;
}): number {
  const deductOn = String(args.loan.deduct_on ?? "BOTH").toUpperCase();
  const amort = n(args.loan.amortization_amount);

  if (amort <= 0) return 0;
  if (deductOn === "BOTH") return round2(amort / 2);
  if (!args.cutoffType) return 0;
  return deductOn === args.cutoffType ? round2(amort) : 0;
}

/* ------------------------- Wage proration (existing) ------------------------- */

function buildDailyRateResolver(args: { wage: WageProfile | null; wageProrationLogs?: any[] }) {
  const wage = args.wage;

  let baseDaily = (() => {
    const d = n((wage as any)?.daily_wage);
    if (d > 0) return d;

    const h = n((wage as any)?.hourly_wage);
    if (h > 0) return h * 8;

    const m = n((wage as any)?.monthly_wage);
    if (m > 0) return m / 26;

    return 0;
  })();

  const eqMoney = (a: number, b: number) => Math.abs(a - b) < 0.005;

  const pickFirstNumber = (row: any, keys: string[]): number => {
    for (const k of keys) {
      const v = n(row?.[k]);
      if (v > 0) return v;
    }
    return 0;
  };

  const toDailyFromMonthly = (monthly: number) => (monthly > 0 ? monthly / 26 : 0);

  const parseEffectiveDate = (row: any): string => {
    const v =
      row?.effective_date ??
      row?.effectivity_date ??
      row?.effectiveDate ??
      row?.effectivityDate ??
      row?.date_effective ??
      row?.effectiveFrom ??
      row?.effective_from ??
      row?.start_date ??
      row?.date ??
      "";
    const d = s(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
  };

  const logs = Array.isArray(args.wageProrationLogs) ? args.wageProrationLogs : [];

  let events = logs
    .map((row: any) => {
      const effective_date = parseEffectiveDate(row);
      if (!effective_date) return null;

      let old_daily = pickFirstNumber(row, [
        "previous_daily_wage",
        "previous_daily_rate",
        "old_daily_wage",
        "old_daily_rate",
        "from_daily_wage",
        "old_daily",
        "old_daily_rate",
        "old_rate_daily",
        "prev_daily",
        "daily_old",
      ]);

      let new_daily = pickFirstNumber(row, [
        "new_daily_wage",
        "new_daily_rate",
        "to_daily_wage",
        "new_daily",
        "new_daily_rate",
        "new_rate_daily",
        "daily_new",
      ]);

      if (old_daily <= 0) {
        const old_monthly = pickFirstNumber(row, [
          "old_monthly_wage",
          "previous_monthly_wage",
          "from_monthly_wage",
          "old_basic",
          "old_monthly",
        ]);
        old_daily = toDailyFromMonthly(old_monthly);
      }

      if (new_daily <= 0) {
        const new_monthly = pickFirstNumber(row, [
          "new_monthly_wage",
          "to_monthly_wage",
          "new_basic",
          "new_monthly",
        ]);
        new_daily = toDailyFromMonthly(new_monthly);
      }

      if (old_daily <= 0) old_daily = baseDaily;
      if (new_daily <= 0) new_daily = baseDaily;

      return {
        effective_date,
        old_daily: round2(old_daily),
        new_daily: round2(new_daily),
        created_at: row?.created_at ?? row?.date_created ?? null,
        id: n(row?.id),
      };
    })
    .filter(Boolean) as Array<{
      effective_date: string;
      old_daily: number;
      new_daily: number;
      created_at: any;
      id: number;
    }>;

  events.sort((a, b) => {
    if (a.effective_date !== b.effective_date) return a.effective_date < b.effective_date ? -1 : 1;
    const ac = a.created_at ? String(a.created_at) : "";
    const bc = b.created_at ? String(b.created_at) : "";
    if (ac !== bc) return ac < bc ? -1 : 1;
    return (a.id ?? 0) - (b.id ?? 0);
  });

  const byDate = new Map<string, typeof events[number]>();
  for (const ev of events) byDate.set(ev.effective_date, ev);
  events = Array.from(byDate.values()).sort((a, b) => (a.effective_date < b.effective_date ? -1 : 1));

  if (baseDaily <= 0 && events.length) {
    baseDaily = events[events.length - 1].new_daily || events[0].old_daily || 0;
  }

  if (events.length && baseDaily > 0) {
    let current = round2(baseDaily);
    const chain: typeof events = [];

    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (eqMoney(ev.new_daily, current)) {
        chain.unshift(ev);
        current = ev.old_daily > 0 ? ev.old_daily : current;
      }
    }

    if (chain.length) events = chain;
  }

  function dailyForDate(ymd: string): number {
    if (!baseDaily || baseDaily <= 0) return 0;
    if (!events.length) return baseDaily;

    let applied: (typeof events)[number] | null = null;
    for (const ev of events) {
      if (ev.effective_date <= ymd) applied = ev;
      else break;
    }

    if (applied) return applied.new_daily > 0 ? applied.new_daily : baseDaily;

    const first = events[0];
    return first?.old_daily > 0 ? first.old_daily : baseDaily;
  }

  function hourlyForDate(ymd: string): number {
    const d = dailyForDate(ymd);
    return d > 0 ? d / 8 : 0;
  }

  function minuteRateForDate(ymd: string): number {
    const d = dailyForDate(ymd);
    return d > 0 ? d / 480 : 0;
  }

  return {
    baseDaily: round2(baseDaily),
    events: events.map((e) => ({
      effective_date: e.effective_date,
      old_daily: round2(e.old_daily),
      new_daily: round2(e.new_daily),
    })),
    dailyForDate,
    hourlyForDate,
    minuteRateForDate,
  };
}

/* --------------------------------- Helpers --------------------------------- */

function upper(v: any): string {
  return String(v ?? "").trim().toUpperCase();
}

function isDRPaymentManualEntry(m: any): boolean {
  const cat = String(m?.category ?? m?.deduction_type ?? m?.other_deduction_type ?? m?.deductionKind ?? "")
    .trim()
    .toLowerCase();
  if (cat === "dr_payment") return true;

  const desc = String(m?.desc ?? m?.description ?? "").trim().toLowerCase();
  return desc.startsWith("dr payment:");
}

/* -------------------------------- Compute -------------------------------- */

export function computeEmployeeLine(args: ComputeArgs): PayrollComputedLine {
  const empName = buildName(args.user);

  const dailyBase = n(args.wage?.daily_wage);
  const hourlyBase =
    args.wage?.hourly_wage != null ? n(args.wage.hourly_wage) : dailyBase > 0 ? dailyBase / 8 : 0;

  const monthlyBase =
    args.wage?.monthly_wage != null ? n(args.wage.monthly_wage) : dailyBase > 0 ? dailyBase * 26 : 0;

  const rate = buildDailyRateResolver({
    wage: args.wage,
    wageProrationLogs: (args.wageProrationLogs ?? []) as any[],
  });

  const att = (args.attendance ?? [])
    .map(normAttendance)
    .filter((r) => String(r.status ?? "").toLowerCase() === "approved");

  const holidayMap = new Map<string, HolidayInfo>();
  for (const h of (args.holidays ?? []).map(normHoliday)) {
    if (!h.date) continue;
    const existing = holidayMap.get(h.date);
    if (!existing) {
      holidayMap.set(h.date, h);
      continue;
    }
    const bestType = higherHoliday(existing.type, h.type);
    holidayMap.set(h.date, {
      ...existing,
      type: bestType,
      is_paid: existing.is_paid || h.is_paid ? 1 : 0,
      description: existing.description || h.description,
    });
  }

  const attendedDates = new Set(att.map((r) => r.date_schedule));

  let totalWorkMinutes = 0;
  let lateMinutes = 0;
  let undertimeMinutes = 0;
  let overtimeMinutes = 0;
  let nightDiffMinutes = 0;

  let basicPay = 0;
  let otAmount = 0;

  let holidayPay = 0;
  let restDayAmount = 0;

  let lateDeduction = 0;
  let undertimeDeduction = 0;

  let nightDiffAmount = 0;

  const holidayItems: Array<any> = [];
  const restDayItems: Array<any> = [];

  for (const r of att) {
    const date = r.date_schedule;

    const dayDaily = rate.dailyForDate(date);
    const dayMR = rate.minuteRateForDate(date);
    const dayHourly = rate.hourlyForDate(date);

    const h = holidayMap.get(date) ?? null;
    const holidayFlag = toHolidayFlag(h);
    const rd = isSunday(date);

    const wmRaw = n(r.work_minutes);
    const omRaw = n(r.overtime_minutes);

    const baseMin = Math.min(wmRaw, 480);
    const otMin = Math.max(omRaw, Math.max(0, wmRaw - 480));

    const lm = n(r.late_minutes);
    const um = n(r.undertime_minutes);
    const ndm = r.night_diff_minutes == null ? 0 : n(r.night_diff_minutes);

    totalWorkMinutes += wmRaw;
    overtimeMinutes += otMin;
    nightDiffMinutes += ndm;

    const { baseMult, otMult, bucket } = getDayMultipliers({
      isRestDay: rd,
      holiday: holidayFlag,
    });

    const basePay = round2(baseMin * dayMR * baseMult);
    const otPay = round2(otMin * dayMR * otMult);
    const dayTotal = round2(basePay + otPay);

    if (ndm > 0 && dayHourly > 0) {
      nightDiffAmount += round2((ndm / 60) * dayHourly * 0.1);
    }

    if (bucket === "NORMAL") {
      lateMinutes += lm;
      undertimeMinutes += um;

      if (lm > 0 && dayHourly > 0) lateDeduction += round2((lm / 60) * dayHourly);
      if (um > 0 && dayHourly > 0) undertimeDeduction += round2((um / 60) * dayHourly);

      basicPay += basePay;
      otAmount += otPay;
    } else if (bucket === "REST") {
      restDayAmount += dayTotal;
      restDayItems.push({
        date,
        base_minutes: baseMin,
        ot_minutes: otMin,
        base_mult: baseMult,
        ot_mult: otMult,
        pay: basePay,
        ot_pay: otPay,
        total: dayTotal,
        daily_rate_used: dayDaily,
        minute_rate_used: dayMR,
      });
    } else {
      holidayPay += dayTotal;
      holidayItems.push({
        date,
        holiday: holidayFlag,
        is_rest_day: rd,
        base_minutes: baseMin,
        ot_minutes: otMin,
        base_mult: baseMult,
        ot_mult: otMult,
        pay: basePay,
        ot_pay: otPay,
        total: dayTotal,
        description: h?.description ?? "",
        pay_type: "WORKED_PREMIUM",
        daily_rate_used: dayDaily,
        minute_rate_used: dayMR,
      });
    }
  }

  basicPay = round2(basicPay);
  otAmount = round2(otAmount);
  holidayPay = round2(holidayPay);
  restDayAmount = round2(restDayAmount);
  lateDeduction = round2(lateDeduction);
  undertimeDeduction = round2(undertimeDeduction);
  nightDiffAmount = round2(nightDiffAmount);

  // Paid holidays with NO attendance row: pay = Daily Rate (no premium)
  for (const [date, h] of holidayMap.entries()) {
    if (!h.is_paid) continue;
    if (attendedDates.has(date)) continue;

    const dayDaily = rate.dailyForDate(date);
    const pay = round2(dayDaily);

    holidayPay = round2(holidayPay + pay);

    holidayItems.push({
      date,
      holiday: toHolidayFlag(h),
      is_rest_day: isSunday(date),
      base_minutes: 0,
      ot_minutes: 0,
      base_mult: 1.0,
      ot_mult: 0,
      pay,
      ot_pay: 0,
      total: pay,
      description: h.description,
      pay_type: "UNWORKED_HOLIDAY_PAY",
      daily_rate_used: dayDaily,
      minute_rate_used: dayDaily > 0 ? dayDaily / 480 : 0,
    });
  }

  const totalDaysWorked = totalWorkMinutes > 0 ? round2(totalWorkMinutes / 480) : 0;

  /* ------------------------------ Manual entries ------------------------------ */

  const manualAdds = (args.manualEntries ?? [])
    .filter((m) => upper(m.type) === "EARNING")
    .reduce((sum, m: any) => sum + n(m.amount), 0);

  const manualDeductionEntries = (args.manualEntries ?? []).filter((m) => upper((m as any)?.type) === "DEDUCTION");

  const manualDedsAll = manualDeductionEntries.reduce((sum, m: any) => sum + n(m.amount), 0);

  const drDeduction = round2(
    manualDeductionEntries.filter((m: any) => isDRPaymentManualEntry(m)).reduce((sum, m: any) => sum + n(m.amount), 0),
  );

  const shortageDeduction = round2(
    manualDeductionEntries
      .filter((m: any) => !isDRPaymentManualEntry(m))
      .filter((m: any) => {
        const cat = s((m as any)?.category).trim().toLowerCase();
        const desc = s((m as any)?.desc).trim().toLowerCase();
        return cat === "shortage" || desc.includes("shortage");
      })
      .reduce((sum, m: any) => sum + n(m.amount), 0),
  );

  const manualDeductions = round2(manualDedsAll);

  // "other_deductions" = manual deductions excluding shortage and DR payments
  const otherDeductions = round2(manualDeductions - shortageDeduction - drDeduction);

  /* ------------------------------ Govt benefits ------------------------------ */

  const multSSS = n(args.benefitMultipliers?.SSS ?? 0);
  const multPhil = n(args.benefitMultipliers?.PHILHEALTH ?? 0);
  const multPagibig = n(args.benefitMultipliers?.PAGIBIG ?? 0);

  const sssMonthly = n((args.wage as any)?.sss_employee);
  const philMonthly = n((args.wage as any)?.philhealth_employee);
  const pagibigMonthly = n((args.wage as any)?.pagibig_employee);

  const benefitSSS = round2(sssMonthly * multSSS);
  const benefitPhilhealth = round2(philMonthly * multPhil);
  const benefitPagibig = round2(pagibigMonthly * multPagibig);

  /* --------------------------- Employee loans 50/50 --------------------------- */

  const loanHalf = (monthlyPayment: number) => round2(n(monthlyPayment) / 2);

  let loanVale = 0;
  let loanCar = 0;
  let loanCoop = 0;

  for (const L of args.employeeLoans ?? []) {
    const half = loanHalf((L as any).monthly_payment);
    const lt = String((L as any).loan_type ?? "").toUpperCase();
    if (lt === "VALE") loanVale += half;
    else if (lt === "CAR LOAN") loanCar += half;
    else if (lt === "COOP") loanCoop += half;
  }

  loanVale = round2(loanVale);
  loanCar = round2(loanCar);
  loanCoop = round2(loanCoop);

  const loanTotal = round2(loanVale + loanCar + loanCoop);

  /* ----------------------- Benefit loans (SSS/PAGIBIG) ----------------------- */

  const cutoffType = String(args.cutoffType ?? "").toUpperCase();
  const cutoffId = n(args.cutoffId);

  const bLoansNorm = (args.benefitLoans ?? []).map(normBenefitLoan);

  const bLoansEffective = bLoansNorm.filter((x) => {
    if (String(x.status).toUpperCase() !== "ACTIVE") return false;
    if (n(x.remaining_balance) <= 0) return false;

    if (cutoffId > 0 && n(x.start_cutoff_id) > cutoffId) return false;
    if (cutoffId > 0 && x.last_paid_cutoff_id != null && n(x.last_paid_cutoff_id) === cutoffId) return false;

    const deductOn = String(x.deduct_on ?? "BOTH").toUpperCase();
    if (deductOn === "BOTH") return true;
    if (!cutoffType) return false;
    return deductOn === cutoffType;
  });

  const bLoanItems = bLoansEffective.map((x) => {
    const amount = benefitLoanAmountForCutoff({ loan: x, cutoffType });
    return {
      loan_id: x.loan_id,
      benefit_code: x.benefit_code,
      loan_name: x.loan_name,
      reference_no: x.reference_no,
      amortization_amount: x.amortization_amount,
      deduct_on: x.deduct_on,
      amount_this_cutoff: amount,
    };
  });

  const benefitLoanSSS = round2(
    bLoanItems.filter((x) => x.benefit_code === "SSS").reduce((sum, x) => sum + n(x.amount_this_cutoff), 0),
  );

  const benefitLoanPagibig = round2(
    bLoanItems.filter((x) => x.benefit_code === "PAGIBIG").reduce((sum, x) => sum + n(x.amount_this_cutoff), 0),
  );

  const benefitLoanTotal = round2(benefitLoanSSS + benefitLoanPagibig);

  /* ------------------------------- Allowances ------------------------------- */

  const allowanceCalc = allowanceAmountForCutoff({
    allowances: (args.allowances ?? []) as any[],
    cutoffStart: args.cutoffStart,
    cutoffEnd: args.cutoffEnd,
    cutoffType,
  });

  const allowance = round2(allowanceCalc.total);
  const allowanceItems = allowanceCalc.items.map((x) => ({
    allowance_id: x.allowance_id,
    description: x.description,
    pay_cycle: x.pay_cycle,
    is_recurring: x.is_recurring,
    amount_full: x.amount_full,
    amount_this_cutoff: x.amount_this_cutoff,
    source: x.source,
  }));

  /* -------------------------------- Totals -------------------------------- */

  const retroPay = 0;

  const grossPay = round2(
    basicPay + otAmount + holidayPay + restDayAmount + nightDiffAmount + allowance + retroPay + manualAdds,
  );

  // totalDeductions adds shortage + dr + other_deductions such that manual deductions are counted once overall
  const totalDeductions = round2(
    lateDeduction +
    undertimeDeduction +
    shortageDeduction +
    loanTotal +
    benefitLoanTotal +
    benefitSSS +
    benefitPhilhealth +
    benefitPagibig +
    drDeduction +
    otherDeductions,
  );

  const netPay = round2(grossPay - totalDeductions);

  const prev = n(args.previousNetPay);
  const variancePct = prev > 0 ? round2(((netPay - prev) / prev) * 100) : null;
  const varianceFlag = prev > 0 && Math.abs(n(variancePct)) >= 10;

  return {
    user_id: (args.user as any).id,
    employee_name: empName,
    position: (args.user as any).position ?? null,
    department_name: args.departmentName ?? null,

    daily_rate: round2(dailyBase),
    hourly_rate: round2(hourlyBase),
    monthly_rate: round2(monthlyBase),

    total_days_worked: totalDaysWorked,
    total_work_minutes: totalWorkMinutes,
    late_minutes: lateMinutes,
    undertime_minutes: undertimeMinutes,
    overtime_minutes: overtimeMinutes,
    night_diff_minutes: nightDiffMinutes,

    basic_pay: round2(basicPay),
    ot_amount: round2(otAmount),
    holiday_pay: round2(holidayPay),
    rest_day_amount: round2(restDayAmount),
    night_diff_amount: nightDiffAmount,

    allowance,
    retro_pay: retroPay,
    manual_additions: round2(manualAdds),

    late_deduction: lateDeduction,
    undertime_deduction: undertimeDeduction,
    shortage_deduction: shortageDeduction,

    benefit_sss: benefitSSS,
    benefit_philhealth: benefitPhilhealth,
    benefit_pagibig: benefitPagibig,

    loan_vale: loanVale,
    loan_car: loanCar,
    loan_coop: loanCoop,
    loan_total: loanTotal,

    benefit_loan_sss: benefitLoanSSS,
    benefit_loan_pagibig: benefitLoanPagibig,
    benefit_loan_total: benefitLoanTotal,

    dr_deduction: drDeduction,
    other_deductions: otherDeductions,
    manual_deductions: manualDeductions,

    total_additions: round2(manualAdds + allowance + retroPay + holidayPay + restDayAmount + nightDiffAmount + otAmount),
    total_deductions: totalDeductions,
    gross_pay: grossPay,
    net_pay: netPay,

    previous_net_pay: prev,
    variance_pct: variancePct,
    variance_flag: varianceFlag,

    on_hold: Boolean(args.onHold),

    breakdown_json: {
      rates: {
        base_daily: round2(rate.baseDaily),
        base_hourly: round2(rate.baseDaily > 0 ? rate.baseDaily / 8 : 0),
        base_minute_rate: round2(rate.baseDaily > 0 ? rate.baseDaily / 480 : 0),
        wage_profile: {
          daily: round2(dailyBase),
          hourly: round2(hourlyBase),
          monthly: round2(monthlyBase),
        },
        daily_rate_events: rate.events,
        policy: "Per-date daily/hourly/minute rate derived from wage proration logs when available; otherwise wage profile.",
      },
      earnings: {
        basic_pay: round2(basicPay),
        ot_amount: round2(otAmount),
        holiday_pay: round2(holidayPay),
        rest_day_amount: round2(restDayAmount),
        night_diff_amount: round2(nightDiffAmount),

        allowance_total: round2(allowance),
        allowance_items: allowanceItems,

        manual_additions: round2(manualAdds),

        holiday_items: holidayItems,
        rest_day_items: restDayItems,
      },
      deductions: {
        late_deduction: round2(lateDeduction),
        undertime_deduction: round2(undertimeDeduction),

        shortage_deduction: round2(shortageDeduction),
        dr_deduction: round2(drDeduction),

        employee_loans: {
          rule: "50/50 per cutoff",
          vale: round2(loanVale),
          car_loan: round2(loanCar),
          coop: round2(loanCoop),
          total: round2(loanTotal),
        },
        benefit_loans: {
          rule: 'If deduct_on="BOTH" then 50/50 per cutoff; else deduct full on matching cutoff',
          sss: round2(benefitLoanSSS),
          pagibig: round2(benefitLoanPagibig),
          total: round2(benefitLoanTotal),
          items: bLoanItems,
        },
        benefits: {
          rule: "benefit_cutoff_settings",
          multipliers: { SSS: multSSS, PHILHEALTH: multPhil, PAGIBIG: multPagibig },
          sss: round2(benefitSSS),
          philhealth: round2(benefitPhilhealth),
          pagibig: round2(benefitPagibig),
        },
        other_deductions: round2(otherDeductions),
        manual_deductions: round2(manualDeductions),
      },
      totals: {
        gross_pay: round2(grossPay),
        total_deductions: round2(totalDeductions),
        net_pay: round2(netPay),
      },
      cutoff: {
        start: args.cutoffStart,
        end: args.cutoffEnd,
        type: args.cutoffType,
        id: args.cutoffId,
      },
      flags: { on_hold: Boolean(args.onHold), variance_flag: Boolean(varianceFlag) },
    },
  } as any;
}
