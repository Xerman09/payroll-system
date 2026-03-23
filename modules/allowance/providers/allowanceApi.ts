// modules/allowance/providers/allowanceApi.ts

import useSWR from "swr";
import type {
  Allowance,
  AllowanceListParams,
  User,
} from "../types";

/** Helper interface for the API call to support ID filtering */
export interface ExtendedParams extends AllowanceListParams {
  filterUserIds?: number[] | null;
}

const API_ROUTE = "/api/allowance";

/* =========================== UTILITIES =========================== */

export function iso(date: Date) {
  return date.toISOString().split("T")[0];
}

export function formatCurrency(v: string | number) {
  const num = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(num)) return String(v);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(num);
}

export function fullnameFromUser(u: User) {
  if (!u) return "Unknown";
  return `${u.user_fname}${u.user_mname ? " " + u.user_mname : ""} ${u.user_lname}`;
}

/**
 * Normalizes Directus/DB-ish truthy values.
 * Supports: boolean, 0/1, "0"/"1", { type:"Buffer", data:[0|1] }
 */
export function flagToBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  if (v && typeof v === "object") {
    const maybe = v as { data?: unknown };
    if (Array.isArray(maybe.data) && maybe.data.length > 0) {
      return maybe.data[0] === 1;
    }
  }
  return false;
}

export function computeCutoffFromDate(dStr: string) {
  if (!dStr) return { start: "", end: "" };
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return { start: "", end: "" };

  const day = d.getDate();
  const y = d.getFullYear();
  const m = d.getMonth();

  let start: Date;
  let end: Date;

  // 11–25
  if (day >= 11 && day <= 25) {
    start = new Date(y, m, 11);
    end = new Date(y, m, 25);
  } else if (day >= 26) {
    // 26–10 (cross month)
    start = new Date(y, m, 26);
    end = new Date(y, m + 1, 10);
  } else {
    // 1–10 -> previous month 26–current month 10
    start = new Date(y, m - 1, 26);
    end = new Date(y, m, 10);
  }

  return { start: iso(start), end: iso(end) };
}

/* =========================== FETCHERS & API CALLS =========================== */

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) {
      const text = await r.text();
      try {
        const json = JSON.parse(text);
        throw new Error(json.error || r.statusText);
      } catch {
        throw new Error(text || r.statusText);
      }
    }
    return r.json();
  });

async function getUsers(): Promise<User[]> {
  const json = await fetcher(`${API_ROUTE}?mode=users`);
  return json?.data ?? json ?? [];
}

function appendInFilter(sp: URLSearchParams, key: string, values: number[]) {
  // Directus expects comma-separated list
  sp.append(key, values.join(","));
}

async function getAllowancesList(params: ExtendedParams) {
  const sp = new URLSearchParams();

  sp.append("limit", String(params.pageSize));
  sp.append("offset", String((params.page - 1) * params.pageSize));
  sp.append("meta", "filter_count");
  sp.append("sort", "-created_date");

  // Always filter by mode
  if (params.mode === "one_time") {
    sp.append("filter[is_recurring][_eq]", "0");

    if (params.status === "processed") sp.append("filter[is_processed][_eq]", "1");
    if (params.status === "unprocessed") sp.append("filter[is_processed][_eq]", "0");
  } else {
    sp.append("filter[is_recurring][_eq]", "1");

    if (params.status === "active") sp.append("filter[is_active][_eq]", "1");
    if (params.status === "inactive") sp.append("filter[is_active][_eq]", "0");

    // Pay cycle filter (recurring only)
    if (params.payCycle && params.payCycle !== "all") {
      sp.append("filter[pay_cycle][_eq]", params.payCycle);
    }
  }

  // Description filter
  if (params.searchDescription?.trim()) {
    sp.append("filter[description][_icontains]", params.searchDescription.trim());
  }

  // Employee filter by IDs (client-side match)
  if (params.filterUserIds !== undefined && params.filterUserIds !== null) {
    if (params.filterUserIds.length > 0) {
      appendInFilter(sp, "filter[user_id][_in]", params.filterUserIds);
    } else {
      // Force 0 results
      sp.append("filter[user_id][_in]", "-1");
    }
  }

  const json = await fetcher(`${API_ROUTE}?${sp.toString()}`);

  const rows: Allowance[] = json?.data ?? [];
  const total: number = json?.meta?.filter_count ?? json?.meta?.total ?? rows.length;

  return { rows, total };
}

export async function createAllowance(payload: Partial<Allowance>) {
  const res = await fetch(API_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Create failed");
  }

  return res.json();
}

export async function updateAllowance(id: number, payload: Partial<Allowance>) {
  const res = await fetch(`${API_ROUTE}?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Update failed");
  }

  return res.json();
}

export async function deleteAllowance(id: number) {
  const res = await fetch(`${API_ROUTE}?id=${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Delete failed");
  }

  return res;
}

/* =========================== HOOKS =========================== */

export function useUsers() {
  const { data, error } = useSWR(`${API_ROUTE}?mode=users`, getUsers, {
    revalidateOnFocus: false,
  });

  return { users: data ?? [], loading: !data && !error, error };
}

export function useAllowancesQuery(params: ExtendedParams) {
  // include filterUserIds in key so SWR refetches when IDs change
  const userIdsKey =
    params.filterUserIds === null || params.filterUserIds === undefined
      ? "all"
      : params.filterUserIds.join(",");

  const key = [
    API_ROUTE,
    params.page,
    params.pageSize,
    params.mode,
    params.status ?? "all",
    params.payCycle ?? "all",
    userIdsKey,
    params.searchDescription ?? "",
  ];

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => getAllowancesList(params),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  );

  return {
    rows: data?.rows ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    error,
    mutate,
  };
}
