// app/api/compensation-settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig } from "@/lib/api-helper";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}


const DIRECTUS_TOKEN =
  process.env.DIRECTUS_TOKEN ||
  process.env.DIRECTUS_STATIC_TOKEN ||
  process.env.NEXT_PUBLIC_DIRECTUS_TOKEN ||
  "";

function buildUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function directusFetch(method: HttpMethod, path: string, base: string, body?: unknown) {
  const url = buildUrl(base, path);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (method !== "GET") headers["Content-Type"] = "application/json";
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { }

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      error: json?.errors?.[0]?.message || `Request failed (${res.status})`,
      raw: json ?? text,
    };
  }
  return { ok: true as const, status: res.status, data: json };
}

// Helper to map resource to table name
function getTableName(resource: string | null) {
  switch (resource) {
    case "area": return "payroll_logistics_area";
    case "location": return "payroll_logistics_location";
    case "staff": return "payroll_logistics_staff";
    case "vehicle_type": return "vehicle_type";
    default: return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const table = getTableName(resource);

  if (!table) return NextResponse.json({ error: "Invalid resource" }, { status: 400 });

  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }
  const base = config.apiBase;
  const result = await directusFetch("GET", `/items/${table}`, base);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const table = getTableName(resource);

  if (!table) return NextResponse.json({ error: "Invalid resource" }, { status: 400 });

  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }
  const base = config.apiBase;
  const payload = await req.json().catch(() => null);
  const result = await directusFetch("POST", `/items/${table}`, base, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const table = getTableName(resource);

  if (!table) return NextResponse.json({ error: "Invalid resource" }, { status: 400 });

  const payload = await req.json().catch(() => null);
  const id = payload?.id;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }
  const base = config.apiBase;
  const result = await directusFetch("PATCH", `/items/${table}/${id}`, base, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const table = getTableName(resource);
  const id = url.searchParams.get("id");

  if (!table || !id) return NextResponse.json({ error: "Invalid resource or missing ID" }, { status: 400 });

  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }
  const base = config.apiBase;
  const result = await directusFetch("DELETE" as HttpMethod, `/items/${table}/${id}`, base);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ message: "Deleted" }, { headers: corsHeaders() });
}
