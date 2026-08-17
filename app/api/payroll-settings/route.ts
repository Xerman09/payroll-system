import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";
import type { CompanyConfig } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

function buildUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function directusFetch(req: NextRequest, method: "GET" | "POST" | "PATCH", path: string, config: CompanyConfig, body?: unknown) {
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
    return NextResponse.json({ error: "No enterprise entity selected." }, { status: 400 });
  }

  // Assuming table `payroll_settings` exists. We expect 1 row.
  const result = await directusFetch(req, "GET", "/items/payroll_settings", config);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}

export async function POST(req: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json({ error: "No enterprise entity selected." }, { status: 400 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Determine if we need to POST or PATCH
  // First, check if settings exist
  const existing = await directusFetch(req, "GET", "/items/payroll_settings", config);
  const items = existing.data?.data || [];

  if (items.length > 0) {
    // Update existing
    const id = items[0].id;
    const result = await directusFetch(req, "PATCH", `/items/payroll_settings/${id}`, config, payload);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data);
  } else {
    // Create new
    const result = await directusFetch(req, "POST", "/items/payroll_settings", config, payload);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.data);
  }
}
