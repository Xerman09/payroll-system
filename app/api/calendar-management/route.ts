import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig } from "@/lib/api-helper";

type ResourceKey = "users" | "holidays";

function getResource(req: NextRequest): ResourceKey {
  const resource = (req.nextUrl.searchParams.get("resource") || "").toLowerCase();
  if (resource === "users" || resource === "holidays") return resource as ResourceKey;
  throw new Error("Invalid or missing resource");
}

interface CalendarConfig {
  baseUrl: string;
  token: string | undefined;
  style: string;
  collections: Record<ResourceKey, string>;
}

async function resolveCalendarConfig() {
  const config = await resolveApiConfig();
  if (!config) return null;

  const TOKEN = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_STATIC_TOKEN;

  return {
    baseUrl: config.apiBase,
    token: TOKEN,
    style: "directus",
    collections: {
      users: "user",
      holidays: "holiday_calendar",
    }
  };
}

function buildUpstreamUrl(config: CalendarConfig, resource: ResourceKey, id?: string, searchParams?: URLSearchParams) {
  if (!config.baseUrl) throw new Error("Missing upstream base URL.");
  const collection = config.collections[resource];
  const base = config.baseUrl.replace(/\/+$/, "");
  
  const path = `/items/${collection}${id ? `/${encodeURIComponent(id)}` : ""}`;
  const url = new URL(base + path);

  if (!searchParams?.has("limit")) url.searchParams.set("limit", "-1");
  if (!searchParams?.has("fields")) url.searchParams.set("fields", "*");

  searchParams?.forEach((v, k) => url.searchParams.set(k, v));
  return url;
}

async function upstreamFetch(config: CalendarConfig, url: URL, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (config.token) headers.set("Authorization", `Bearer ${config.token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(url.toString(), { ...init, headers, cache: "no-store" });
  const text = await res.text();

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const j = json as Record<string, unknown> | null;
    const errorMsg =
      (j && (j.error as { message?: string })?.message || j?.error || j?.message) ||
      text ||
      `Upstream request failed (${res.status})`;
    return NextResponse.json({ error: errorMsg }, { status: res.status });
  }

  const normalized = json && typeof json === "object" && "data" in (json as object) ? json : { data: json };
  return NextResponse.json(normalized, { status: 200 });
}

export async function GET(req: NextRequest) {
  try {
    const config = await resolveCalendarConfig();
    if (!config) {
      return NextResponse.json({ error: "No enterprise entity selected. Please visit the portal." }, { status: 400 });
    }

    const resource = getResource(req);
    const id = req.nextUrl.searchParams.get("id") || undefined;

    const params = new URLSearchParams(req.nextUrl.searchParams);
    params.delete("resource");

    const url = buildUpstreamUrl(config, resource, id, params);
    return upstreamFetch(config, url, { method: "GET" });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await resolveCalendarConfig();
    if (!config) {
      return NextResponse.json({ error: "No enterprise entity selected. Please visit the portal." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const resource = (String(body?.resource || "") as string).toLowerCase() as ResourceKey;
    if (!["users", "holidays"].includes(resource)) throw new Error("Invalid resource");
    const data = body?.data;
    if (!data || typeof data !== "object") throw new Error("Missing data");

    const url = buildUpstreamUrl(config, resource);
    return upstreamFetch(config, url, { method: "POST", body: JSON.stringify(data) });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const config = await resolveCalendarConfig();
    if (!config) {
      return NextResponse.json({ error: "No enterprise entity selected. Please visit the portal." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const resource = (String(body?.resource || "") as string).toLowerCase() as ResourceKey;
    if (!["users", "holidays"].includes(resource)) throw new Error("Invalid resource");
    const id = body?.id;
    if (!id) throw new Error("Missing id");
    const data = body?.data;
    if (!data || typeof data !== "object") throw new Error("Missing data");

    const url = buildUpstreamUrl(config, resource, String(id));
    return upstreamFetch(config, url, { method: "PATCH", body: JSON.stringify(data) });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const config = await resolveCalendarConfig();
    if (!config) {
      return NextResponse.json({ error: "No enterprise entity selected. Please visit the portal." }, { status: 400 });
    }

    const resource = getResource(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new Error("Missing id");

    const params = new URLSearchParams(req.nextUrl.searchParams);
    params.delete("resource");
    params.delete("id");

    const url = buildUpstreamUrl(config, resource, id, params);
    return upstreamFetch(config, url, { method: "DELETE" });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}
