// modules/payroll-run/utils/compute.ts
import type {
  BenefitCode,
  CoopSavingsMembershipRow,
  EmployeeAllowance,
  EmployeeLoan,
  HolidayRow,
  ManualEntry,
  PayrollComputedLine,
  RetroPayRow,
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

  // ✅ Option B tables (dedicated collections)
  retroPays?: RetroPayRow[] | any[];
  coopSavingsMemberships?: CoopSavingsMembershipRow[] | any[];
};

/**
 * Parses a cutoff value in the format "YYYY-MM-DD_YYYY-MM-DD".
 * Falls back to empty strings if malformed.
 */
export function parseCutoffValue(value: string): { start: string; end: string } {
  const parts = String(value ?? "").split("_");
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

function s(v: any): string {
  return String(v ?? "");
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function ymdOrNull(v: any): string | null {
  const x = s(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null;
}

function inRange(ymd: string, start: string, end: string): boolean {
  if (!ymd || !start || !end) return false;
  return ymd >= start && ymd <= end;
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

function n(v: any): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function normKey(v: any): string {
  return String(v ?? "")
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, "")
    .trim();
}

function matchesAny(label: any, needles: string[]): boolean {
  const k = normKey(label);
  return needles.some((x) => k.includes(normKey(x)));
}

function overlapsWindow(args: {
  cutoffStart: string;
  cutoffEnd: string;
  start?: string | null;
  end?: string | null;
}) {
  const { cutoffStart, cutoffEnd } = args;
  const start = args.start ?? null;
  const end = args.end ?? null;

  if (start && start > cutoffEnd) return false;
  if (end && end < cutoffStart) return false;
  return true;
}

/* ---------------------------- user display helpers ---------------------------- */

function buildName(u: UserRow): string {
  const fn = s((u as any).first_name).trim();
  const ln = s((u as any).last_name).trim();
  const full = `${fn} ${ln}`.trim();
  return full || `Employee #${(u as any).id}`;
}

function resolvePosition(u: UserRow): string | null {
  const raw =
    (u as any).position ??
    (u as any).position_name ??
    (u as any).user_position ??
    (u as any).userPosition ??
    (u as any).job_title ??
    (u as any).jobTitle ??
    null;
  const v = raw == null ? "" : String(raw).trim();
  return v ? v : null;
}

/**
 * ✅ Department name resolver (covers common Directus/user shapes)
 */
function resolveDepartmentName(args: { user: UserRow; fallback: string | null }): string | null {
  if (args.fallback && String(args.fallback).trim()) return String(args.fallback).trim();

  const u: any = args.user;

  const candidates: any[] = [
    u.department_name,
    u.departmentName,
    u.department,
    u.department_text,
    u.departmentText,

    u.user_department?.department_name,
    u.user_department?.name,
    u.department_rel?.department_name,
    u.department_rel?.name,
    u.department_obj?.department_name,
    u.department_obj?.name,
    u.department_info?.department_name,
    u.department_info?.name,

    u.department_id?.department_name,
    u.department_id?.name,
  ];

  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === "string") {
      const v = c.trim();
      if (v) return v;
    }
  }

  return null;
}

/* ------------------------------- normalize rows ------------------------------ */

type AttendanceNorm = {
  approval_id: number;
  employee_id: number;
  date_schedule: string;
  work_minutes: number;
  late_minutes: number;
  undertime_minutes: number;
  overtime_minutes: number;
  night_diff_minutes: number | null;
  status: string;
};

function normAttendance(row: any): AttendanceNorm {
  const date = ymdOrNull(row.date_schedule ?? row.dateSchedule) ?? "";

  return {
    approval_id: n(row.approval_id ?? row.approvalId ?? row.id),
    employee_id: n(row.employee_id ?? row.employeeId ?? row.user_id ?? row.userId),
    date_schedule: date, // ✅ normalized YYYY-MM-DD
    work_minutes: n(row.work_minutes ?? row.workMinutes),
    late_minutes: n(row.late_minutes ?? row.lateMinutes),
    undertime_minutes: n(row.undertime_minutes ?? row.undertimeMinutes),
    overtime_minutes: n(row.overtime_minutes ?? row.overtimeMinutes),
    night_diff_minutes: row.night_diff_minutes ?? row.nightDiffMinutes ?? null,
    status: String(row.status ?? "approved"),
  };
}


type HolidayKind = "regular" | "special" | "company";
type HolidayFlag = "NONE" | "REGULAR" | "SPECIAL";

type HolidayInfo = {
  date: string; // YYYY-MM-DD
  type: HolidayKind;
  description: string;
  is_paid: number; // 0/1
  last_working_day: string | null;
};

function normHoliday(row: any): HolidayInfo {
  return {
    date: ymdOrNull(row.holiday_date ?? row.holidayDate ?? row.date ?? row.holiday_date) ?? "",
    type: String(row.holiday_type ?? row.holidayType ?? "regular").toLowerCase() as HolidayKind,
    description: s(row.description ?? row.name ?? ""),
    is_paid: n(row.is_paid ?? row.isPaid ?? 1) ? 1 : 0,
    last_working_day: ymdOrNull(row.last_working_day ?? row.lastWorkingDay),
  };
}


function higherHoliday(a: HolidayKind, b: HolidayKind): HolidayKind {
  const rank: Record<HolidayKind, number> = { regular: 3, special: 2, company: 1 };
  return rank[a] >= rank[b] ? a : b;
}

// Rest Day rule: Sunday only (timezone-stable)
function isSunday(ymd: string): boolean {
  const d = new Date(`${ymd}T00:00:00Z`);
  return d.getUTCDay() === 0;
}

function toHolidayFlag(h?: HolidayInfo | null): HolidayFlag {
  if (!h) return "NONE";
  const t = String(h.type ?? "").toLowerCase();
  if (t === "regular") return "REGULAR";
  if (t === "special") return "SPECIAL";
  if (t === "company") return "SPECIAL";
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

  return { baseMult: 1.0, otMult: 1.25, bucket: "NORMAL" };
}

/* ------------------------------ Allowances ------------------------------ */

type AllowancePayCycle = "N/A" | "PER_CUTOFF" | "PER_MONTH";

type AllowanceNorm = {
  allowance_id: number;
  user_id: number;
  amount: number;
  description: string | null;

  cutoff_start: string | null;
  cutoff_end: string | null;

  is_recurring: number;
  is_active: number;
  pay_cycle: AllowancePayCycle;

  start_date: string | null;
  end_date: string | null;

  is_processed: number;
};

function normAllowance(row: any): AllowanceNorm {
  const payCycleRaw = String(row?.pay_cycle ?? row?.payCycle ?? "N/A").toUpperCase();
  const pay_cycle: AllowancePayCycle =
    payCycleRaw === "PER_CUTOFF" ? "PER_CUTOFF" : payCycleRaw === "PER_MONTH" ? "PER_MONTH" : "N/A";

  return {
    allowance_id: n(row?.allowance_id ?? row?.allowanceId ?? row?.id),
    user_id: n(row?.user_id ?? row?.userId),
    amount: n(row?.amount),
    description: row?.description ?? null,

    cutoff_start: ymdOrNull(row?.cutoff_start ?? row?.cutoffStart),
    cutoff_end: ymdOrNull(row?.cutoff_end ?? row?.cutoffEnd),

    is_recurring: n(row?.is_recurring ?? row?.isRecurring) ? 1 : 0,
    is_active: n(row?.is_active ?? row?.isActive) ? 1 : 0,
    pay_cycle,

    start_date: ymdOrNull(row?.start_date ?? row?.startDate),
    end_date: ymdOrNull(row?.end_date ?? row?.endDate),

    is_processed: n(row?.is_processed ?? row?.isProcessed) ? 1 : 0,
  };
}

function allowanceAmountForCutoff(args: {
  allowances: any[];
  cutoffStart: string;
  cutoffEnd: string;
  cutoffType?: string;
}): { total: number; items: any[] } {
  const cutoffType = String(args.cutoffType ?? "").toUpperCase();
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

    // ONE-TIME: must match cutoff window + not yet processed
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

    // RECURRING
    if (!a.is_active) continue;
    if (a.pay_cycle === "N/A") continue;

    if (!overlapsWindow({ cutoffStart: args.cutoffStart, cutoffEnd: args.cutoffEnd, start: a.start_date, end: a.end_date }))
      continue;

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

    if (a.pay_cycle === "PER_MONTH") {
      const isSecond = cutoffType === "SECOND";
      const amountThisCutoff = isSecond ? a.amount : 0;

      if (amountThisCutoff > 0) {
        items.push({
          allowance_id: a.allowance_id,
          description: a.description,
          pay_cycle: a.pay_cycle,
          is_recurring: 1,
          amount_full: round2(a.amount),
          amount_this_cutoff: round2(amountThisCutoff),
          source: "RECURRING",
        });
      }
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
    deduct_on: String(row.deduct_on ?? "BOTH").toUpperCase(),
    start_cutoff_id: n(row.start_cutoff_id),
    remaining_balance: n(row.remaining_balance),
    last_paid_cutoff_id: row.last_paid_cutoff_id == null ? null : n(row.last_paid_cutoff_id),
    status: String(row.status ?? "ACTIVE").toUpperCase(),
  };
}

function benefitLoanAmountForCutoff(args: { loan: ReturnType<typeof normBenefitLoan>; cutoffType: string }): number {
  const deductOn = String(args.loan.deduct_on ?? "BOTH").toUpperCase();
  const amort = n(args.loan.amortization_amount);

  if (amort <= 0) return 0;
  if (deductOn === "BOTH") return round2(amort / 2);
  if (!args.cutoffType) return 0;
  return deductOn === args.cutoffType ? round2(amort) : 0;
}

/* ------------------------- Wage proration (effective-date) ------------------------- */

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
        "old_rate_daily",
        "prev_daily",
        "daily_old",
      ]);

      let new_daily = pickFirstNumber(row, [
        "new_daily_wage",
        "new_daily_rate",
        "to_daily_wage",
        "new_daily",
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
        const new_monthly = pickFirstNumber(row, ["new_monthly_wage", "to_monthly_wage", "new_basic", "new_monthly"]);
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

  // collapse multiple events on same date (keep last by created_at/id ordering)
  const byDate = new Map<string, typeof events[number]>();
  for (const ev of events) byDate.set(ev.effective_date, ev);
  events = Array.from(byDate.values()).sort((a, b) => (a.effective_date < b.effective_date ? -1 : 1));

  if (baseDaily <= 0 && events.length) {
    baseDaily = events[events.length - 1].new_daily || events[0].old_daily || 0;
  }

  // Build a consistent chain from latest backwards (prevents broken proration chains)
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

/* ------------------------------ Manual itemizations ------------------------------ */

// more tolerant type normalizer
function manualKind(m: any): "EARNING" | "DEDUCTION" | "UNKNOWN" {
  const t = String(m?.type ?? m?.entry_type ?? m?.entryType ?? "").toUpperCase().trim();
  if (!t) return "UNKNOWN";
  if (t === "EARNING" || t.includes("EARN") || t.includes("ADD")) return "EARNING";
  if (t === "DEDUCTION" || t.includes("DEDUCT")) return "DEDUCTION";
  return "UNKNOWN";
}

function cleanDesc(v: any): string {
  return String(v ?? "").trim();
}

type BreakdownItem = {
  item_key: string;
  type: "EARNING" | "DEDUCTION";
  category: string;
  code?: string | null;
  description: string;
  amount: number;
  source_table?: string | null;
  source_id?: string | number | null;
  meta?: any;
};

function manualSourceTable(m: any): string | null {
  return m?.source_table ?? m?.sourceTable ?? m?.meta?.source_table ?? m?.meta?.sourceTable ?? null;
}

function manualSourceId(m: any): any {
  return m?.source_id ?? m?.sourceId ?? m?.meta?.source_id ?? m?.meta?.sourceId ?? m?.id ?? null;
}

function manualStableKey(prefix: string, m: any, fallbackIndex: number): string {
  const sid = manualSourceId(m);
  if (sid != null && String(sid).trim() !== "") return `${prefix}:${String(sid)}`;

  const id = m?.id ?? null;
  if (id != null && String(id).trim() !== "") return `${prefix}:ID:${String(id)}`;

  const d = cleanDesc(m?.desc ?? m?.description ?? "");
  const a = n(m?.amount ?? 0);
  return `${prefix}:X:${fallbackIndex}:${d.slice(0, 40)}:${a.toFixed(2)}`;
}

function isDRPaymentManualEntry(m: any): boolean {
  const cat = String(m?.category ?? m?.deduction_type ?? m?.other_deduction_type ?? m?.deductionKind ?? "")
    .trim()
    .toLowerCase();
  if (cat === "dr_payment") return true;

  const desc = String(m?.desc ?? m?.description ?? "").trim().toLowerCase();
  return desc.startsWith("dr payment:");
}

function isShortageManualEntry(m: any): boolean {
  const cat = String(m?.category ?? m?.deduction_type ?? m?.other_deduction_type ?? "").trim().toLowerCase();
  if (cat === "shortage") return true;

  const desc = String(m?.desc ?? m?.description ?? "").trim().toLowerCase();
  return desc.includes("shortage");
}

function extractDRReceiptNo(desc: string): string {
  const ss = String(desc ?? "").trim();
  const prefix = /^DR\s*PAYMENT\s*:\s*/i;
  return ss.replace(prefix, "").trim();
}

function drReceiptNoFromEntry(m: any): string {
  if (m?.delivery_receipt_number) return String(m.delivery_receipt_number);
  const d = cleanDesc(m?.desc ?? m?.description ?? "");
  return extractDRReceiptNo(d) || "";
}

function drPaymentDateFromEntry(m: any): string {
  const v = m?.payment_date ?? m?.paymentDate ?? m?.meta?.payment_date ?? m?.meta?.paymentDate ?? "";
  const ss = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ss) ? ss : "";
}

function drPaymentMethodFromEntry(m: any): string {
  const v = m?.payment_method ?? m?.paymentMethod ?? m?.meta?.payment_method ?? m?.meta?.paymentMethod ?? "";
  return String(v ?? "").trim();
}

function drPostedFromEntry(m: any): boolean {
  const v =
    m?.is_posted_to_payroll ??
    m?.isPostedToPayroll ??
    m?.meta?.is_posted_to_payroll ??
    m?.meta?.isPostedToPayroll ??
    0;
  return Boolean(Number(v) === 1 || v === true);
}

export function buildManualItemizationsForBreakdown(manualEntries: any[]): {
  manual_addition_items: BreakdownItem[];
  manual_deduction_items: BreakdownItem[];
  manual_deduction_summary: {
    total: number;
    shortage_total: number;
    dr_total: number;
    other_total: number;
  };
} {
  const rows = Array.isArray(manualEntries) ? manualEntries : [];

  const additions = rows.filter((m) => manualKind(m) === "EARNING");
  const deductions = rows.filter((m) => manualKind(m) === "DEDUCTION");

  const manual_addition_items: BreakdownItem[] = additions.map((m, idx) => {
    const desc = cleanDesc(m?.desc ?? m?.description ?? "") || "Manual Addition";
    const amt = round2(n(m?.amount));
    return {
      item_key: manualStableKey("MA", m, idx),
      type: "EARNING",
      category: "MANUAL_ADDITION",
      description: desc,
      amount: amt,
      source_table: manualSourceTable(m),
      source_id: manualSourceId(m),
      meta: m?.meta ?? null,
    };
  });

  const manual_deduction_items: BreakdownItem[] = deductions.map((m, idx) => {
    const rawDesc = cleanDesc(m?.desc ?? m?.description ?? "") || "Manual Deduction";
    const amt = round2(n(m?.amount));

    const isDR = isDRPaymentManualEntry(m);
    const isShortage = !isDR && isShortageManualEntry(m);

    const category = isDR ? "DR_PAYMENT" : isShortage ? "SHORTAGE" : "MANUAL_DEDUCTION";

    const drNo = isDR ? drReceiptNoFromEntry(m) : "";
    const drDate = isDR ? drPaymentDateFromEntry(m) : "";
    const drMethod = isDR ? drPaymentMethodFromEntry(m) : "";
    const drPosted = isDR ? drPostedFromEntry(m) : false;

    // ✅ remove "DR Payment:" prefix for display (backward compatible)
    const displayDesc = isDR
      ? (extractDRReceiptNo(rawDesc) || drNo || "DR Payment")
      : rawDesc;

    return {
      item_key: manualStableKey("MD", m, idx),
      type: "DEDUCTION",
      category,
      description: displayDesc,
      amount: amt,
      source_table: manualSourceTable(m),
      source_id: manualSourceId(m),
      meta: isDR
        ? {
          ...(m?.meta ?? {}),
          delivery_receipt_number: drNo || (m?.delivery_receipt_number ?? null),
          payment_date: drDate || (m?.payment_date ?? null),
          payment_method: drMethod || (m?.payment_method ?? null),
          is_posted_to_payroll: drPosted ? 1 : 0,
        }
        : m?.meta ?? null,
    };
  });


  const shortage_total = round2(
    manual_deduction_items.filter((x) => x.category === "SHORTAGE").reduce((sum, x) => sum + n(x.amount), 0),
  );

  const dr_total = round2(
    manual_deduction_items.filter((x) => x.category === "DR_PAYMENT").reduce((sum, x) => sum + n(x.amount), 0),
  );

  const total = round2(manual_deduction_items.reduce((sum, x) => sum + n(x.amount), 0));
  const other_total = round2(total - shortage_total - dr_total);

  return {
    manual_addition_items,
    manual_deduction_items,
    manual_deduction_summary: { total, shortage_total, dr_total, other_total },
  };
}

export function buildEmployeeLoanItemsForBreakdown(employeeLoans: any[]): BreakdownItem[] {
  const rows = Array.isArray(employeeLoans) ? employeeLoans : [];

  // rule: 50/50 per cutoff
  return rows.map((L, idx) => {
    const loanId = n(L?.loan_id ?? L?.loanId ?? L?.id);
    const loanType = String(L?.loan_type ?? L?.loanType ?? "").toUpperCase();
    const monthly = round2(n(L?.monthly_payment ?? L?.monthlyPayment));
    const amt = round2(monthly / 2);

    return {
      item_key: loanId ? `EL:${loanId}` : `EL:X:${idx}`,
      type: "DEDUCTION",
      category: "EMPLOYEE_LOAN",
      code: loanType || null,
      description: loanType ? `Employee Loan: ${loanType}` : "Employee Loan",
      amount: amt,
      source_table: "employee_loan",
      source_id: loanId || null,
      meta: {
        loan_id: loanId || null,
        loan_type: loanType || null,
        monthly_payment: monthly,
        rule: "50/50 per cutoff",
      },
    };
  });
}

/**
 * ✅ Unworked holiday pay eligibility:
 * - holiday.is_paid === 1
 * - holiday.last_working_day is within cutoff
 * - approved attendance exists on last_working_day
 */
function eligibleForUnworkedHolidayPay(args: {
  holiday: HolidayInfo;
  cutoffStart: string;
  cutoffEnd: string;
  approvedAttendanceDates: Set<string>;
}): boolean {
  const h = args.holiday;
  if (!h || !h.is_paid) return false;
  const lwd = h.last_working_day;
  if (!lwd) return false;
  if (!inRange(lwd, args.cutoffStart, args.cutoffEnd)) return false;
  return args.approvedAttendanceDates.has(lwd);
}

/* ------------------------------ Option B normalizers ------------------------------ */

function normRetroPayRow(row: any) {
  return {
    retro_id: n(row?.retro_id ?? row?.id),
    user_id: n(row?.user_id),
    amount: n(row?.amount),
    description: row?.description ?? row?.remarks ?? row?.note ?? null,
    cutoff_start: ymdOrNull(row?.cutoff_start ?? row?.cutoffStart),
    cutoff_end: ymdOrNull(row?.cutoff_end ?? row?.cutoffEnd),
    is_processed: n(row?.is_processed ?? row?.isProcessed) ? 1 : 0,
  };
}

function normCoopSavingsRow(row: any) {
  return {
    id: n(row?.id),
    user_id: n(row?.user_id),
    membership_id: row?.membership_id != null ? String(row.membership_id) : "",
    monthly_amount: n(row?.monthly_amount ?? row?.amount ?? 0),
    start_date: ymdOrNull(row?.start_date ?? row?.startDate),
    end_date: ymdOrNull(row?.end_date ?? row?.endDate),
    is_active: n(row?.is_active ?? row?.isActive) ? 1 : 0,
  };
}

function monthlySplitPerCutoff(monthly: number): number {
  if (monthly <= 0) return 0;
  // ✅ business rule: 50/50 per cutoff
  return round2(monthly / 2);
}

function dedupeByItemKey<T extends { item_key: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = String(it?.item_key ?? "").trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/* -------------------------------- Compute -------------------------------- */

export function computeEmployeeLine(args: ComputeArgs): PayrollComputedLine {
  const empName = buildName(args.user);
  const position = resolvePosition(args.user);
  const departmentResolved = resolveDepartmentName({ user: args.user, fallback: args.departmentName });

  const dailyBase = n((args.wage as any)?.daily_wage);
  const hourlyBase =
    (args.wage as any)?.hourly_wage != null ? n((args.wage as any).hourly_wage) : dailyBase > 0 ? dailyBase / 8 : 0;

  const monthlyBase =
    (args.wage as any)?.monthly_wage != null ? n((args.wage as any).monthly_wage) : dailyBase > 0 ? dailyBase * 26 : 0;

  const rate = buildDailyRateResolver({
    wage: args.wage,
    wageProrationLogs: (args.wageProrationLogs ?? []) as any[],
  });

  // ✅ attendance is cutoff-scoped and approved
  const att = (args.attendance ?? [])
    .map(normAttendance)
    .filter((r) => String(r.status ?? "").toLowerCase() === "approved")
    .filter((r) => !!r.date_schedule)
    .filter((r) => inRange(r.date_schedule, args.cutoffStart, args.cutoffEnd));

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
      last_working_day: existing.last_working_day ?? h.last_working_day ?? null,
    });
  }

  const approvedAttendanceDates = new Set(att.map((r) => r.date_schedule));
  const attendedHolidayDates = new Set(att.map((r) => r.date_schedule));

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
    // ✅ Special holiday with is_paid=0 → treat as normal day (no premium multiplier)
    const rawHolidayFlag = toHolidayFlag(h);
    const holidayFlag: HolidayFlag =
      rawHolidayFlag === "SPECIAL" && h && !h.is_paid ? "NONE" : rawHolidayFlag;
    const rd = isSunday(date);

    const wmRaw = n(r.work_minutes);
    const omRaw = n(r.overtime_minutes);

    const baseMin = Math.min(wmRaw, 480);
    const otMin = Math.max(omRaw, Math.max(0, wmRaw - 480));

    const lm = n(r.late_minutes);
    const um = n(r.undertime_minutes);
    const ndm = r.night_diff_minutes == null ? 0 : n(r.night_diff_minutes);

    // ✅ FIX: work minutes should reflect late + undertime (net minutes worked)
    const effectiveWorkedMin = Math.max(0, baseMin - lm - um);
    totalWorkMinutes += effectiveWorkedMin;

    overtimeMinutes += otMin;
    nightDiffMinutes += ndm;
    lateMinutes += lm;
    undertimeMinutes += um;

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
        last_working_day: h?.last_working_day ?? null,
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

  // unworked holidays
  // ✅ Special holidays = no work no pay (only regular holidays get unworked pay)
  for (const [date, h] of holidayMap.entries()) {
    if (h.type === "special" || h.type === "company") continue;
    if (!h.is_paid) continue;
    if (!inRange(date, args.cutoffStart, args.cutoffEnd)) continue;
    if (attendedHolidayDates.has(date)) continue;

    const ok = eligibleForUnworkedHolidayPay({
      holiday: h,
      cutoffStart: args.cutoffStart,
      cutoffEnd: args.cutoffEnd,
      approvedAttendanceDates,
    });

    if (!ok) {
      holidayItems.push({
        date,
        holiday: toHolidayFlag(h),
        is_rest_day: isSunday(date),
        base_minutes: 0,
        ot_minutes: 0,
        base_mult: 0,
        ot_mult: 0,
        pay: 0,
        ot_pay: 0,
        total: 0,
        description: h.description,
        last_working_day: h.last_working_day,
        pay_type: "UNWORKED_HOLIDAY_NOT_ELIGIBLE",
        rule: "Requires approved attendance on last_working_day within cutoff window.",
      });
      continue;
    }

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
      last_working_day: h.last_working_day,
      pay_type: "UNWORKED_HOLIDAY_PAY",
      rule: "Eligible due to approved attendance on last_working_day within cutoff.",
      daily_rate_used: dayDaily,
      minute_rate_used: dayDaily > 0 ? dayDaily / 480 : 0,
    });
  }

  const totalDaysWorked = new Set(att.filter((x) => n(x.work_minutes) > 0).map((x) => x.date_schedule)).size;
  const totalHoursWorked = round2(totalWorkMinutes / 60);
  const holidayDays = round2(holidayItems.filter((x) => n(x?.total) > 0).length);

  /* ------------------------------ Manual entries (split) ------------------------------ */

  const manualRows = Array.isArray(args.manualEntries) ? args.manualEntries : [];

  const manualText = (m: any) =>
    [
      m?.category,
      m?.deduction_type,
      m?.other_deduction_type,
      m?.code,
      m?.entry_code,
      m?.type,
      m?.desc,
      m?.description,
      m?.note,
      m?.remarks,
      m?.memo,
    ]
      .filter((x) => x != null && String(x).trim() !== "")
      .join(" ");

  const isRetroRow = (m: any) =>
    manualKind(m) === "EARNING" &&
    matchesAny(manualText(m), ["retro_pay", "retro pay", "retro", "backpay", "back pay"]);

  const isCoopSavingsRow = (m: any) =>
    manualKind(m) === "DEDUCTION" &&
    matchesAny(manualText(m), [
      "coop_savings_membership",
      "coop savings membership",
      "coop savings",
      "coopsavings",
      "coop_savings",
      "savings(coop_savings_membership)",
    ]);

  const isCoopLoanRow = (m: any) =>
    manualKind(m) === "DEDUCTION" && matchesAny(manualText(m), ["coop_loan", "coop loan", "cooploan"]);

  const retroRows = manualRows.filter(isRetroRow);
  const coopSavingsRowsManual = manualRows.filter(isCoopSavingsRow);
  const coopLoanRows = manualRows.filter((m) => isCoopLoanRow(m) && !isCoopSavingsRow(m));

  const baseManualRows = manualRows.filter(
    (m) => !isRetroRow(m) && !isCoopSavingsRow(m) && !isCoopLoanRow(m),
  );

  const itemizedBase = buildManualItemizationsForBreakdown(baseManualRows);
  const retroItemizedManual = buildManualItemizationsForBreakdown(retroRows);
  const coopSavingsItemizedManual = buildManualItemizationsForBreakdown(coopSavingsRowsManual);
  const coopLoanItemized = buildManualItemizationsForBreakdown(coopLoanRows);

  const manualAdds = round2(itemizedBase.manual_addition_items.reduce((sum, x) => sum + n(x.amount), 0));

  const shortageDeduction = round2(itemizedBase.manual_deduction_summary.shortage_total);
  const drDeduction = round2(itemizedBase.manual_deduction_summary.dr_total);
  const otherDeductions = round2(itemizedBase.manual_deduction_summary.other_total);

  const coopLoan = round2(coopLoanItemized.manual_deduction_items.reduce((sum, x) => sum + n(x.amount), 0));

  /* ------------------------------ Retro Pay (Option B + Manual) ------------------------------ */

  // Manual retro items (legacy)
  const retro_items_manual: BreakdownItem[] = retroItemizedManual.manual_addition_items.map((x) => ({
    ...x,
    category: "RETRO_PAY",
  }));

  // Option B retro_pay table items (NEW) — supports multiple per cutoff
  const retroTableRows = (Array.isArray(args.retroPays) ? args.retroPays : []).map(normRetroPayRow);
  const retro_items_table: BreakdownItem[] = retroTableRows
    .filter((r) => r.amount > 0)
    .filter((r) => r.is_processed !== 1)
    .filter((r) => overlapsWindow({ cutoffStart: args.cutoffStart, cutoffEnd: args.cutoffEnd, start: r.cutoff_start, end: r.cutoff_end }))
    .map((r, idx) => {
      const rid = r.retro_id;
      const key = rid ? `RP:${rid}` : `RP:IDX:${idx + 1}`;
      const desc = String(r.description ?? "").trim() || "Retro Pay";

      return {
        item_key: key,
        type: "EARNING",
        category: "RETRO_PAY",
        description: desc,
        amount: round2(r.amount),
        source_table: "retro_pay",
        source_id: rid || null,
        meta: {
          retro_id: rid || null,
          cutoff_start: r.cutoff_start ?? null,
          cutoff_end: r.cutoff_end ?? null,
          rule: "Included when retro_pay overlaps cutoff window and is_processed=0",
        },
      };
    });

  // Merge + dedupe by item_key
  const retro_items_all = dedupeByItemKey<BreakdownItem>([...retro_items_manual, ...retro_items_table]);
  const retroPay = round2(retro_items_all.reduce((sum, x) => sum + n(x.amount), 0));

  // Backward compat array name (your old UI may be reading retro_pay_items)
  const retro_pay_items = retro_items_all;

  /* ------------------------------ COOP Savings Membership (Option B + Manual) ------------------------------ */

  // Manual coop savings items (legacy)
  const coop_savings_items_manual: BreakdownItem[] = coopSavingsItemizedManual.manual_deduction_items.map((x) => ({
    ...x,
    category: "COOP_SAVINGS_MEMBERSHIP",
  }));

  // Option B coop_savings_membership table (NEW)
  const coopRows = (Array.isArray(args.coopSavingsMemberships) ? args.coopSavingsMemberships : []).map(normCoopSavingsRow);

  const coop_savings_items_table: BreakdownItem[] = coopRows
    .filter((r) => r.is_active === 1)
    .filter((r) => r.monthly_amount > 0)
    .filter((r) =>
      overlapsWindow({
        cutoffStart: args.cutoffStart,
        cutoffEnd: args.cutoffEnd,
        start: r.start_date,
        end: r.end_date,
      }),
    )
    .map((r, idx) => {
      const amountThisCutoff = monthlySplitPerCutoff(r.monthly_amount);
      const key = r.membership_id
        ? `CSM:${r.membership_id}`
        : r.id
          ? `CSM:${r.id}`
          : `CSM:IDX:${idx + 1}`;

      return {
        item_key: key,
        type: "DEDUCTION" as const,
        category: "COOP_SAVINGS_MEMBERSHIP",
        description: "COOP Savings Membership",
        amount: round2(amountThisCutoff),
        source_table: "coop_savings_membership",
        source_id: r.id || null,
        meta: {
          membership_id: r.membership_id || null,
          monthly_amount: round2(r.monthly_amount),
          amount_this_cutoff: round2(amountThisCutoff),
          start_date: r.start_date ?? null,
          end_date: r.end_date ?? null,
          rule: "50/50 per cutoff from monthly_amount when membership overlaps cutoff window",
        },
      };
    })
    .filter((x) => n(x.amount) > 0);

  const coop_savings_items = dedupeByItemKey<BreakdownItem>([
    ...coop_savings_items_manual,
    ...coop_savings_items_table,
  ]);

  const coopSavings = round2(coop_savings_items.reduce((sum, x) => sum + n(x.amount), 0));

  // Manual deductions total includes coop savings + coop loan
  const manualDeductions = round2(shortageDeduction + drDeduction + otherDeductions + coopSavings + coopLoan);

  /* ------------------------------ Govt benefits ------------------------------ */

  const multSSS = n((args.benefitMultipliers as any)?.SSS ?? 0);
  const multPhil = n((args.benefitMultipliers as any)?.PHILHEALTH ?? 0);
  const multPagibig = n((args.benefitMultipliers as any)?.PAGIBIG ?? 0);

  const sssMonthly = n((args.wage as any)?.sss_employee);
  const philMonthly = n((args.wage as any)?.philhealth_employee);
  const pagibigMonthly = n((args.wage as any)?.pagibig_employee);

  const benefitSSS = round2(sssMonthly * multSSS);
  const benefitPhilhealth = round2(philMonthly * multPhil);
  const benefitPagibig = round2(pagibigMonthly * multPagibig);

  /* --------------------------- Employee loans 50/50 --------------------------- */

  const employeeLoanItems = buildEmployeeLoanItemsForBreakdown(args.employeeLoans ?? []);

  const loanVale = round2(
    employeeLoanItems
      .filter((x) => String(x.code ?? "").toUpperCase() === "VALE")
      .reduce((sum, x) => sum + n(x.amount), 0),
  );

  const loanCar = round2(
    employeeLoanItems
      .filter((x) => String(x.code ?? "").toUpperCase() === "CAR LOAN")
      .reduce((sum, x) => sum + n(x.amount), 0),
  );

  const loanCoop = round2(
    employeeLoanItems
      .filter((x) => String(x.code ?? "").toUpperCase() === "COOP")
      .reduce((sum, x) => sum + n(x.amount), 0),
  );

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

  /* ------------------------------- Proration flags ------------------------------- */

  const prorationEventsInCutoff = (rate.events ?? []).filter((ev: any) =>
    inRange(String(ev?.effective_date ?? ""), args.cutoffStart, args.cutoffEnd),
  );

  const isProrated = prorationEventsInCutoff.length > 0;
  const prorationJson = isProrated
    ? {
      policy:
        "is_prorated=1 when at least one wage proration event effective_date falls within the cutoff window.",
      cutoff: { start: args.cutoffStart, end: args.cutoffEnd },
      events_in_cutoff: prorationEventsInCutoff,
      all_events_used_chain: rate.events ?? [],
    }
    : null;

  /* -------------------------------- Totals -------------------------------- */

  const grossPay = round2(
    basicPay + otAmount + holidayPay + restDayAmount + nightDiffAmount + allowance + retroPay + manualAdds,
  );

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
    otherDeductions +
    coopSavings +
    coopLoan,
  );

  const netPay = round2(grossPay - totalDeductions);

  const prev = n(args.previousNetPay);
  const variancePct = prev > 0 ? round2(((netPay - prev) / prev) * 100) : null;
  const varianceFlag = prev > 0 && Math.abs(n(variancePct)) >= 10;
  const varianceAmountUI = round2(netPay - prev);

  return {
    user_id: n((args.user as any).id),
    employee_name: empName,
    first_name: (args.user as any).first_name ?? null,
    last_name: (args.user as any).last_name ?? null,
    position,
    department_name: departmentResolved,

    daily_rate: round2(dailyBase),
    hourly_rate: round2(hourlyBase),
    monthly_rate: round2(monthlyBase),

    total_days_worked: new Set(att.filter((x) => n(x.work_minutes) > 0).map((x) => x.date_schedule)).size,
    total_work_minutes: totalWorkMinutes,
    total_hours_worked: round2(totalWorkMinutes / 60),

    late_minutes: lateMinutes,
    undertime_minutes: undertimeMinutes,
    overtime_minutes: overtimeMinutes,
    night_diff_minutes: nightDiffMinutes,

    basic_pay: round2(basicPay),
    ot_amount: round2(otAmount),

    holiday: round2(holidayPay),
    holiday_pay: round2(holidayPay),
    holiday_days: round2(holidayItems.filter((x) => n(x?.total) > 0).length),

    rest_day_amount: round2(restDayAmount),
    night_diff_amount: round2(nightDiffAmount),

    allowance,
    retro_pay: round2(retroPay),
    manual_additions: round2(manualAdds),

    // ✅ Option B totals now visible at top-level too
    coop_savings: round2(coopSavings),
    coop_loan: round2(coopLoan),

    late_deduction: round2(lateDeduction),
    undertime_deduction: round2(undertimeDeduction),
    shortage_deduction: round2(shortageDeduction),

    benefit_sss: round2(benefitSSS),
    benefit_philhealth: round2(benefitPhilhealth),
    benefit_pagibig: round2(benefitPagibig),

    loan_vale: round2(loanVale),
    loan_car: round2(loanCar),
    loan_coop: round2(loanCoop),
    loan_total: round2(loanTotal),

    benefit_loan_sss: round2(benefitLoanSSS),
    benefit_loan_pagibig: round2(benefitLoanPagibig),
    benefit_loan_total: round2(benefitLoanTotal),

    dr_deduction: round2(drDeduction),
    other_deductions: round2(otherDeductions),
    manual_deductions: round2(manualDeductions),

    total_additions: round2(
      manualAdds + allowance + retroPay + holidayPay + restDayAmount + nightDiffAmount + otAmount,
    ),
    total_deductions: round2(totalDeductions),
    gross_pay: round2(grossPay),
    net_pay: round2(netPay),

    previous_net_pay: prev,
    variance_amount_ui: varianceAmountUI,
    variance_pct: variancePct,
    variance_flag: Boolean(varianceFlag),

    on_hold: Boolean(args.onHold),
    is_card: n((args.wage as any)?.isCard ?? (args.wage as any)?.is_card),

    is_prorated: Boolean(isProrated),
    proration_json: prorationJson,

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
        policy:
          "Per-date daily/hourly/minute rate derived from wage proration logs when available; otherwise wage profile.",
      },
      earnings: {
        basic_pay: round2(basicPay),
        ot_amount: round2(otAmount),
        holiday_pay: round2(holidayPay),
        rest_day_amount: round2(restDayAmount),
        night_diff_amount: round2(nightDiffAmount),

        allowance_total: round2(allowance),
        allowance_items: allowanceItems,

        // ✅ base manual additions (retro excluded)
        manual_additions: round2(manualAdds),
        manual_addition_items: itemizedBase.manual_addition_items,

        // ✅ retro pay (multiple per cutoff supported)
        retro_pay: round2(retroPay),

        // NEW canonical field for payroll_run_employee_item sync
        retro_items: retro_items_all.map((x) => ({
          item_key: x.item_key,
          amount: x.amount,
          description: x.description,
          label: x.description, // compatibility with older consumers
          source_table: x.source_table ?? "retro_pay",
          source_id: x.source_id ?? null,
          meta: x.meta ?? null,
        })),

        // Backward-compat (your older UI may be reading this)
        retro_pay_items: retro_pay_items.map((x) => ({
          item_key: x.item_key,
          amount: x.amount,
          description: x.description,
          label: x.description,
          source_table: x.source_table ?? "retro_pay",
          source_id: x.source_id ?? null,
          meta: x.meta ?? null,
        })),

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
        employee_loan_items: employeeLoanItems,

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

        // ✅ manual deductions total includes coop savings/loan
        manual_deductions: round2(manualDeductions),

        // ✅ base manual deduction items (coop excluded)
        manual_deduction_items: itemizedBase.manual_deduction_items,
        manual_deduction_summary: itemizedBase.manual_deduction_summary,

        // ✅ coop savings membership (now comes from Option B table)
        coop_savings: round2(coopSavings),
        coop_savings_items: coop_savings_items.map((x) => ({
          item_key: x.item_key,
          amount: x.amount,
          description: x.description,
          label: x.description,
          membership_id: (x.meta?.membership_id ?? null) as any,
          source_table: x.source_table ?? "coop_savings_membership",
          source_id: x.source_id ?? null,
          meta: x.meta ?? null,
        })),

        coop_loan: round2(coopLoan),
        coop_loan_items: coopLoanItemized.manual_deduction_items.map((x) => ({
          ...x,
          category: "COOP_LOAN",
        })),
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
      is_card: n((args.wage as any)?.isCard ?? (args.wage as any)?.is_card),
      policies: {
        unworked_holiday_pay_rule:
          "Pay unworked holiday ONLY if holiday.last_working_day is within cutoff and employee has approved attendance on that last_working_day.",
      },
      proration: {
        is_prorated: Boolean(isProrated),
        events_in_cutoff: prorationEventsInCutoff,
      },
    },
  } as any;
}
