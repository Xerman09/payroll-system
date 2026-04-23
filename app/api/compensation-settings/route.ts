import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";
import type { CompanyConfig } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

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


function buildUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function directusFetch(req: NextRequest, method: HttpMethod, path: string, config: CompanyConfig, body?: unknown) {
  const url = buildUrl(config.apiBase, path);

  const res = await fetch(url, {
    method,
    headers: buildForwardHeaders(req, config, { 
      contentType: method !== "GET" ? "application/json" : undefined,
      useGlobalToken: true
    }),
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

  const result = await directusFetch(req, "GET", `/items/${table}`, config);
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

  const payload = await req.json().catch(() => null);
  const result = await directusFetch(req, "POST", `/items/${table}`, config, payload);
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
  const result = await directusFetch(req, "PATCH", `/items/${table}/${id}`, config, payload);
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

  const result = await directusFetch(req, "DELETE", `/items/${table}/${id}`, config);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ message: "Deleted" }, { headers: corsHeaders() });
}
