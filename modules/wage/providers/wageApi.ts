// modules/wage/providers/wageApi.ts
import type { Department, Employee, WagePayload, WageRecord } from "../types";

const BASE_API = "/api/wage";

// Generic server-side fetch through Next.js API route
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_API}?path=${encodeURIComponent(path)}`, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.json();
}

export async function fetchDepartments(): Promise<Department[]> {
  const json = await apiFetch("/items/department?limit=-1");
  return json.data || [];
}

export async function fetchEmployees(): Promise<Employee[]> {
  const json = await apiFetch("/items/user?limit=-1");
  return (json.data || []).filter(emp => !emp.is_deleted || emp.is_deleted.data?.[0] === 0);
}

// Server-side pagination + search + filters for employees
export type EmployeeListParams = {
  page: number;
  pageSize: number;
  search?: string;
  deptId?: number | null;
  sortField?: keyof Employee;
  sortOrder?: "asc" | "desc";
};

export async function fetchEmployeesPaged({
  page,
  pageSize,
  search,
  deptId,
  sortField = "user_id",
  sortOrder = "asc",
}: EmployeeListParams): Promise<{ rows: Employee[]; total: number }> {
  const params: Record<string, string | number> = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sort: sortOrder === "desc" ? `-${sortField}` : sortField,
    meta: "filter_count",
  };

  const query = new URLSearchParams(params as any).toString();
  const json = await apiFetch(`/items/user?${query}`);
  const data: Employee[] = (json.data || []).filter(emp => !emp.is_deleted || emp.is_deleted.data?.[0] === 0);
  const total: number = json?.meta?.filter_count ?? json?.meta?.total ?? data.length;

  return { rows: data, total };
}

export async function fetchUserById(userId: number) {
  const json = await apiFetch(`/items/user/${userId}`);
  return json.data;
}

export async function fetchWageByUser(userId: number): Promise<WageRecord | null> {
  const json = await apiFetch(`/items/user_wage_management?filter[user_id][_eq]=${userId}`);
  return (json.data && json.data[0]) || null;
}

export async function createWage(payload: WagePayload) {
  return apiFetch("/items/user_wage_management", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/items/user_wage_management", payload }),
  });
}

export async function patchWage(id: number, payload: WagePayload) {
  return apiFetch(`/items/user_wage_management/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/items/user_wage_management/${id}`, payload }),
  });
}

export async function logWageAccess(openedById: number, userId: number, remarks: string) {
  try {
    return apiFetch("/items/user_wage_access_log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/items/user_wage_access_log", payload: { user_id: userId, opened_by: openedById, remarks } }),
    });
  } catch (e) {
    console.error("logWageAccess failed - wageApi.ts:90", e);
  }
}
