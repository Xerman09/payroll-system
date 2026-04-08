export const INTERNAL_API = "/api/coop";

export type CoopCollection =
  | "employee_loan"
  | "user"
  | "employee_loan_payment"
  | "coop_savings_membership"
  | "cutoff_settings";

type JsonValue = unknown;

async function readErrorText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "Request failed.";
  }
}

async function fetchJson<T = JsonValue>(
  url: string,
  init?: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(url, { ...init, signal });
  if (!res.ok) {
    const msg = await readErrorText(res);
    const err = new Error(msg);
    // @ts-expect-error attach status for callers that want it
    err.status = res.status;
    throw err;
  }
  // DELETE may return 204; calling code should avoid parsing
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

function buildUrl(collection: CoopCollection, params?: Record<string, string>) {
  const sp = new URLSearchParams();
  sp.set("collection", collection);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && String(v).length > 0) sp.set(k, v);
    }
  }
  return `${INTERNAL_API}?${sp.toString()}`;
}

export async function listItems<T>(
  collection: CoopCollection,
  params?: Record<string, string>,
  signal?: AbortSignal
): Promise<{ data: T[]; meta?: Record<string, unknown> }> {
  const url = buildUrl(collection, params);
  const json = await fetchJson<Record<string, unknown>>(url, undefined, signal);
  return {
    data: Array.isArray(json?.data) ? (json.data as T[]) : [],
    meta: json?.meta as Record<string, unknown>,
  };
}

export async function createItem<T>(
  collection: CoopCollection,
  body: unknown
): Promise<T> {
  const url = buildUrl(collection);
  const json = await fetchJson<Record<string, unknown>>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    undefined
  );
  return (json?.data ?? json) as T;
}

export async function updateItem<T>(
  collection: CoopCollection,
  id: number,
  body: unknown
): Promise<T> {
  const url = buildUrl(collection, { id: String(id) });
  const json = await fetchJson<Record<string, unknown>>(
    url,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    undefined
  );
  return (json?.data ?? json) as T;
}

export async function deleteItem(
  collection: CoopCollection,
  id: number
): Promise<void> {
  const url = buildUrl(collection, { id: String(id) });
  await fetchJson<Record<string, unknown>>(
    url,
    {
      method: "DELETE",
    },
    undefined
  );
}
