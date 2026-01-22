// modules/payroll-run/utils/compute.ts
import type {
  AttendanceApproval,
  BenefitCode,
  EmployeeLoan,
  HolidayRow,
  ManualEntry,
  PayrollComputedLine,
  UserRow,
  WageProfile,
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

  // Benefit deduction logic (govt contrib)
  benefitMultipliers: Record<BenefitCode, number>;

  // Employee loans (VALE/CAR LOAN/COOP) 50/50 per cutoff
  employeeLoans: EmployeeLoan[];

  // Benefit loans (SSS/PAGIBIG)
  benefitLoans?: any[];
  cutoffType?: "FIRST" | "SECOND";
  cutoffId?: number;
};

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
    type: (String(row.holiday_type ?? row.holidayType ?? "regular").toLowerCase() as HolidayKind),
    description: s(row.description ?? row.name ?? ""),
    is_paid: n(row.is_paid ?? row.isPaid ?? 1) ? 1 : 0,
  };
}

// Priority if multiple holiday rows exist for same date:
// regular > special > company
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
  if (t === "company") return "SPECIAL"; // pragmatic default: treat company holiday like special
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

  // combined cases (holiday + rest)
  if (isRestDay && holiday === "SPECIAL") return { baseMult: 1.5, otMult: 1.95, bucket: "HOLIDAY" };
  if (isRestDay && holiday === "REGULAR") return { baseMult: 2.6, otMult: 3.38, bucket: "HOLIDAY" };

  // holiday only
  if (!isRestDay && holiday === "SPECIAL") return { baseMult: 1.3, otMult: 1.69, bucket: "HOLIDAY" };
  if (!isRestDay && holiday === "REGULAR") return { baseMult: 2.0, otMult: 2.6, bucket: "HOLIDAY" };

  // rest day only
  if (isRestDay && holiday === "NONE") return { baseMult: 1.3, otMult: 1.69, bucket: "REST" };

  // normal
  return { baseMult: 1.0, otMult: 1.0, bucket: "NORMAL" };
}

// ✅ Benefit loans
function normBenefitLoan(row: any) {
  return {
    loan_id: n(row.loan_id ?? row.id),
    user_id: n(row.user_id),
    benefit_code: String(row.benefit_code ?? "").toUpperCase(), // "SSS" | "PAGIBIG"
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

export function computeEmployeeLine(args: ComputeArgs): PayrollComputedLine {
  const empName = buildName(args.user);

  const daily = n(args.wage?.daily_wage);
  const hourly =
    args.wage?.hourly_wage != null ? n(args.wage.hourly_wage) : daily > 0 ? daily / 8 : 0;

  // Use DAILY-based minute rate (per your statutory formula)
  const DR = daily > 0 ? daily : hourly > 0 ? hourly * 8 : 0;
  const MR = DR > 0 ? DR / 480 : 0;

  const monthly =
    args.wage?.monthly_wage != null ? n(args.wage.monthly_wage) : daily > 0 ? daily * 26 : 0;

  // Attendance rows
  const att = (args.attendance ?? [])
    .map(normAttendance)
    .filter((r) => String(r.status ?? "").toLowerCase() === "approved");

  // Holiday map
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

  // Totals (minutes)
  let totalWorkMinutes = 0;
  let lateMinutes = 0;
  let undertimeMinutes = 0;
  let overtimeMinutes = 0;
  let nightDiffMinutes = 0;

  // Earnings buckets
  let basicPay = 0;
  let otAmount = 0;

  let holidayPay = 0;   // includes combined rest+holiday cases
  let restDayAmount = 0; // rest day only (Sunday, non-holiday)

  const holidayItems: Array<{
    date: string;
    holiday: HolidayFlag;
    is_rest_day: boolean;
    base_minutes: number;
    ot_minutes: number;
    base_mult: number;
    ot_mult: number;
    pay: number;
    ot_pay: number;
    total: number;
    description: string;
    pay_type: "WORKED_PREMIUM" | "UNWORKED_HOLIDAY_PAY";
  }> = [];


  const restDayItems: Array<{
    date: string;
    base_minutes: number;
    ot_minutes: number;
    base_mult: number;
    ot_mult: number;
    pay: number;
    ot_pay: number;
    total: number;
  }> = [];

  // Iterate attendance rows and compute day-by-day
  for (const r of att) {
    const date = r.date_schedule;
    const h = holidayMap.get(date) ?? null;
    const holidayFlag = toHolidayFlag(h);
    const rd = isSunday(date);

    const wmRaw = n(r.work_minutes);
    const omRaw = n(r.overtime_minutes);

    // base minutes always capped at 480
    const baseMin = Math.min(wmRaw, 480);

    // OT minutes: trust overtime_minutes, but if work_minutes > 480 and OT not provided, don't underpay
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

    // pay using minute-rate formula
    const basePay = round2(baseMin * MR * baseMult);
    const otPay = round2(otMin * MR * otMult);
    const dayTotal = round2(basePay + otPay);

    // ✅ No late/undertime deductions on:
    // - any holiday (including combined rest+holiday)
    // - rest day only
    if (bucket === "NORMAL") {
      lateMinutes += lm;
      undertimeMinutes += um;

      // Normal day buckets (kept separate for UI)
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
      });
    } else {
      // HOLIDAY bucket includes:
      // - holiday only
      // - rest day + holiday combined (no stacking)
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
      });

    }
  }

  basicPay = round2(basicPay);
  otAmount = round2(otAmount);
  holidayPay = round2(holidayPay);
  restDayAmount = round2(restDayAmount);

  // Paid holidays with NO attendance row:
  // Pay = Daily Rate (no premium; premium is for "worked" cases)
  for (const [date, h] of holidayMap.entries()) {
    if (!h.is_paid) continue;
    if (attendedDates.has(date)) continue;

    const pay = round2(DR);
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
    });
  }


  const nightDiffAmount = round2((nightDiffMinutes / 60) * hourly * 0.1);
  const totalDaysWorked = totalWorkMinutes > 0 ? round2(totalWorkMinutes / 480) : 0;

  // Manual entries
  const manualAdds = (args.manualEntries ?? [])
    .filter((m) => m.type === "EARNING")
    .reduce((sum, m) => sum + n(m.amount), 0);

  const manualDedsAll = (args.manualEntries ?? [])
    .filter((m) => m.type === "DEDUCTION")
    .reduce((sum, m) => sum + n(m.amount), 0);

  const shortage = (args.manualEntries ?? [])
    .filter((m) => m.type === "DEDUCTION")
    .filter((m) => {
      const cat = s(m.category).trim().toLowerCase();
      const desc = s(m.desc).trim().toLowerCase();
      return cat === "shortage" || desc.includes("shortage");
    })
    .reduce((sum, m) => sum + n(m.amount), 0);

  const shortageDeduction = round2(shortage);
  const manualDeductions = round2(manualDedsAll);
  const otherDeductions = round2(manualDeductions - shortageDeduction);

  // Time-based deductions (ONLY from normal days)
  const lateDeduction = round2((lateMinutes / 60) * hourly);
  const undertimeDeduction = round2((undertimeMinutes / 60) * hourly);

  // Govt benefits
  const multSSS = n(args.benefitMultipliers?.SSS ?? 0);
  const multPhil = n(args.benefitMultipliers?.PHILHEALTH ?? 0);
  const multPagibig = n(args.benefitMultipliers?.PAGIBIG ?? 0);

  const sssMonthly = n(args.wage?.sss_employee);
  const philMonthly = n(args.wage?.philhealth_employee);
  const pagibigMonthly = n(args.wage?.pagibig_employee);

  const benefitSSS = round2(sssMonthly * multSSS);
  const benefitPhilhealth = round2(philMonthly * multPhil);
  const benefitPagibig = round2(pagibigMonthly * multPagibig);

  // Employee loans 50/50
  const loanHalf = (monthlyPayment: number) => round2(n(monthlyPayment) / 2);

  let loanVale = 0;
  let loanCar = 0;
  let loanCoop = 0;

  for (const L of args.employeeLoans ?? []) {
    const half = loanHalf(L.monthly_payment);
    if (L.loan_type === "VALE") loanVale += half;
    else if (L.loan_type === "CAR LOAN") loanCar += half;
    else if (L.loan_type === "COOP") loanCoop += half;
  }

  loanVale = round2(loanVale);
  loanCar = round2(loanCar);
  loanCoop = round2(loanCoop);

  const loanTotal = round2(loanVale + loanCar + loanCoop);

  // Benefit loans (SSS/PAGIBIG)
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
    bLoanItems
      .filter((x) => x.benefit_code === "SSS")
      .reduce((sum, x) => sum + n(x.amount_this_cutoff), 0),
  );

  const benefitLoanPagibig = round2(
    bLoanItems
      .filter((x) => x.benefit_code === "PAGIBIG")
      .reduce((sum, x) => sum + n(x.amount_this_cutoff), 0),
  );

  const benefitLoanTotal = round2(benefitLoanSSS + benefitLoanPagibig);

  // Not wired yet
  const allowance = 0;
  const retroPay = 0;
  const drDeduction = 0;

  const grossPay = round2(
    basicPay +
    otAmount +
    holidayPay +
    restDayAmount +
    nightDiffAmount +
    allowance +
    retroPay +
    manualAdds,
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
    otherDeductions,
  );

  const netPay = round2(grossPay - totalDeductions);

  const prev = n(args.previousNetPay);
  const variancePct = prev > 0 ? round2(((netPay - prev) / prev) * 100) : null;
  const varianceFlag = prev > 0 && Math.abs(n(variancePct)) >= 10;

  return {
    user_id: args.user.id,
    employee_name: empName,
    position: args.user.position ?? null,
    department_name: args.departmentName ?? null,

    daily_rate: round2(daily),
    hourly_rate: round2(hourly),
    monthly_rate: round2(monthly),

    total_days_worked: totalDaysWorked,
    total_work_minutes: totalWorkMinutes,
    late_minutes: lateMinutes,
    undertime_minutes: undertimeMinutes,
    overtime_minutes: overtimeMinutes,
    night_diff_minutes: nightDiffMinutes,

    // Earnings
    basic_pay: round2(basicPay),
    ot_amount: round2(otAmount),
    holiday_pay: round2(holidayPay),
    rest_day_amount: round2(restDayAmount),
    night_diff_amount: nightDiffAmount,
    allowance,
    retro_pay: retroPay,
    manual_additions: round2(manualAdds),

    // Deductions
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
        daily: DR,
        minute_rate: MR,
        hourly,
        monthly,
      },
      earnings: {
        basic_pay: round2(basicPay),
        ot_amount: round2(otAmount),
        holiday_pay: round2(holidayPay),
        rest_day_amount: round2(restDayAmount),
        night_diff_amount: nightDiffAmount,
        manual_additions: round2(manualAdds),
        holiday_items: holidayItems,
        rest_day_items: restDayItems,
        rate_matrix: {
          regular_only: { base: 2.0, ot: 2.6 },
          rest_only: { base: 1.3, ot: 1.69 },
          special_plus_rest: { base: 1.5, ot: 1.95 },
          regular_plus_rest: { base: 2.6, ot: 3.38 },
        },
      },
      deductions: {
        late_deduction: lateDeduction,
        undertime_deduction: undertimeDeduction,
        shortage_deduction: shortageDeduction,
        employee_loans: {
          rule: "50/50 per cutoff",
          vale: loanVale,
          car_loan: loanCar,
          coop: loanCoop,
          total: loanTotal,
        },
        benefit_loans: {
          rule: 'If deduct_on="BOTH" then 50/50 per cutoff; else deduct full on matching cutoff',
          sss: benefitLoanSSS,
          pagibig: benefitLoanPagibig,
          total: benefitLoanTotal,
          items: bLoanItems,
        },
        benefits: {
          rule: "benefit_cutoff_settings",
          multipliers: { SSS: multSSS, PHILHEALTH: multPhil, PAGIBIG: multPagibig },
          sss: benefitSSS,
          philhealth: benefitPhilhealth,
          pagibig: benefitPagibig,
        },
        other_deductions: otherDeductions,
        manual_deductions: manualDeductions,
      },
      totals: {
        gross_pay: grossPay,
        total_deductions: totalDeductions,
        net_pay: netPay,
      },
      cutoff: { start: args.cutoffStart, end: args.cutoffEnd, type: args.cutoffType, id: args.cutoffId },
      flags: { on_hold: Boolean(args.onHold), variance_flag: varianceFlag },
    },
  } as any;
}
