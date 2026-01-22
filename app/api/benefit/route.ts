// app/api/payroll-run/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RAW_DIRECTUS_URL =
  process.env.DIRECTUS_URL ||
  process.env.API_BASE ||
  "http://100.110.197.61:8056";

const DIRECTUS_BASE = RAW_DIRECTUS_URL.replace(/\/+$/, "");

const SERVICE_TOKEN =
  process.env.DIRECTUS_TOKEN ||
  process.env.DIRECTUS_SERVICE_TOKEN ||
  process.env.DIRECTUS_ACCESS_TOKEN ||
  "";

const ALLOWED_RESOURCES = new Set<string>([
  // payroll run
  "payroll_run",
  "payroll_run_employee",

  // masters
  "cutoff_settings",
  "department",
  "user",
  "user_wage_management",

  // attendance/calendar
  "attendance_approval",
  "holiday_calendar",

  // manual entries
  "payroll_other_additions",
  "payroll_other_deductions",

  // benefits
  "benefit_cutoff_settings",
  "benefit_loans",

  // loans
  "employee_loan",
]);

function buildForwardHeaders(req: NextRequest, contentType?: string) {
  const h: Record<string, string> = {};

  const auth = req.headers.get("authorization");
  if (auth) h["Authorization"] = auth;
  else if (SERVICE_TOKEN) h["Authorization"] = `Bearer ${SERVICE_TOKEN}`;

  if (contentType) h["Content-Type"] = contentType;

  return h;
}

async function readBodyIfAny(req: NextRequest) {
  const text = await req.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function joinUrl(base: string, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function buildDirectusItemsUrl(args: {
  resource: string;
  id?: string | null;
  passthroughSearch: URLSearchParams;
}) {
  const { resource, id, passthroughSearch } = args;

  // Directus items endpoint
  const path = id ? `/items/${resource}/${id}` : `/items/${resource}`;
  const u = new URL(joinUrl(DIRECTUS_BASE, path));

  // pass through all other query params (filters, sort, limit, etc.)
  passthroughSearch.forEach((value, key) => {
    u.searchParams.set(key, value);
  });

  return u.toString();
}

async function forward(req: NextRequest) {
  const url = new URL(req.url);

  const resource = url.searchParams.get("resource") || "";
  const id = url.searchParams.get("id");

  if (!resource) {
    return NextResponse.json({ error: "Missing ?resource=" }, { status: 400 });
  }

  // ✅ allowlist guard (THIS is the usual cause of 403 in your case)
  if (!ALLOWED_RESOURCES.has(resource)) {
    return NextResponse.json(
      {
        error: "Invalid or missing resource",
        resource,
        allowed: Array.from(ALLOWED_RESOURCES),
      },
      { status: 403 }
    );
  }

  // Pass through all query params EXCEPT resource/id (those are our router params)
  const passthrough = new URLSearchParams(url.searchParams);
  passthrough.delete("resource");
  passthrough.delete("id");

  const targetUrl = buildDirectusItemsUrl({
    resource,
    id,
    passthroughSearch: passthrough,
  });

  const method = req.method.toUpperCase();

  // Client sends { payload } sometimes; support payload/data/body
  const bodyJson = await readBodyIfAny(req);
  const payload = bodyJson?.payload ?? bodyJson?.data ?? bodyJson ?? null;

  const init: RequestInit = {
    method,
    headers: buildForwardHeaders(req, payload ? "application/json" : undefined),
    body:
      payload && (method === "POST" || method === "PATCH" || method === "PUT")
        ? JSON.stringify(payload)
        : undefined,
    cache: "no-store",
  };

  const upstream = await fetch(targetUrl, init);

  // Directus DELETE often returns 204
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  const text = await upstream.text().catch(() => "");

  if (!upstream.ok) {
    // ✅ If this triggers for employee_loan, the response will show if it's Directus permission
    return NextResponse.json(
      {
        error: "Upstream error",
        status: upstream.status,
        resource,
        id: id ?? null,
        targetUrl,
        details: text || null,
      },
      { status: upstream.status }
    );
  }

  if (!text) return NextResponse.json({ ok: true });

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({ ok: true, raw: text });
  }
}

export async function GET(req: NextRequest) {
  return forward(req);
}
export async function POST(req: NextRequest) {
  return forward(req);
}
export async function PATCH(req: NextRequest) {
  return forward(req);
}
export async function DELETE(req: NextRequest) {
  return forward(req);
}
