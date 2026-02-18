import type { PayrollRecord, User } from "../types";

const INTERNAL_API = "/api/additions-deductions";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    // attempt json error first
    try {
      const parsed = JSON.parse(text) as { error?: string };
      throw new Error(parsed?.error || text || res.statusText);
    } catch {
      throw new Error(text || res.statusText);
    }
  }

  if (!text) return {} as T;

  const json = JSON.parse(text) as unknown;
  // Directus commonly returns { data: [...] }
  if (typeof json === "object" && json !== null && "data" in (json as Record<string, unknown>)) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export async function getUsers(): Promise<User[]> {
  return fetchJson<User[]>(`${INTERNAL_API}?resource=users`);
}

export async function getAdditions(): Promise<PayrollRecord[]> {
  return fetchJson<PayrollRecord[]>(`${INTERNAL_API}?resource=additions`);
}

export async function getDeductions(): Promise<PayrollRecord[]> {
  return fetchJson<PayrollRecord[]>(`${INTERNAL_API}?resource=deductions`);
}

export async function createRecord(resource: "additions" | "deductions", data: object) {
  const res = await fetch(INTERNAL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource, data }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || "Create failed");
  return text ? JSON.parse(text) : {};
}

export async function updateRecord(
  resource: "additions" | "deductions",
  id: number,
  data: object
) {
  const res = await fetch(INTERNAL_API, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource, id, data }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || "Update failed");
  return text ? JSON.parse(text) : {};
}

export async function deleteRecord(resource: "additions" | "deductions", id: number) {
  const res = await fetch(`${INTERNAL_API}?resource=${resource}&id=${id}`, {
    method: "DELETE",
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || "Delete failed");
  return text ? JSON.parse(text) : { success: true };
}