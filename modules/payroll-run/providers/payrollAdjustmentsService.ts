// modules/payroll-run/providers/payrollAdjustmentsService.ts
"use client";

export type PayrollOtherAdditionRow = {
  id: number;
  user_id: number;
  amount: string | number;
  description: string | null;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  created_by: number | null;
  created_date: string;
};

export type PayrollOtherDeductionType = "SHORTAGE" | "MANUAL";

export type PayrollOtherDeductionRow = {
  id: number;
  user_id: number;
  amount: string | number;
  type: PayrollOtherDeductionType;
  description: string | null;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  created_by: number | null;
  created_date: string;
};

export type DRPaymentMethod =
  | "PAYROLL_DEDUCTION"
  | "CASH"
  | "CHECK"
  | "BANK_TRANSFER"
  | "OTHERS";

export type DRPaymentRow = {
  dr_payment_id: number;
  delivery_receipt_number: string;
  employee_id: number;
  cutoff_from: string; // YYYY-MM-DD
  cutoff_to: string; // YYYY-MM-DD
  payroll_ref_no: string | null;
  is_posted_to_payroll: 0 | 1 | boolean;
  payment_date: string; // YYYY-MM-DD
  amount_paid: string | number;
  payment_method: DRPaymentMethod | null;
  remarks: string | null;
  created_at: string;
  created_by: number | null;
};

/**
 * ✅ NEW: Dedicated collections (Directus resources)
 * These will only work if you created the collections AND whitelisted them in /app/api/payroll-run/route.ts
 */
export type RetroPayRow = {
  id: number;
  user_id: number;
  amount: string | number;
  description: string | null;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  created_by: number | null;
  created_date: string;
};

export type CoopSavingsMembershipRow = {
  id: number;
  user_id: number;
  amount: string | number;
  description: string | null;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  created_by: number | null;
  created_date: string;
};

type DirectusList<T> = { data: T[] };
type DirectusSingle<T> = { data: T };

function buildProxyUrl(
  resource: string,
  opts?: { id?: number | string; params?: Record<string, string> },
) {
  const sp = new URLSearchParams();
  sp.set("resource", resource);

  if (opts?.id != null && String(opts.id).trim() !== "") {
    sp.set("id", String(opts.id));
  }

  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v == null) continue;
      sp.set(k, String(v));
    }
  }

  return `/api/payroll-run?${sp.toString()}`;
}

function jsonErrorMessage(json: unknown, fallback: string) {
  const e = json as Record<string, unknown>;
  const errors = e?.errors as Record<string, unknown>[];
  return (errors?.[0]?.message as string) || (e?.error as string) || (e?.message as string) || fallback;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers as Record<string, string>),
    },
    ...init,
  });

  // proxy returns 204/205 for DELETE
  if (res.status === 204 || res.status === 205) return null as unknown as T;

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    throw new Error(jsonErrorMessage(json, `Request failed (${res.status})`));
  }

  return json as T;
}

function cutoffParams(userId: number, cutoffStart: string, cutoffEnd: string) {
  return {
    "filter[user_id][_eq]": String(userId),
    "filter[cutoff_start][_eq]": cutoffStart,
    "filter[cutoff_end][_eq]": cutoffEnd,
    sort: "-id",
    limit: "200",
  };
}

/* =========================
   LIST
========================= */

export async function listOtherAdditions(params: {
  userId: number;
  cutoffStart: string;
  cutoffEnd: string;
}): Promise<PayrollOtherAdditionRow[]> {
  const url = buildProxyUrl("payroll_other_additions", {
    params: cutoffParams(params.userId, params.cutoffStart, params.cutoffEnd),
  });

  const out = await apiFetch<DirectusList<PayrollOtherAdditionRow>>(url);
  return Array.isArray(out?.data) ? out.data : [];
}

export async function listOtherDeductions(params: {
  userId: number;
  cutoffStart: string;
  cutoffEnd: string;
}): Promise<PayrollOtherDeductionRow[]> {
  const url = buildProxyUrl("payroll_other_deductions", {
    params: cutoffParams(params.userId, params.cutoffStart, params.cutoffEnd),
  });

  const out = await apiFetch<DirectusList<PayrollOtherDeductionRow>>(url);
  return Array.isArray(out?.data) ? out.data : [];
}

export async function listDRPayments(params: {
  employeeId: number;
  cutoffFrom: string;
  cutoffTo: string;
  unpostedOnly?: boolean; // default true
  payrollDeductionOnly?: boolean; // default true
}): Promise<DRPaymentRow[]> {
  const p: Record<string, string> = {
    "filter[employee_id][_eq]": String(params.employeeId),
    "filter[cutoff_from][_eq]": params.cutoffFrom,
    "filter[cutoff_to][_eq]": params.cutoffTo,
    sort: "-dr_payment_id",
    limit: "200",
  };

  if (params.unpostedOnly !== false) {
    p["filter[is_posted_to_payroll][_eq]"] = "0";
  }

  if (params.payrollDeductionOnly !== false) {
    p["filter[payment_method][_eq]"] = "PAYROLL_DEDUCTION";
  }

  const url = buildProxyUrl("dr_payment", { params: p });

  const out = await apiFetch<DirectusList<DRPaymentRow>>(url);
  return Array.isArray(out?.data) ? out.data : [];
}

/**
 * ✅ NEW: Retro Pay + Coop Savings Membership
 */
export async function listRetroPay(params: {
  userId: number;
  cutoffStart: string;
  cutoffEnd: string;
}): Promise<RetroPayRow[]> {
  const url = buildProxyUrl("retro_pay", {
    params: cutoffParams(params.userId, params.cutoffStart, params.cutoffEnd),
  });

  const out = await apiFetch<DirectusList<RetroPayRow>>(url);
  return Array.isArray(out?.data) ? out.data : [];
}

export async function listCoopSavingsMembership(params: {
  userId: number;
  cutoffStart: string;
  cutoffEnd: string;
}): Promise<CoopSavingsMembershipRow[]> {
  const url = buildProxyUrl("coop_savings_membership", {
    params: cutoffParams(params.userId, params.cutoffStart, params.cutoffEnd),
  });

  const out = await apiFetch<DirectusList<CoopSavingsMembershipRow>>(url);
  return Array.isArray(out?.data) ? out.data : [];
}

/* =========================
   CREATE
========================= */

export async function createOtherAddition(payload: {
  user_id: number;
  amount: number;
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  created_by?: number | null;
}): Promise<PayrollOtherAdditionRow> {
  const url = buildProxyUrl("payroll_other_additions");

  const out = await apiFetch<DirectusSingle<PayrollOtherAdditionRow>>(url, {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.user_id,
      amount: payload.amount,
      description: payload.description ?? null,
      cutoff_start: payload.cutoff_start,
      cutoff_end: payload.cutoff_end,
      created_by: payload.created_by ?? null,
    }),
  });

  return out.data;
}

export async function createOtherDeduction(payload: {
  user_id: number;
  amount: number;
  type: PayrollOtherDeductionType;
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  created_by?: number | null;
}): Promise<PayrollOtherDeductionRow> {
  const url = buildProxyUrl("payroll_other_deductions");

  const out = await apiFetch<DirectusSingle<PayrollOtherDeductionRow>>(url, {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.user_id,
      amount: payload.amount,
      type: payload.type,
      description: payload.description ?? null,
      cutoff_start: payload.cutoff_start,
      cutoff_end: payload.cutoff_end,
      created_by: payload.created_by ?? null,
    }),
  });

  return out.data;
}

export async function createDRPayment(payload: {
  employee_id: number;
  cutoff_from: string;
  cutoff_to: string;
  delivery_receipt_number: string;
  payment_date: string;
  amount_paid: number;
  payment_method?: DRPaymentMethod | null; // default PAYROLL_DEDUCTION
  remarks?: string | null;
  created_by?: number | null;
}): Promise<DRPaymentRow> {
  const url = buildProxyUrl("dr_payment");

  const out = await apiFetch<DirectusSingle<DRPaymentRow>>(url, {
    method: "POST",
    body: JSON.stringify({
      employee_id: payload.employee_id,
      cutoff_from: payload.cutoff_from,
      cutoff_to: payload.cutoff_to,
      delivery_receipt_number: payload.delivery_receipt_number,
      payroll_ref_no: null,
      is_posted_to_payroll: 0,
      payment_date: payload.payment_date,
      amount_paid: payload.amount_paid,
      payment_method: payload.payment_method ?? "PAYROLL_DEDUCTION",
      remarks: payload.remarks ?? null,
      created_by: payload.created_by ?? null,
    }),
  });

  return out.data;
}

/**
 * ✅ NEW: Retro Pay + Coop Savings Membership
 */
export async function createRetroPay(payload: {
  user_id: number;
  amount: number;
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  created_by?: number | null;
}): Promise<RetroPayRow> {
  const url = buildProxyUrl("retro_pay");

  const out = await apiFetch<DirectusSingle<RetroPayRow>>(url, {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.user_id,
      amount: payload.amount,
      description: payload.description ?? null,
      cutoff_start: payload.cutoff_start,
      cutoff_end: payload.cutoff_end,
      created_by: payload.created_by ?? null,
    }),
  });

  return out.data;
}

export async function createCoopSavingsMembership(payload: {
  user_id: number;
  amount: number;
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  created_by?: number | null;
}): Promise<CoopSavingsMembershipRow> {
  const url = buildProxyUrl("coop_savings_membership");

  const out = await apiFetch<DirectusSingle<CoopSavingsMembershipRow>>(url, {
    method: "POST",
    body: JSON.stringify({
      user_id: payload.user_id,
      amount: payload.amount,
      description: payload.description ?? null,
      cutoff_start: payload.cutoff_start,
      cutoff_end: payload.cutoff_end,
      created_by: payload.created_by ?? null,
    }),
  });

  return out.data;
}

/* =========================
   UPDATE ✅ (integrated here)
========================= */

export async function updateOtherAddition(
  id: number,
  patch: {
    amount?: number;
    description?: string | null;
    created_by?: number | null; // optional audit
  },
): Promise<PayrollOtherAdditionRow> {
  const url = buildProxyUrl("payroll_other_additions", { id });

  const out = await apiFetch<DirectusSingle<PayrollOtherAdditionRow>>(url, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.amount != null ? { amount: patch.amount } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.created_by !== undefined ? { created_by: patch.created_by } : {}),
    }),
  });

  return out.data;
}

export async function updateOtherDeduction(
  id: number,
  patch: {
    amount?: number;
    description?: string | null;
    type?: PayrollOtherDeductionType;
    created_by?: number | null; // optional audit
  },
): Promise<PayrollOtherDeductionRow> {
  const url = buildProxyUrl("payroll_other_deductions", { id });

  const out = await apiFetch<DirectusSingle<PayrollOtherDeductionRow>>(url, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.amount != null ? { amount: patch.amount } : {}),
      ...(patch.type != null ? { type: patch.type } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.created_by !== undefined ? { created_by: patch.created_by } : {}),
    }),
  });

  return out.data;
}

export async function updateDRPayment(
  drPaymentId: number,
  patch: {
    delivery_receipt_number?: string;
    payment_date?: string;
    amount_paid?: number;
    payment_method?: DRPaymentMethod | null;
    remarks?: string | null;
    created_by?: number | null; // optional audit
  },
): Promise<DRPaymentRow> {
  const url = buildProxyUrl("dr_payment", { id: drPaymentId });

  const out = await apiFetch<DirectusSingle<DRPaymentRow>>(url, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.delivery_receipt_number != null
        ? { delivery_receipt_number: patch.delivery_receipt_number }
        : {}),
      ...(patch.payment_date != null
        ? { payment_date: patch.payment_date }
        : {}),
      ...(patch.amount_paid != null ? { amount_paid: patch.amount_paid } : {}),
      ...(patch.payment_method !== undefined
        ? { payment_method: patch.payment_method }
        : {}),
      ...(patch.remarks !== undefined ? { remarks: patch.remarks } : {}),
      ...(patch.created_by !== undefined ? { created_by: patch.created_by } : {}),
    }),
  });

  return out.data;
}

/**
 * ✅ NEW: Retro Pay + Coop Savings Membership
 */
export async function updateRetroPay(
  id: number,
  patch: {
    amount?: number;
    description?: string | null;
    created_by?: number | null; // optional audit
  },
): Promise<RetroPayRow> {
  const url = buildProxyUrl("retro_pay", { id });

  const out = await apiFetch<DirectusSingle<RetroPayRow>>(url, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.amount != null ? { amount: patch.amount } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.created_by !== undefined ? { created_by: patch.created_by } : {}),
    }),
  });

  return out.data;
}

export async function updateCoopSavingsMembership(
  id: number,
  patch: {
    amount?: number;
    description?: string | null;
    created_by?: number | null; // optional audit
  },
): Promise<CoopSavingsMembershipRow> {
  const url = buildProxyUrl("coop_savings_membership", { id });

  const out = await apiFetch<DirectusSingle<CoopSavingsMembershipRow>>(url, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.amount != null ? { amount: patch.amount } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.created_by !== undefined ? { created_by: patch.created_by } : {}),
    }),
  });

  return out.data;
}

/* =========================
   DELETE
========================= */

export async function deleteOtherAddition(id: number): Promise<void> {
  const url = buildProxyUrl("payroll_other_additions", { id });
  await apiFetch(url, { method: "DELETE" });
}

export async function deleteOtherDeduction(id: number): Promise<void> {
  const url = buildProxyUrl("payroll_other_deductions", { id });
  await apiFetch(url, { method: "DELETE" });
}

export async function deleteDRPayment(drPaymentId: number): Promise<void> {
  const url = buildProxyUrl("dr_payment", { id: drPaymentId });
  await apiFetch(url, { method: "DELETE" });
}

/**
 * ✅ NEW: Retro Pay + Coop Savings Membership
 */
export async function deleteRetroPay(id: number): Promise<void> {
  const url = buildProxyUrl("retro_pay", { id });
  await apiFetch(url, { method: "DELETE" });
}

export async function deleteCoopSavingsMembership(id: number): Promise<void> {
  const url = buildProxyUrl("coop_savings_membership", { id });
  await apiFetch(url, { method: "DELETE" });
}

/* =========================
   MULTI-CUTOFF DEDUCTIONS
========================= */

export type CutoffSettingBrief = {
  id: number;
  cutoff_type: "FIRST" | "SECOND" | string;
  start_date: string;
  end_date: string;
  month?: number;
  year?: number;
  period_status?: string;
};

export async function listCutoffSettings(): Promise<CutoffSettingBrief[]> {
  try {
    const url = buildProxyUrl("cutoff_settings", {
      params: {
        sort: "start_date",
        limit: "500",
      },
    });
    const out = await apiFetch<DirectusList<CutoffSettingBrief>>(url);
    return Array.isArray(out?.data) ? out.data : [];
  } catch (err) {
    console.warn("[payrollAdjustmentsService] listCutoffSettings error:", err);
    return [];
  }
}

/**
 * Projects the next cutoff date range based on the current one.
 * Supports:
 * - 26th -> 10th (FIRST) followed by 11th -> 25th (SECOND)
 * - 1st -> 15th followed by 16th -> end of month
 */
export function projectNextCutoff(current: { start_date: string; end_date: string }): {
  start_date: string;
  end_date: string;
} {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

  const sParts = current.start_date.substring(0, 10).split("-").map(Number);
  const eParts = current.end_date.substring(0, 10).split("-").map(Number);

  const startYear = sParts[0];
  const startMonth = sParts[1]; // 1-12
  const startDay = sParts[2];

  const endYear = eParts[0];
  const endMonth = eParts[1];
  const endDay = eParts[2];

  // Pattern 1: 26th-10th & 11th-25th convention
  if (startDay >= 24 && startDay <= 28) {
    // Current is FIRST (e.g. 26th of prev month to 10th of this month)
    // Next is SECOND (11th to 25th of endMonth/endYear)
    return {
      start_date: ymd(endYear, endMonth, 11),
      end_date: ymd(endYear, endMonth, 25),
    };
  }

  if (startDay >= 9 && startDay <= 13 && endDay >= 23 && endDay <= 27) {
    // Current is SECOND (e.g. 11th to 25th of this month)
    // Next is FIRST (26th of this month to 10th of next month)
    let nextMonth = startMonth + 1;
    let nextYear = startYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    return {
      start_date: ymd(startYear, startMonth, 26),
      end_date: ymd(nextYear, nextMonth, 10),
    };
  }

  // Pattern 2: 1st-15th & 16th-End convention
  if (startDay === 1 && endDay >= 14 && endDay <= 16) {
    // Current is 1st to 15th
    // Next is 16th to end of month
    const lastDayOfMonth = new Date(startYear, startMonth, 0).getDate();
    return {
      start_date: ymd(startYear, startMonth, 16),
      end_date: ymd(startYear, startMonth, lastDayOfMonth),
    };
  }

  if (startDay >= 15 && startDay <= 17) {
    // Current is 16th to end of month
    // Next is 1st to 15th of next month
    let nextMonth = startMonth + 1;
    let nextYear = startYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    return {
      start_date: ymd(nextYear, nextMonth, 1),
      end_date: ymd(nextYear, nextMonth, 15),
    };
  }

  // Generic fallback: shift by duration
  const sDate = new Date(current.start_date);
  const eDate = new Date(current.end_date);
  const diffMs = eDate.getTime() - sDate.getTime();
  const nextStart = new Date(eDate.getTime() + 24 * 60 * 60 * 1000);
  const nextEnd = new Date(nextStart.getTime() + diffMs);

  return {
    start_date: nextStart.toISOString().substring(0, 10),
    end_date: nextEnd.toISOString().substring(0, 10),
  };
}

/**
 * Resolves the next `count` cutoff windows starting from current cutoff.
 * Tries to use database cutoff_settings first, then projects any remainder.
 */
export async function resolveUpcomingCutoffs(args: {
  currentStart: string;
  currentEnd: string;
  count: number;
}): Promise<Array<{ start_date: string; end_date: string; label?: string }>> {
  const { currentStart, currentEnd, count } = args;
  if (count <= 0) return [];

  const cutoffs = await listCutoffSettings();
  const sorted = [...cutoffs].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  const curIdx = sorted.findIndex(
    (c) => c.start_date.substring(0, 10) === currentStart.substring(0, 10)
  );

  const results: Array<{ start_date: string; end_date: string; label?: string }> = [];

  if (curIdx >= 0) {
    const dbCutoffs = sorted.slice(curIdx, curIdx + count);
    for (const c of dbCutoffs) {
      results.push({
        start_date: c.start_date.substring(0, 10),
        end_date: c.end_date.substring(0, 10),
        label: c.cutoff_type,
      });
    }
  } else {
    // Current not found in DB list, use current directly
    results.push({
      start_date: currentStart.substring(0, 10),
      end_date: currentEnd.substring(0, 10),
    });
  }

  // If DB didn't have enough future cutoffs, project the rest
  while (results.length < count) {
    const last = results[results.length - 1];
    const next = projectNextCutoff(last);
    results.push(next);
  }

  return results.slice(0, count);
}

/**
 * Creates multi-cutoff deduction entries for an employee.
 * It creates one payroll_other_deductions record per cutoff period.
 */
export async function createMultiCutoffDeductions(payload: {
  user_id: number;
  total_amount?: number;
  amount_per_cutoff?: number;
  num_cutoffs: number;
  description: string;
  start_cutoff_start: string;
  start_cutoff_end: string;
  created_by?: number | null;
}): Promise<PayrollOtherDeductionRow[]> {
  const count = Math.max(1, payload.num_cutoffs);
  const total =
    payload.total_amount != null && payload.total_amount > 0
      ? payload.total_amount
      : (payload.amount_per_cutoff ?? 0) * count;

  const standardAmort = Math.round((total / count) * 100) / 100;

  const cutoffs = await resolveUpcomingCutoffs({
    currentStart: payload.start_cutoff_start,
    currentEnd: payload.start_cutoff_end,
    count,
  });

  const createdRows: PayrollOtherDeductionRow[] = [];
  let accumulatedSoFar = 0;

  for (let i = 0; i < cutoffs.length; i++) {
    const c = cutoffs[i];
    const isLast = i === cutoffs.length - 1;
    // On the last cutoff, take the exact remainder so the total matches precisely
    const cutoffAmount = isLast
      ? Math.round((total - accumulatedSoFar) * 100) / 100
      : standardAmort;

    accumulatedSoFar += cutoffAmount;

    const installmentDesc =
      count > 1
        ? `${payload.description.trim()} (${i + 1}/${count})`
        : payload.description.trim();

    const row = await createOtherDeduction({
      user_id: payload.user_id,
      amount: cutoffAmount,
      type: "MANUAL",
      description: installmentDesc,
      cutoff_start: c.start_date,
      cutoff_end: c.end_date,
      created_by: payload.created_by ?? null,
    });

    createdRows.push(row);
  }

  return createdRows;
}

