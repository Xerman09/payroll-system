// app/api/wage-matrix/route.ts
import { NextRequest, NextResponse } from "next/server";

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

const API_BASE =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "";

const DIRECTUS_TOKEN =
  process.env.DIRECTUS_TOKEN ||
  process.env.DIRECTUS_STATIC_TOKEN ||
  process.env.NEXT_PUBLIC_DIRECTUS_TOKEN ||
  "";

function buildUrl(path: string) {
  const base = String(API_BASE || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function directusFetch(method: HttpMethod, path: string, body?: unknown) {
  const url = buildUrl(path);
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

export async function GET() {
  const [areas, staff, vehicleTypes, matrix] = await Promise.all([
    directusFetch("GET", "/items/payroll_logistics_area"),
    directusFetch("GET", "/items/payroll_logistics_staff"),
    directusFetch("GET", "/items/vehicle_type"),
    directusFetch("GET", "/items/payroll_logistics_salary_matrix")
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
  const payload = await req.json().catch(() => null);

  // payload should be an array of items for bulk upsert
  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: "Payload must be an array of records" }, { status: 400 });
  }

  // Directus supports bulk create/update if we use the /items/collection endpoint with an array
  // However, we need to handle upsert logic. 
  // If the record has an ID, it's an update. If not, it's a create.
  // For simplicity in this specific project context, we'll use the "create many" approach 
  // or handle individual updates if needed.

  const result = await directusFetch("POST", "/items/payroll_logistics_salary_matrix", payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function PATCH(req: NextRequest) {
  const payload = await req.json().catch(() => null);

  if (Array.isArray(payload)) {
    // Bulk patch
    const result = await directusFetch("PATCH", "/items/payroll_logistics_salary_matrix", payload);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data, { headers: corsHeaders() });
  }

  const id = payload?.id;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  const result = await directusFetch("PATCH", `/items/payroll_logistics_salary_matrix/${id}`, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { headers: corsHeaders() });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  const result = await directusFetch("DELETE", `/items/payroll_logistics_salary_matrix/${id}`);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ message: "Deleted" }, { headers: corsHeaders() });
}
