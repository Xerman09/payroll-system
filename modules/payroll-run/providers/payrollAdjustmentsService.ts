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

type DirectusList<T> = { data: T[] };
type DirectusSingle<T> = { data: T };

function buildProxyUrl(resource: string, opts?: { id?: number | string; params?: Record<string, string> }) {
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

function jsonErrorMessage(json: any, fallback: string) {
  return (
    json?.errors?.[0]?.message ||
    json?.error ||
    json?.message ||
    fallback
  );
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as any),
    },
    ...init,
  });

  // your proxy returns 204 for DELETE
  if (res.status === 204 || res.status === 205) return null as unknown as T;

  const text = await res.text();
  let json: any = null;
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

function buildCutoffListParams(userId: number, cutoffStart: string, cutoffEnd: string) {
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
    params: buildCutoffListParams(params.userId, params.cutoffStart, params.cutoffEnd),
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
    params: buildCutoffListParams(params.userId, params.cutoffStart, params.cutoffEnd),
  });

  const out = await apiFetch<DirectusList<PayrollOtherDeductionRow>>(url);
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

/* =========================
   UPDATE
========================= */

export async function updateOtherAddition(
  id: number,
  patch: { amount?: number; description?: string | null },
): Promise<PayrollOtherAdditionRow> {
  const url = buildProxyUrl("payroll_other_additions", { id });

  const out = await apiFetch<DirectusSingle<PayrollOtherAdditionRow>>(url, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.amount != null ? { amount: patch.amount } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
    }),
  });

  return out.data;
}

export async function updateOtherDeduction(
  id: number,
  patch: { amount?: number; description?: string | null; type?: PayrollOtherDeductionType },
): Promise<PayrollOtherDeductionRow> {
  const url = buildProxyUrl("payroll_other_deductions", { id });

  const out = await apiFetch<DirectusSingle<PayrollOtherDeductionRow>>(url, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.amount != null ? { amount: patch.amount } : {}),
      ...(patch.type != null ? { type: patch.type } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
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
