import { NextRequest, NextResponse } from "next/server";

type ResourceKey = "users" | "holidays";

function getEnv(name: string) {
  const v = process.env[name];
  return v && v.trim().length ? v.trim() : undefined;
}

/**
 * Upstream API proxy for Calendar Management
 *
 * Defaults to Directus-style:
 *   BASE_URL + /items/<collection>
 *
 * Env vars:
 * - CALENDAR_API_BASE_URL (preferred)
 *   or DIRECTUS_URL / NEXT_PUBLIC_DIRECTUS_URL
 * - CALENDAR_API_STYLE = "directus" | "rest" (default: directus)
 * - CALENDAR_API_TOKEN (optional Bearer token)
 *
 * Collection overrides:
 * - CAL_USERS_COLLECTION (default: "users")
 * - CAL_HOLIDAYS_COLLECTION (default: "holidays")
 */
const BASE_URL =
  getEnv("CALENDAR_API_BASE_URL") ||
  getEnv("DIRECTUS_URL") ||
  getEnv("NEXT_PUBLIC_DIRECTUS_URL");

const STYLE = (getEnv("CALENDAR_API_STYLE") || "directus").toLowerCase();
const TOKEN =
  getEnv("CALENDAR_API_TOKEN") ||
  getEnv("DIRECTUS_TOKEN") ||
  getEnv("DIRECTUS_STATIC_TOKEN");

const COLLECTIONS: Record<ResourceKey, string> = {
  users: getEnv("CAL_USERS_COLLECTION") || "users",
  holidays: getEnv("CAL_HOLIDAYS_COLLECTION") || "holidays",
};

function assertConfig() {
  if (!BASE_URL) {
    throw new Error(
      "Missing upstream base URL. Set CALENDAR_API_BASE_URL (recommended) or DIRECTUS_URL / NEXT_PUBLIC_DIRECTUS_URL."
    );
  }
}

function buildUpstreamUrl(resource: ResourceKey, id?: string, searchParams?: URLSearchParams) {
  assertConfig();
  const collection = COLLECTIONS[resource];

  const base = BASE_URL!.replace(/\/+$/, "");
  let path = "";

  if (STYLE === "rest") {
    path = `/${collection}${id ? `/${encodeURIComponent(id)}` : ""}`;
  } else {
    path = `/items/${collection}${id ? `/${encodeURIComponent(id)}` : ""}`;
  }

  const url = new URL(base + path);

  if (STYLE !== "rest") {
    if (!searchParams?.has("limit")) url.searchParams.set("limit", "-1");
    if (!searchParams?.has("fields")) url.searchParams.set("fields", "*");
  }

  searchParams?.forEach((v, k) => url.searchParams.set(k, v));
  return url;
}

async function upstreamFetch(url: URL, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (TOKEN) headers.set("Authorization", `Bearer ${TOKEN}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(url.toString(), { ...init, headers, cache: "no-store" });
  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const errorMsg =
      (json && (json.error?.message || json.error || json.message)) ||
      text ||
      `Upstream request failed (${res.status})`;
    return NextResponse.json({ error: errorMsg }, { status: res.status });
  }

  const normalized = json && typeof json === "object" && "data" in json ? json : { data: json };
  return NextResponse.json(normalized, { status: 200 });
}

function getResource(req: NextRequest): ResourceKey {
  const resource = (req.nextUrl.searchParams.get("resource") || "").toLowerCase();
  if (resource === "users" || resource === "holidays") return resource;
  throw new Error("Invalid or missing resource");
}

export async function GET(req: NextRequest) {
  try {
    const resource = getResource(req);
    const id = req.nextUrl.searchParams.get("id") || undefined;

    const params = new URLSearchParams(req.nextUrl.searchParams);
    params.delete("resource");

    const url = buildUpstreamUrl(resource, id, params);
    return upstreamFetch(url, { method: "GET" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const resource = (String(body?.resource || "") as string).toLowerCase() as ResourceKey;
    if (!["users", "holidays"].includes(resource)) throw new Error("Invalid resource");
    const data = body?.data;
    if (!data || typeof data !== "object") throw new Error("Missing data");

    const url = buildUpstreamUrl(resource);
    return upstreamFetch(url, { method: "POST", body: JSON.stringify(data) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const resource = (String(body?.resource || "") as string).toLowerCase() as ResourceKey;
    if (!["users", "holidays"].includes(resource)) throw new Error("Invalid resource");
    const id = body?.id;
    if (!id) throw new Error("Missing id");
    const data = body?.data;
    if (!data || typeof data !== "object") throw new Error("Missing data");

    const url = buildUpstreamUrl(resource, String(id));
    return upstreamFetch(url, { method: "PATCH", body: JSON.stringify(data) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const resource = getResource(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new Error("Missing id");

    const params = new URLSearchParams(req.nextUrl.searchParams);
    params.delete("resource");
    params.delete("id");

    const url = buildUpstreamUrl(resource, id, params);
    return upstreamFetch(url, { method: "DELETE" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}
