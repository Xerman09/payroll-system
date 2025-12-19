import useSWR from "swr";
import { Allowance, AllowanceListParams, User } from "../types";

// Helper interface for the API call to support ID filtering
export interface ExtendedParams extends AllowanceListParams {
  filterUserIds?: number[] | null;
}

const API_ROUTE = "/api/allowance";

/* ===========================
   UTILITIES
   =========================== */

export function iso(date: Date) {
  return date.toISOString().split("T")[0];
}

export function formatCurrency(v: string | number) {
  const num = typeof v === "string" ? Number(v) : v;
  if (isNaN(num)) return v;
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

export function computeCutoffFromDate(dStr: string) {
  if (!dStr) return { start: "", end: "" };
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return { start: "", end: "" };
  const day = d.getDate();
  const y = d.getFullYear();
  const m = d.getMonth();

  let start: Date, end: Date;
  if (day >= 11 && day <= 25) {
    start = new Date(y, m, 11);
    end = new Date(y, m, 25);
  } else if (day >= 26) {
    start = new Date(y, m, 26);
    end = new Date(y, m + 1, 10);
  } else {
    // days 1..10
    start = new Date(y, m - 1, 26);
    end = new Date(y, m, 10);
  }
  return { start: iso(start), end: iso(end) };
}

/* ===========================
   FETCHERS & API CALLS
   =========================== */

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

async function getAllowancesList(params: ExtendedParams) {
  const sp = new URLSearchParams();
  sp.append("limit", String(params.pageSize));
  sp.append("offset", String((params.page - 1) * params.pageSize));
  sp.append("meta", "filter_count");
  sp.append("sort", "-created_date");

  // 1. Filter: Processed Status
  if (params.processed === "processed") sp.append("filter[is_processed][_eq]", "1");
  if (params.processed === "unprocessed") sp.append("filter[is_processed][_eq]", "0");

  // 2. Filter: Description
  if (params.searchDescription) {
    sp.append("filter[description][_icontains]", params.searchDescription.trim());
  }

  // 3. Filter: Employee by IDs (Robust Method)
  // Instead of filtering by a virtual name string, we filter by the actual User IDs 
  // that matched the search on the client side.
  if (params.filterUserIds !== undefined && params.filterUserIds !== null) {
    if (params.filterUserIds.length > 0) {
      // We found users matching the name, search for their specific IDs
      sp.append("filter[user_id][_in]", params.filterUserIds.join(","));
    } else {
      // User typed a name (e.g. "Xyza") but no user exists with that name.
      // We send a dummy ID (-1) to force the API to return 0 results.
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
    const err = await res.json();
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
    const err = await res.json();
    throw new Error(err.error || "Update failed");
  }
  return res.json();
}

export async function deleteAllowance(id: number) {
  const res = await fetch(`${API_ROUTE}?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Delete failed");
  }
  return res;
}

/* ===========================
   HOOKS
   =========================== */

export function useUsers() {
  const { data, error } = useSWR(`${API_ROUTE}?mode=users`, getUsers, {
    revalidateOnFocus: false,
  });
  return { users: data ?? [], loading: !data && !error, error };
}

export function useAllowancesQuery(params: ExtendedParams) {
  // We include filterUserIds in the key so SWR refetches when the list of IDs changes
  const userIdsKey = params.filterUserIds
    ? params.filterUserIds.join(",")
    : "all";

  const key = [
    API_ROUTE,
    params.page,
    params.pageSize,
    userIdsKey, // This triggers the refetch when search matching IDs change
    params.searchDescription,
    params.processed,
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