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

// Helper to map resource to table name and metadata
function getResourceInfo(resource: string | null) {
  switch (resource) {
    case "area": return { table: "payroll_logistics_area", softDelete: true };
    case "location": return { table: "payroll_logistics_location", softDelete: true };
    case "staff": return { table: "payroll_logistics_staff", softDelete: true };
    case "vehicle_type": return { table: "vehicle_type", softDelete: false };
    default: return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const info = getResourceInfo(resource);

  if (!info) return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
  const { table, softDelete } = info;

  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }

  // Forward any Directus query params (filter, fields, limit, etc.)
  const directusParams = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key !== "resource") directusParams.set(key, value);
  });

  // Default filter for soft deletion if supported and not overridden
  if (softDelete && !directusParams.has("filter[is_deleted][_eq]")) {
    directusParams.set("filter[is_deleted][_eq]", "0");
  }

  const queryString = directusParams.toString();
  const path = `/items/${table}${queryString ? `?${queryString}` : ""}`;

  const result = await directusFetch(req, "GET", path, config);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const info = getResourceInfo(resource);

  if (!info) return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
  const { table } = info;

  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }

  const payload = await req.json().catch(() => null);

  // Special handling for soft-deleted resources with unique constraints
  if (info.softDelete) {
    let lookupFilter = "";
    if (resource === "staff" && payload.staff_id) {
      lookupFilter = `filter[staff_id][_eq]=${payload.staff_id}`;
    } else if (resource === "area" && payload.area_name) {
      lookupFilter = `filter[area_name][_eq]=${encodeURIComponent(payload.area_name)}`;
    }

    if (lookupFilter) {
      // Check if record exists (including deleted ones)
      const existing = await directusFetch(req, "GET", `/items/${table}?${lookupFilter}`, config);
      const items = existing.data?.data || [];
      
      if (items.length > 0) {
        const id = items[0].id;
        // Reactivate and update
        const updatePayload = { ...payload, is_deleted: 0 };
        const result = await directusFetch(req, "PATCH", `/items/${table}/${id}`, config, updatePayload);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json(result.data, { headers: corsHeaders() });
      }
    }
  }

  const result = await directusFetch(req, "POST", `/items/${table}`, config, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const info = getResourceInfo(resource);

  if (!info) return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
  const { table } = info;

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
  const info = getResourceInfo(resource);
  const id = url.searchParams.get("id");

  if (!info || !id) return NextResponse.json({ error: "Invalid resource or missing ID" }, { status: 400 });
  const { table, softDelete } = info;

  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }

  const result = softDelete 
    ? await directusFetch(req, "PATCH", `/items/${table}/${id}`, config, { is_deleted: 1 })
    : await directusFetch(req, "DELETE", `/items/${table}/${id}`, config);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ message: softDelete ? "Archived" : "Deleted" }, { headers: corsHeaders() });
}
