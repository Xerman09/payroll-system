// src/lib/directus/client.ts

type ApiList<T> = { data: T[] };
type ApiSingle<T> = { data: T };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const message =
      (json as any)?.errors?.[0]?.message ||
      (json as any)?.error ||
      (json as any)?.message ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return json as T;
}

export function listItems<T>(collection: string, search?: string) {
  const qs = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return apiFetch<ApiList<T>>(`/api/directus/items/${encodeURIComponent(collection)}${qs}`);
}

export function getItem<T>(collection: string, id: string | number, search?: string) {
  const qs = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return apiFetch<ApiSingle<T>>(
    `/api/directus/items/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}${qs}`
  );
}

export function createItem<T>(collection: string, payload: unknown) {
  return apiFetch<ApiSingle<T>>(`/api/directus/items/${encodeURIComponent(collection)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateItem<T>(collection: string, id: string | number, payload: unknown) {
  return apiFetch<ApiSingle<T>>(`/api/directus/items/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteItem(collection: string, id: string | number) {
  return apiFetch(`/api/directus/items/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}
