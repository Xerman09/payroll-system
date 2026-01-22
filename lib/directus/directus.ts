// src/lib/directus/directus.ts

export function getDirectusBase(): string {
  const base = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "";
  if (!base) throw new Error("Missing API_BASE (or NEXT_PUBLIC_API_BASE).");
  return base.replace(/\/+$/, "");
}

export function getDirectusToken(): string | null {
  const token = process.env.DIRECTUS_TOKEN?.trim();
  return token ? token : null;
}

/**
 * Builds a Directus /items URL:
 * - base: http://host:8056
 * - collection: department
 * - id optional: 1
 * - query: ?limit=...
 */
export function buildItemsUrl(params: {
  base: string;
  collection: string;
  id?: string;
  search?: string;
}): string {
  const { base, collection, id, search } = params;

  // Keep it simple and strict: only allow safe path segments
  if (!/^[a-zA-Z0-9_]+$/.test(collection)) {
    throw new Error(`Invalid collection name: ${collection}`);
  }
  if (id && !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid id: ${id}`);
  }

  const path = id
    ? `/items/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`
    : `/items/${encodeURIComponent(collection)}`;

  const qs = search && search.startsWith("?") ? search : (search ? `?${search}` : "");
  return `${base}${path}${qs}`;
}

export function makeAuthHeaders(token: string | null, extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  if (token) h.set("Authorization", `Bearer ${token}`);
  return h;
}
