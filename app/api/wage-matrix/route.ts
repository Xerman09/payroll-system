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

async function directusFetch(req: NextRequest | null, method: HttpMethod, path: string, config: CompanyConfig, body?: unknown) {
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

export async function GET(req: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }


  const [areas, staff, vehicleTypes, matrix] = await Promise.all([
    directusFetch(req, "GET", "/items/payroll_logistics_area?limit=-1&filter[is_deleted][_eq]=0", config),
    directusFetch(req, "GET", "/items/payroll_logistics_staff?limit=-1", config),
    directusFetch(req, "GET", "/items/vehicle_type?limit=-1", config),
    directusFetch(req, "GET", "/items/payroll_logistics_salary_matrix?limit=-1", config)
  ]);

  if (!areas.ok) return NextResponse.json({ error: areas.error }, { status: areas.status });

  return NextResponse.json({
    areas: areas.data?.data || [],
    staff: staff.ok ? (staff.data?.data || []) : [],
    vehicleTypes: vehicleTypes.ok ? (vehicleTypes.data?.data || []) : [],
    matrix: matrix.ok ? (matrix.data?.data || []) : []
  }, { headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }

  const payload = await req.json().catch(() => null);

  // ... (lines 90-99 unchanged) ...
  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: "Payload must be an array of records" }, { status: 400 });
  }

  const result = await directusFetch(req, "POST", "/items/payroll_logistics_salary_matrix", config, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function PATCH(req: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }

  const payload = await req.json().catch(() => null);

  if (Array.isArray(payload)) {
    // Bulk patch
    const result = await directusFetch(req, "PATCH", "/items/payroll_logistics_salary_matrix", config, payload);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data, { headers: corsHeaders() });
  }

  const id = payload?.id;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  const result = await directusFetch(req, "PATCH", `/items/payroll_logistics_salary_matrix/${id}`, config, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function DELETE(req: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  const result = await directusFetch(req, "DELETE", `/items/payroll_logistics_salary_matrix/${id}`, config);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ message: "Deleted" }, { headers: corsHeaders() });
}
