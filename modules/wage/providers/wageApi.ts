// @modules/wage/providers/wageApi.ts
import type { Department, Employee, WageRecord, WagePayload } from "../types";

const BASE = "http://100.126.246.124:8060";

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

export async function fetchDepartments(): Promise<Department[]> {
  const json = await fetchJson(`${BASE}/items/department?limit=-1`);
  return json.data || [];
}

export async function fetchEmployees(): Promise<Employee[]> {
  const json = await fetchJson(`${BASE}/items/user?limit=-1`);
  const list: Employee[] = (json.data || []).filter(
    (emp: Employee) => !emp.is_deleted || emp.is_deleted.data?.[0] === 0
  );
  return list;
}

export async function fetchUserById(userId: number) {
  const json = await fetchJson(`${BASE}/items/user/${userId}`);
  return json.data;
}

export async function fetchWageByUser(userId: number): Promise<WageRecord | null> {
  const json = await fetchJson(
    `${BASE}/items/user_wage_management?filter[user_id][_eq]=${userId}`
  );
  return (json.data && json.data[0]) || null;
}

export async function createWage(payload: WagePayload) {
  const res = await fetch(`${BASE}/items/user_wage_management`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function patchWage(id: number, payload: WagePayload) {
  const res = await fetch(`${BASE}/items/user_wage_management/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function logWageAccess(openedById: number, userId: number, remarks: string) {
  try {
    await fetch(`${BASE}/items/user_wage_access_log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, opened_by: openedById, remarks }),
    });
  } catch (e) {
    // swallow, caller can log if needed
    console.error("logWageAccess failed - WageAPI.ts:66", e);
  }
}
