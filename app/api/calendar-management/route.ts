import { NextRequest, NextResponse } from "next/server";

type ResourceKey = "users" | "holiday_calendar" | "cutoff_settings";

/**
 * Calendar Management API Proxy (Directus)
 *
 * Base:
 * - API_BASE (preferred)
 * - NEXT_PUBLIC_API_BASE (fallback)
 *
 * Optional auth:
 * - CALENDAR_API_TOKEN
 * - DIRECTUS_TOKEN
 * - DIRECTUS_STATIC_TOKEN
 */
const BASE_URL =
  (process.env.API_BASE && process.env.API_BASE.trim()) ||
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  undefined;

const TOKEN =
  (process.env.CALENDAR_API_TOKEN && process.env.CALENDAR_API_TOKEN.trim()) ||
  (process.env.DIRECTUS_TOKEN && process.env.DIRECTUS_TOKEN.trim()) ||
  (process.env.DIRECTUS_STATIC_TOKEN && process.env.DIRECTUS_STATIC_TOKEN.trim()) ||
  undefined;

const COLLECTIONS: Record<ResourceKey, string> = {
  users: "users",
  holiday_calendar: "holiday_calendar",
  cutoff_settings: "cutoff_settings",
};

function assertConfig() {
  if (!BASE_URL) {
    throw new Error("Missing API base URL. Set API_BASE or NEXT_PUBLIC_API_BASE.");
  }
}

function buildUpstreamUrl(resource: ResourceKey, id?: string, searchParams?: URLSearchParams) {
  assertConfig();

  const base = BASE_URL!.replace(/\/+$/, "");
  const collection = COLLECTIONS[resource];
  const path = `/items/${collection}${id ? `/${encodeURIComponent(id)}` : ""}`;
  const url = new URL(base + path);

  // Directus list defaults
  if (!id) {
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

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

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

function normalizeResource(raw: string): string {
  return (raw || "").trim().toLowerCase();
}

function getResource(req: NextRequest): ResourceKey {
  const raw = normalizeResource(req.nextUrl.searchParams.get("resource") || "");

  if (!raw) {
    throw new Error("Invalid or missing resource. Provide ?resource=holiday_calendar|cutoff_settings|users");
  }

  // users
  if (raw === "users") return "users";

  // cutoffs
  if (raw === "cutoff_settings" || raw === "cutoff-settings") return "cutoff_settings";

  // holidays (accept both new and old naming)
  if (
    raw === "holiday_calendar" ||
    raw === "holiday-calendar" ||
    raw === "holidays"
  ) {
    return "holiday_calendar";
  }

  throw new Error(`Invalid or missing resource: "${raw}"`);
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
    const raw = normalizeResource(String(body?.resource || ""));

    const resource: ResourceKey =
      raw === "users"
        ? "users"
        : raw === "cutoff_settings" || raw === "cutoff-settings"
          ? "cutoff_settings"
          : raw === "holiday_calendar" || raw === "holiday-calendar" || raw === "holidays"
            ? "holiday_calendar"
            : (() => {
              throw new Error(`Invalid resource: "${raw}"`);
            })();

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
    const raw = normalizeResource(String(body?.resource || ""));

    const resource: ResourceKey =
      raw === "users"
        ? "users"
        : raw === "cutoff_settings" || raw === "cutoff-settings"
          ? "cutoff_settings"
          : raw === "holiday_calendar" || raw === "holiday-calendar" || raw === "holidays"
            ? "holiday_calendar"
            : (() => {
              throw new Error(`Invalid resource: "${raw}"`);
            })();

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
