// modules/payroll-run/utils/compute.ts
import type {
  AttendanceApproval,
  BenefitCode,
  BenefitLoanRow,
  BreakdownItem,
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
  attendance: AttendanceApproval[];
  holidays: HolidayRow[];
  cutoffStart: string;
  cutoffEnd: string;
  manualEntries: ManualEntry[];
  departmentName: string | null;
  previousNetPay: number;
  onHold: boolean;

  benefitMultipliers: Record<BenefitCode, number>;
  employeeLoans: EmployeeLoan[];

  benefitLoans?: BenefitLoanRow[];
  cutoffType?: "FIRST" | "SECOND";
  cutoffId?: number;

  // ✅ Allowances fetched from employee_allowance
  allowances?: EmployeeAllowance[];

  // ✅ wage proration logs for this user (effective-date driven)
  wageProrationLogs?: WageProrationLog[];

  // ✅ Option B tables (dedicated collections)
  retroPays?: RetroPayRow[];
  coopSavingsMemberships?: CoopSavingsMembershipRow[];
};

/**
 * Parses a cutoff value in the format "YYYY-MM-DD_YYYY-MM-DD".
 * Falls back to empty strings if malformed.
 */
export function parseCutoffValue(value: string): { start: string; end: string } {
  const parts = String(value ?? "").split("_");
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function ymdOrNull(v: unknown): string | null {
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

function n(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function normKey(v: unknown): string {
  return s(v)
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
}

function matchesAny(label: unknown, needles: string[]): boolean {
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
  const fn = s(u.first_name).trim();
  const ln = s(u.last_name).trim();
  const full = `${fn} ${ln}`.trim();
  return full || `Employee #${u.id}`;
}

function resolvePosition(u: UserRow): string | null {
  const raw = u.position;
  const v = raw == null ? "" : String(raw).trim();
  return v ? v : null;
}

/**
 * ✅ Department name resolver (covers common Directus/user shapes)
 */
function resolveDepartmentName(args: { user: UserRow; fallback: string | null }): string | null {
  if (args.fallback && String(args.fallback).trim()) return String(args.fallback).trim();

  const u = args.user as unknown as Record<string, unknown>;

  const candidates: unknown[] = [
    u.department_name,
    u.departmentName,
    u.department,
    u.department_text,
    u.departmentText,
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

function normAttendance(row: unknown): AttendanceNorm {
  const r = row as Record<string, unknown>;
  const date = ymdOrNull(r.date_schedule ?? r.dateSchedule) ?? "";

  return {
    approval_id: n(r.approval_id ?? r.approvalId ?? r.id),
    employee_id: n(r.employee_id ?? r.employeeId ?? r.user_id ?? r.userId),
    date_schedule: date, // ✅ normalized YYYY-MM-DD
    work_minutes: n(r.work_minutes ?? r.workMinutes),
    late_minutes: n(r.late_minutes ?? r.lateMinutes),
    undertime_minutes: n(r.undertime_minutes ?? r.undertimeMinutes),
    overtime_minutes: n(r.overtime_minutes ?? r.overtimeMinutes),
    night_diff_minutes: n(r.night_diff_minutes ?? r.nightDiffMinutes) || null,
    status: String(r.status ?? "approved"),
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

function normHoliday(row: unknown): HolidayInfo {
  const r = row as Record<string, unknown>;
  return {
    date: ymdOrNull(r.holiday_date ?? r.holidayDate ?? r.date) ?? "",
    type: String(r.holiday_type ?? r.holidayType ?? "regular").toLowerCase() as HolidayKind,
    description: s(r.description ?? r.name ?? ""),
    is_paid: n(r.is_paid ?? r.isPaid ?? 1) ? 1 : 0,
    last_working_day: ymdOrNull(r.last_working_day ?? r.lastWorkingDay),
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

function normAllowance(row: unknown): AllowanceNorm {
  const r = row as Record<string, unknown>;
  const payCycleRaw = String(r.pay_cycle ?? r.payCycle ?? "N/A").toUpperCase();
  const pay_cycle: AllowancePayCycle =
    payCycleRaw === "PER_CUTOFF" ? "PER_CUTOFF" : payCycleRaw === "PER_MONTH" ? "PER_MONTH" : "N/A";

  return {
    allowance_id: n(r.allowance_id ?? r.allowanceId ?? r.id),
    user_id: n(r.user_id ?? r.userId),
    amount: n(r.amount),
    description: s(r.description) || null,

    cutoff_start: ymdOrNull(r.cutoff_start ?? r.cutoffStart),
    cutoff_end: ymdOrNull(r.cutoff_end ?? r.cutoffEnd),

    is_recurring: n(r.is_recurring ?? r.isRecurring) ? 1 : 0,
    is_active: n(r.is_active ?? r.isActive) ? 1 : 0,
    pay_cycle,

    start_date: ymdOrNull(r.start_date ?? r.startDate),
    end_date: ymdOrNull(r.end_date ?? r.endDate),

    is_processed: n(r.is_processed ?? r.isProcessed) ? 1 : 0,
  };
}

function allowanceAmountForCutoff(args: {
  allowances: EmployeeAllowance[];
  cutoffStart: string;
  cutoffEnd: string;
  cutoffType?: string;
}): { total: number; items: Array<{
  allowance_id: number;
  description: string | null;
  pay_cycle: AllowancePayCycle;
  is_recurring: number;
  amount_full: number;
  amount_this_cutoff: number;
  source: "RECURRING" | "ONE_TIME";
}> } {
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

function normBenefitLoan(row: unknown) {
  const r = row as Record<string, unknown>;
  return {
    loan_id: n(r.loan_id ?? r.id),
    user_id: n(r.user_id),
    benefit_code: String(r.benefit_code ?? "").toUpperCase(),
    loan_name: s(r.loan_name) || null,
    reference_no: s(r.reference_no) || null,
    amortization_amount: n(r.amortization_amount),
    deduct_on: String(r.deduct_on ?? "BOTH").toUpperCase(),
    start_cutoff_id: n(r.start_cutoff_id),
    remaining_balance: n(r.remaining_balance),
    last_paid_cutoff_id: r.last_paid_cutoff_id == null ? null : n(r.last_paid_cutoff_id),
    status: String(r.status ?? "ACTIVE").toUpperCase(),
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

function buildDailyRateResolver(args: { wage: WageProfile | null; wageProrationLogs?: WageProrationLog[] }) {
  const wage = args.wage;

  let baseDaily = (() => {
    const w = wage as unknown as Record<string, unknown>;
    const d = n(w?.daily_wage);
    if (d > 0) return d;

    const h = n(w?.hourly_wage);
    if (h > 0) return h * 8;

    const m = n(w?.monthly_wage);
    if (m > 0) return m / 26;

    return 0;
  })();

  const eqMoney = (a: number, b: number) => Math.abs(a - b) < 0.005;

  const pickFirstNumber = (row: unknown, keys: string[]): number => {
    const r = row as Record<string, unknown>;
    for (const k of keys) {
      const v = n(r?.[k]);
      if (v > 0) return v;
    }
    return 0;
  };

  const toDailyFromMonthly = (monthly: number) => (monthly > 0 ? monthly / 26 : 0);

  const parseEffectiveDate = (row: unknown): string => {
    const r = row as Record<string, unknown>;
    const v =
      r?.effective_date ??
      r?.effectivity_date ??
      r?.effectiveDate ??
      r?.effectivityDate ??
      r?.date_effective ??
      r?.effectiveFrom ??
      r?.effective_from ??
      r?.start_date ??
      r?.date ??
      "";
    const d = s(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
  };

  const logs = Array.isArray(args.wageProrationLogs) ? args.wageProrationLogs : [];

  let events = logs
    .map((row) => {
      const r = (row as unknown) as Record<string, unknown>;
      const effective_date = parseEffectiveDate(r);
      if (!effective_date) return null;

      let old_daily = pickFirstNumber(r, [
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

      let new_daily = pickFirstNumber(r, [
        "new_daily_wage",
        "new_daily_rate",
        "to_daily_wage",
        "new_daily",
        "new_rate_daily",
        "daily_new",
      ]);

      if (old_daily <= 0) {
        const old_monthly = pickFirstNumber(r, [
          "old_monthly_wage",
          "previous_monthly_wage",
          "from_monthly_wage",
          "old_basic",
          "old_monthly",
        ]);
        old_daily = toDailyFromMonthly(old_monthly);
      }

      if (new_daily <= 0) {
        const new_monthly = pickFirstNumber(r, ["new_monthly_wage", "to_monthly_wage", "new_basic", "new_monthly"]);
        new_daily = toDailyFromMonthly(new_monthly);
      }

      if (old_daily <= 0) old_daily = baseDaily;
      if (new_daily <= 0) new_daily = baseDaily;

      return {
        effective_date,
        old_daily: round2(old_daily),
        new_daily: round2(new_daily),
        created_at: r?.created_at ?? r?.date_created ?? null,
        id: n(r?.id),
      };
    })
    .filter(Boolean) as Array<{
      effective_date: string;
      old_daily: number;
      new_daily: number;
      created_at: unknown;
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
function manualKind(m: unknown): "EARNING" | "DEDUCTION" | "UNKNOWN" {
  const r = m as Record<string, unknown>;
  const t = String(r?.type ?? r?.entry_type ?? r?.entryType ?? "").toUpperCase().trim();
  if (!t) return "UNKNOWN";
  if (t === "EARNING" || t.includes("EARN") || t.includes("ADD")) return "EARNING";
  if (t === "DEDUCTION" || t.includes("DEDUCT")) return "DEDUCTION";
  return "UNKNOWN";
}

function cleanDesc(v: unknown): string {
  return s(v).trim();
}

// Using global BreakdownItem from ../types

function manualSourceTable(m: unknown): string | null {
  const r = m as Record<string, unknown>;
  const meta = (r?.meta ?? {}) as Record<string, unknown>;
  return s(r?.source_table ?? r?.sourceTable ?? meta?.source_table ?? meta?.sourceTable) || null;
}

function manualSourceId(m: unknown): unknown {
  const r = m as Record<string, unknown>;
  const meta = (r?.meta ?? {}) as Record<string, unknown>;
  return r?.source_id ?? r?.sourceId ?? meta?.source_id ?? meta?.sourceId ?? r?.id ?? null;
}

function manualStableKey(prefix: string, m: unknown, fallbackIndex: number): string {
  const r = m as Record<string, unknown>;
  const sid = manualSourceId(m);
  if (sid != null && String(sid).trim() !== "") return `${prefix}:${String(sid)}`;

  const id = r?.id ?? null;
  if (id != null && String(id).trim() !== "") return `${prefix}:ID:${String(id)}`;

  const d = cleanDesc(r?.desc ?? r?.description ?? "");
  const a = n(r?.amount ?? 0);
  return `${prefix}:X:${fallbackIndex}:${d.slice(0, 40)}:${a.toFixed(2)}`;
}

function isDRPaymentManualEntry(m: unknown): boolean {
  const r = m as Record<string, unknown>;
  const cat = String(r?.category ?? r?.deduction_type ?? r?.other_deduction_type ?? r?.deductionKind ?? "")
    .trim()
    .toLowerCase();
  if (cat === "dr_payment") return true;

  const desc = String(r?.desc ?? r?.description ?? "").trim().toLowerCase();
  return desc.startsWith("dr payment:");
}

function isShortageManualEntry(m: unknown): boolean {
  const r = m as Record<string, unknown>;
  const cat = String(r?.category ?? r?.deduction_type ?? r?.other_deduction_type ?? "").trim().toLowerCase();
  if (cat === "shortage") return true;

  const desc = String(r?.desc ?? r?.description ?? "").trim().toLowerCase();
  return desc.includes("shortage");
}

function extractDRReceiptNo(desc: string): string {
  const ss = String(desc ?? "").trim();
  const prefix = /^DR\s*PAYMENT\s*:\s*/i;
  return ss.replace(prefix, "").trim();
}

function drReceiptNoFromEntry(m: unknown): string {
  const r = m as Record<string, unknown>;
  if (r?.delivery_receipt_number) return String(r.delivery_receipt_number);
  const d = cleanDesc(r?.desc ?? r?.description ?? "");
  return extractDRReceiptNo(d) || "";
}

function drPaymentDateFromEntry(m: unknown): string {
  const r = m as Record<string, unknown>;
  const meta = (r?.meta ?? {}) as Record<string, unknown>;
  const v = r?.payment_date ?? r?.paymentDate ?? meta?.payment_date ?? meta?.paymentDate ?? "";
  const ss = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ss) ? ss : "";
}

function drPaymentMethodFromEntry(m: unknown): string {
  const r = m as Record<string, unknown>;
  const meta = (r?.meta ?? {}) as Record<string, unknown>;
  const v = r?.payment_method ?? r?.paymentMethod ?? meta?.payment_method ?? meta?.paymentMethod ?? "";
  return String(v ?? "").trim();
}

function drPostedFromEntry(m: unknown): boolean {
  const r = m as Record<string, unknown>;
  const meta = (r?.meta ?? {}) as Record<string, unknown>;
  const v =
    r?.is_posted_to_payroll ??
    r?.isPostedToPayroll ??
    meta?.is_posted_to_payroll ??
    meta?.isPostedToPayroll ??
    0;
  return Boolean(Number(v) === 1 || v === true);
}

export function buildManualItemizationsForBreakdown(manualEntries: ManualEntry[]): {
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
    const desc = cleanDesc(m.desc || (m as Record<string, unknown>).description || "") || "Manual Addition";
    const amt = round2(n(m?.amount));
    return {
      item_key: manualStableKey("MA", m, idx),
      type: "EARNING",
      category: "MANUAL_ADDITION",
      description: desc,
      amount: amt,
      source_table: manualSourceTable(m),
      source_id: manualSourceId(m) as string | number | null,
      meta: (m as Record<string, unknown>)?.meta ?? null,
    };
  });

  const manual_deduction_items: BreakdownItem[] = deductions.map((m, idx) => {
    const rawDesc = cleanDesc(m.desc || (m as Record<string, unknown>).description || "") || "Manual Deduction";
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
      source_id: manualSourceId(m) as string | number | null,
      meta: isDR
        ? {
          ...((m as Record<string, unknown>)?.meta as Record<string, unknown> ?? {}),
          delivery_receipt_number: drNo || ((m as Record<string, unknown>)?.delivery_receipt_number as string ?? null),
          payment_date: drDate || ((m as Record<string, unknown>)?.payment_date as string ?? null),
          payment_method: drMethod || ((m as Record<string, unknown>)?.payment_method as string ?? null),
          is_posted_to_payroll: drPosted ? 1 : 0,
        }
        : (m as Record<string, unknown>)?.meta ?? null,
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

export function buildEmployeeLoanItemsForBreakdown(employeeLoans: EmployeeLoan[]): BreakdownItem[] {
  const rows = Array.isArray(employeeLoans) ? employeeLoans : [];

  // rule: 50/50 per cutoff
  return rows.map((L, idx) => {
    const loanId = n(L.loan_id);
    const loanType = String(L.loan_type ?? "").toUpperCase();
    const monthly = round2(n(L.monthly_payment));
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
  return args.approvedAttendanceDates.has(lwd);
}

/* ------------------------------ Option B normalizers ------------------------------ */

function normRetroPayRow(row: unknown) {
  const r = row as Record<string, unknown>;
  return {
    retro_id: n(r.retro_id ?? r.id),
    user_id: n(r.user_id),
    amount: n(r.amount),
    description: s(r.description ?? r.remarks ?? r.note) || null,
    cutoff_start: ymdOrNull(r.cutoff_start ?? r.cutoffStart),
    cutoff_end: ymdOrNull(r.cutoff_end ?? r.cutoffEnd),
    is_processed: n(r.is_processed ?? r.isProcessed) ? 1 : 0,
  };
}

function normCoopSavingsRow(row: unknown) {
  const r = row as Record<string, unknown>;
  return {
    id: n(r.id),
    user_id: n(r.user_id),
    membership_id: r.membership_id != null ? String(r.membership_id) : "",
    monthly_amount: n(r.monthly_amount ?? r.amount ?? 0),
    start_date: ymdOrNull(r.start_date ?? r.startDate),
    end_date: ymdOrNull(r.end_date ?? r.endDate),
    is_active: n(r.is_active ?? r.isActive) ? 1 : 0,
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

  const dailyBase = n(args.wage?.daily_wage);
  const hourlyBase =
    args.wage?.hourly_wage != null ? n(args.wage.hourly_wage) : dailyBase > 0 ? dailyBase / 8 : 0;

  const monthlyBase =
    args.wage?.monthly_wage != null ? n(args.wage.monthly_wage) : dailyBase > 0 ? dailyBase * 26 : 0;

  const rate = buildDailyRateResolver({
    wage: args.wage,
    wageProrationLogs: args.wageProrationLogs ?? [],
  });

  // ✅ paid_holiday gate: if the wage profile explicitly sets paid_holiday=0,
  // the employee is excluded from ALL holiday pay (worked premiums + unworked pay).
  // Default to 1 (eligible) when wage is null/missing to avoid accidental exclusion.
  const paidHoliday = args.wage == null
    ? true
    : n(args.wage.paid_holiday ?? 1) !== 0;

  // ✅ All approved attendance records (including LWD dates outside cutoff window)
  // Used exclusively for unworked holiday eligibility checking.
  const allApprovedNorm = (args.attendance ?? [])
    .map(normAttendance)
    .filter((r) => String(r.status ?? "").toLowerCase() === "approved")
    .filter((r) => !!r.date_schedule);

  // ✅ Cutoff-scoped attendance — used for pay computation only
  const att = allApprovedNorm.filter((r) => inRange(r.date_schedule, args.cutoffStart, args.cutoffEnd));

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

  // ✅ Dates within the cutoff window (used for pay computation)
  const approvedAttendanceDates = new Set(allApprovedNorm.map((r) => r.date_schedule));
  // ✅ Dates with actual work minutes within cutoff — used to skip unworked holiday logic
  const attendedHolidayDates = new Set(att.filter(r => n(r.work_minutes) > 0).map((r) => r.date_schedule));

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

  const holidayItems: Array<Record<string, unknown>> = [];
  const restDayItems: Array<Record<string, unknown>> = [];

  for (const r of att) {
    const date = r.date_schedule;

    const dayDaily = rate.dailyForDate(date);
    const dayMR = rate.minuteRateForDate(date);
    const dayHourly = rate.hourlyForDate(date);

    const h = holidayMap.get(date) ?? null;
    // ✅ Special holiday with is_paid=0 → treat as normal day (no premium multiplier)
    const rawHolidayFlag = toHolidayFlag(h);
    // ✅ Special holiday with is_paid=0 → no premium; paid_holiday=0 → no premium either
    const holidayFlagBeforePaid: HolidayFlag =
      rawHolidayFlag === "SPECIAL" && h && !h.is_paid ? "NONE" : rawHolidayFlag;
    const holidayFlag: HolidayFlag = paidHoliday ? holidayFlagBeforePaid : "NONE";
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

    // ✅ FIX: Apply late/undertime deductions for ALL day types (normal, rest, holiday)
    if (lm > 0 && dayHourly > 0) lateDeduction += round2((lm / 60) * dayHourly);
    if (um > 0 && dayHourly > 0) undertimeDeduction += round2((um / 60) * dayHourly);

    if (bucket === "NORMAL") {
      basicPay += basePay;
      otAmount += otPay;
    } else if (bucket === "REST") {
      // ✅ Skip REST processing if no work minutes (prevents 0.00 entries in breakdown)
      if (baseMin <= 0 && otMin <= 0) continue;

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
      // ✅ Skip Holiday processing if no work minutes (allows Unworked Holiday Pay logic to take over)
      if (baseMin <= 0 && otMin <= 0) continue;

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
  // ✅ paid_holiday=0 → employee is never eligible for unworked holiday pay
  holidayMap.forEach((h, date) => {
    if (!paidHoliday) return;
    if (h.type === "special" || h.type === "company") return;
    if (!h.is_paid) return;
    if (!inRange(date, args.cutoffStart, args.cutoffEnd)) return;
    if (attendedHolidayDates.has(date)) return;

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
      return;
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
  });

  /* ------------------------------ Manual entries (split) ------------------------------ */

  const manualRows = Array.isArray(args.manualEntries) ? args.manualEntries : [];

  const manualText = (m: unknown) => {
    const r = m as Record<string, unknown>;
    return [
      r.category,
      r.deduction_type,
      r.other_deduction_type,
      r.code,
      r.entry_code,
      r.type,
      r.desc,
      r.description,
      r.note,
      r.remarks,
      r.memo,
    ]
      .filter((x) => x != null && String(x).trim() !== "")
      .join(" ");
  };

  const isRetroRow = (m: unknown) =>
    manualKind(m) === "EARNING" &&
    matchesAny(manualText(m), ["retro_pay", "retro pay", "retro", "backpay", "back pay"]);

  const isCoopSavingsRow = (m: unknown) =>
    manualKind(m) === "DEDUCTION" &&
    matchesAny(manualText(m), [
      "coop_savings_membership",
      "coop savings membership",
      "coop savings",
      "coopsavings",
      "coop_savings",
      "savings(coop_savings_membership)",
    ]);

  const isCoopLoanRow = (m: unknown) =>
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

  let manualAdds = round2(itemizedBase.manual_addition_items.reduce((sum, x) => sum + n(x.amount), 0));

  let shortageDeduction = round2(itemizedBase.manual_deduction_summary.shortage_total);
  let drDeduction = round2(itemizedBase.manual_deduction_summary.dr_total);
  let otherDeductions = round2(itemizedBase.manual_deduction_summary.other_total);

  let coopLoan = round2(coopLoanItemized.manual_deduction_items.reduce((sum, x) => sum + n(x.amount), 0));

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
  let retroPay = round2(retro_items_all.reduce((sum, x) => sum + n(x.amount), 0));

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

  let coopSavings = round2(coop_savings_items.reduce((sum, x) => sum + n(x.amount), 0));

  // Manual deductions total includes coop savings + coop loan
  let manualDeductions = round2(shortageDeduction + drDeduction + otherDeductions + coopSavings + coopLoan);

  /* ------------------------------ Govt benefits ------------------------------ */

  const multSSS = n(args.benefitMultipliers?.SSS ?? 0);
  const multPhil = n(args.benefitMultipliers?.PHILHEALTH ?? 0);
  const multPagibig = n(args.benefitMultipliers?.PAGIBIG ?? 0);

  const sssMonthly = n(args.wage?.sss_employee);
  const philMonthly = n(args.wage?.philhealth_employee);
  const pagibigMonthly = n(args.wage?.pagibig_employee);

  let benefitSSS = round2(sssMonthly * multSSS);
  let benefitPhilhealth = round2(philMonthly * multPhil);
  let benefitPagibig = round2(pagibigMonthly * multPagibig);

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

  let loanTotal = round2(loanVale + loanCar + loanCoop);

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

  let benefitLoanTotal = round2(benefitLoanSSS + benefitLoanPagibig);

  /* ------------------------------- Allowances ------------------------------- */

  const allowanceCalc = allowanceAmountForCutoff({
    allowances: args.allowances ?? [],
    cutoffStart: args.cutoffStart,
    cutoffEnd: args.cutoffEnd,
    cutoffType,
  });

  let allowance = round2(allowanceCalc.total);

  /* ------------------------------- Proration flags ------------------------------- */

  const prorationEventsInCutoff = (rate.events ?? []).filter((ev) =>
    inRange(s(ev?.effective_date), args.cutoffStart, args.cutoffEnd),
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

  // ✅ ENFORCE ON-HOLD: If employee is on hold, they receive zero earnings and zero deductions for this run.
  if (args.onHold) {
    basicPay = 0;
    otAmount = 0;
    holidayPay = 0;
    restDayAmount = 0;
    nightDiffAmount = 0;
    allowance = 0;
    retroPay = 0;
    manualAdds = 0;

    lateDeduction = 0;
    undertimeDeduction = 0;
    shortageDeduction = 0;
    loanTotal = 0;
    benefitLoanTotal = 0;
    benefitSSS = 0;
    benefitPhilhealth = 0;
    benefitPagibig = 0;
    drDeduction = 0;
    otherDeductions = 0;
    coopSavings = 0;
    coopLoan = 0;
    manualDeductions = 0;

    // Clear itemizations for the breakdown_json
    holidayItems.length = 0;
    restDayItems.length = 0;
    retro_items_all.length = 0;
    retro_pay_items.length = 0;
    coop_savings_items.length = 0;
    allowanceCalc.items = [];
    allowanceCalc.total = 0;
    employeeLoanItems.length = 0;
    bLoanItems.length = 0;
    itemizedBase.manual_addition_items.length = 0;
    itemizedBase.manual_deduction_items.length = 0;
    coopLoanItemized.manual_deduction_items.length = 0;
  }


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
  const varianceAmountUI = round2(netPay - prev);
  const variancePct = prev > 0 ? round2(((netPay - prev) / prev) * 100) : null;
  const varianceFlag = prev > 0 && Math.abs(n(variancePct)) >= 10;

  const daysWorked = new Set(att.filter((x) => n(x.work_minutes) > 0).map((x) => x.date_schedule)).size;
  const totalEarnings = round2(basicPay + otAmount + holidayPay + restDayAmount + nightDiffAmount + allowance + retroPay + manualAdds);

  const allowance_items: BreakdownItem[] = allowanceCalc.items.map((x) => ({
    item_key: `AL:${x.allowance_id}`,
    type: "EARNING",
    category: "ALLOWANCE",
    description: x.description || "Allowance",
    label: x.description || "Allowance",
    amount: x.amount_this_cutoff,
    source_table: "employee_allowance",
    source_id: x.allowance_id,
    meta: { pay_cycle: x.pay_cycle, source: x.source },
  }));

  return {
    user_id: n(args.user.id),
    employee_name: empName,
    first_name: args.user.first_name ?? null,
    last_name: args.user.last_name ?? null,
    position,
    department_name: departmentResolved,

    // rates
    daily_rate: round2(rate.baseDaily),
    hourly_rate: hourlyBase,
    monthly_rate: monthlyBase,

    // attendance
    total_days_worked: daysWorked,
    total_work_minutes: totalWorkMinutes,
    late_minutes: lateMinutes,
    undertime_minutes: undertimeMinutes,
    overtime_minutes: overtimeMinutes,
    night_diff_minutes: nightDiffMinutes,

    // earnings
    basic_pay: round2(basicPay),
    ot_amount: round2(otAmount),
    holiday_pay: round2(holidayPay),
    holiday_days: round2(holidayItems.filter((x) => n(x.total) > 0).length),

    rest_day_amount: round2(restDayAmount),
    night_diff_amount: round2(nightDiffAmount),
    allowance: round2(allowance),
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

    total_additions: totalEarnings,
    total_deductions: round2(totalDeductions),
    gross_pay: round2(grossPay),
    net_pay: round2(netPay),

    previous_net_pay: prev,
    variance_amount_ui: varianceAmountUI,
    variance_pct: variancePct,
    variance_flag: Boolean(varianceFlag),

    on_hold: Boolean(args.onHold),
    is_card: n(args.wage?.isCard ?? args.wage?.is_card),

    is_prorated: Boolean(isProrated),
    proration_json: prorationJson,

    breakdown_json: {
      is_card: n(args.wage?.isCard ?? args.wage?.is_card),
      flags: { on_hold: Boolean(args.onHold), variance_flag: Boolean(varianceFlag), paid_holiday: paidHoliday },
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
        allowance_items: allowance_items,

        // ✅ base manual additions (retro excluded)
        manual_additions: round2(manualAdds),
        manual_addition_items: itemizedBase.manual_addition_items,

        // ✅ retro pay (multiple per cutoff supported)
        retro_pay: round2(retroPay),

        // NEW canonical field for payroll_run_employee_item sync
        retro_items: retro_items_all.map((x) => ({
          ...x,
          type: "EARNING",
          category: "RETRO_PAY",
          label: x.description,
        })),

        // Backward-compat (your older UI may be reading this)
        retro_pay_items: retro_pay_items.map((x) => ({
          ...x,
          type: "EARNING",
          category: "RETRO_PAY",
          label: x.description,
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
          ...x,
          type: "DEDUCTION",
          category: "COOP_SAVINGS",
          label: x.description,
        })),

        coop_loan: round2(coopLoan),
        coop_loan_items: coopLoanItemized.manual_deduction_items.map((x) => ({
          ...x,
          type: "DEDUCTION",
          category: "COOP_LOAN",
          label: x.description,
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
      policies: {
        unworked_holiday_pay_rule:
          "Pay unworked holiday ONLY if holiday.last_working_day is within cutoff and employee has approved attendance on that last_working_day.",
      },
      proration: {
        is_prorated: Boolean(isProrated),
        events_in_cutoff: prorationEventsInCutoff,
      },
    },
  } as PayrollComputedLine;
}
