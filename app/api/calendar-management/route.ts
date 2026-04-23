import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders, CompanyConfig } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

type ResourceKey = "users" | "holidays";

function getResource(req: NextRequest): ResourceKey {
  const resource = (req.nextUrl.searchParams.get("resource") || "").toLowerCase();
  if (resource === "users" || resource === "holidays") return resource as ResourceKey;
  throw new Error("Invalid or missing resource");
}

interface CalendarConfig {
  baseUrl: string;
  config: CompanyConfig; // Updated
  style: string;
  collections: Record<ResourceKey, string>;
}

async function resolveCalendarConfig() {
  const config = await resolveApiConfig();
  if (!config) return null;

  return {
    baseUrl: config.apiBase,
    config, // Keep the whole config for helper usage
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
  
  const collectionPath = collection === "user" ? "/users" : `/items/${collection}`;
  const path = `${collectionPath}${id ? `/${encodeURIComponent(id)}` : ""}`;
  const url = new URL(base + path);

  if (!searchParams?.has("limit")) url.searchParams.set("limit", "-1");
  if (!searchParams?.has("fields")) url.searchParams.set("fields", "*");

  searchParams?.forEach((v, k) => url.searchParams.set(k, v));
  return url;
}

async function upstreamFetch(config: CalendarConfig, req: NextRequest, url: URL, init?: RequestInit) {
  const res = await fetch(url.toString(), { 
    ...init, 
    headers: buildForwardHeaders(req, config.config, { 
      contentType: init?.body ? "application/json" : undefined 
    }),
    cache: "no-store" 
  });
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
    return upstreamFetch(config, req, url, { method: "GET" });
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
    return upstreamFetch(config, req, url, { method: "POST", body: JSON.stringify(data) });
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
    return upstreamFetch(config, req, url, { method: "PATCH", body: JSON.stringify(data) });
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
    return upstreamFetch(config, req, url, { method: "DELETE" });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}
