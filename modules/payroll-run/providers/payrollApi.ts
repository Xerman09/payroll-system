// modules/payroll-run/providers/payrollApi.ts
type DirectusList<T> = { data: T[] };
type DirectusSingle<T> = { data: T };

const BASE = "/api/payroll-run";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = json?.error || json?.details || "Request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return json as T;
}

function qs(params: Record<string, any>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

export async function listItems<T>(resource: string, params: Record<string, any>): Promise<T[]> {
  const query = qs({ resource, ...params });
  const json = await apiFetch<DirectusList<T>>(`${BASE}?${query}`, { method: "GET" });
  return (json?.data ?? []) as T[];
}

export async function getItem<T>(resource: string, id: number, params: Record<string, any>): Promise<T> {
  const query = qs({ resource, id, ...params });
  const json = await apiFetch<DirectusSingle<T>>(`${BASE}?${query}`, { method: "GET" });
  return json.data as T;
}

export async function createItem<T>(resource: string, payload: any): Promise<T> {
  const query = qs({ resource });
  const json = await apiFetch<DirectusSingle<T>>(`${BASE}?${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  return json.data as T;
}

export async function patchItem<T>(resource: string, id: number, payload: any): Promise<T> {
  const query = qs({ resource, id });
  const json = await apiFetch<DirectusSingle<T>>(`${BASE}?${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  return json.data as T;
}

export async function deleteItem(resource: string, id: number): Promise<void> {
  const query = qs({ resource, id });
  await apiFetch(`${BASE}?${query}`, { method: "DELETE" });
}
