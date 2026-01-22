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

// ✅ MUST include everything your payrollRunService fetches
const ALLOWED_RESOURCES = new Set<string>([
  "payroll_run",
  "payroll_run_employee",
  "cutoff_settings",
  "department",
  "user",
  "user_wage_management",
  "attendance_approval",
  "holiday_calendar",
  "payroll_other_additions",
  "payroll_other_deductions",
  "benefit_cutoff_settings",
  "employee_loan",
  "benefit_loans",
]);

function debugId() {
  return `dbg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function joinUrl(base: string, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function buildForwardHeaders(req: NextRequest, contentType?: string) {
  const h: Record<string, string> = {};
  const auth = req.headers.get("authorization");

  // ✅ Prefer service token if available (recommended for payroll module)
  if (SERVICE_TOKEN) h["Authorization"] = `Bearer ${SERVICE_TOKEN}`;
  else if (auth) h["Authorization"] = auth;

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

function buildItemsUrl(args: {
  resource: string;
  id?: string | null;
  passthroughSearch: URLSearchParams;
}) {
  const { resource, id, passthroughSearch } = args;

  const path = id ? `/items/${resource}/${id}` : `/items/${resource}`;
  const u = new URL(joinUrl(DIRECTUS_BASE, path));

  passthroughSearch.forEach((value, key) => {
    u.searchParams.set(key, value);
  });

  return u.toString();
}

function truncate(s: string, max = 800) {
  if (!s) return s;
  return s.length > max ? `${s.slice(0, max)}…(truncated)` : s;
}

async function forward(req: NextRequest) {
  const dbg = debugId();

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") || "";
  const id = url.searchParams.get("id");

  console.log(`[payrollrun][${dbg}] IN - route.ts:97`, {
    method: req.method,
    url: req.url,
    resource,
    id,
    directusBase: DIRECTUS_BASE,
    hasServiceToken: Boolean(SERVICE_TOKEN),
    hasClientAuth: Boolean(req.headers.get("authorization")),
  });

  if (!resource) {
    console.warn(`[payrollrun][${dbg}] BLOCK missing resource - route.ts:108`);
    return NextResponse.json(
      { error: "Missing ?resource=", debug_id: dbg },
      { status: 400, headers: { "x-debug-id": dbg } }
    );
  }

  if (!ALLOWED_RESOURCES.has(resource)) {
    console.warn(`[payrollrun][${dbg}] BLOCK allowlist - route.ts:116`, { resource });
    return NextResponse.json(
      {
        error: "Invalid or forbidden resource",
        block: "ALLOWLIST",
        resource,
        allowed: Array.from(ALLOWED_RESOURCES),
        debug_id: dbg,
      },
      { status: 403, headers: { "x-debug-id": dbg } }
    );
  }

  const passthrough = new URLSearchParams(url.searchParams);
  passthrough.delete("resource");
  passthrough.delete("id");

  const targetUrl = buildItemsUrl({ resource, id, passthroughSearch: passthrough });

  const method = req.method.toUpperCase();
  const bodyJson = await readBodyIfAny(req);
  const payload = bodyJson?.payload ?? bodyJson?.data ?? bodyJson ?? null;

  console.log(`[payrollrun][${dbg}] UPSTREAM - route.ts:139`, {
    method,
    targetUrl,
    hasPayload: Boolean(payload),
  });

  const init: RequestInit = {
    method,
    headers: buildForwardHeaders(req, payload ? "application/json" : undefined),
    body:
      payload && (method === "POST" || method === "PATCH" || method === "PUT")
        ? JSON.stringify(payload)
        : undefined,
    cache: "no-store",
  };

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (e: any) {
    console.error(`[payrollrun][${dbg}] FETCH ERROR - route.ts:159`, {
      message: e?.message ?? String(e),
      targetUrl,
    });
    return NextResponse.json(
      {
        error: "Fetch to Directus failed",
        block: "NETWORK",
        targetUrl,
        details: e?.message ?? String(e),
        debug_id: dbg,
      },
      { status: 502, headers: { "x-debug-id": dbg } }
    );
  }

  if (upstream.status === 204) {
    console.log(`[payrollrun][${dbg}] UPSTREAM OK 204 - route.ts:176`);
    return new NextResponse(null, { status: 204, headers: { "x-debug-id": dbg } });
  }

  const text = await upstream.text().catch(() => "");

  console.log(`[payrollrun][${dbg}] UPSTREAM RESP - route.ts:182`, {
    status: upstream.status,
    ok: upstream.ok,
  });

  if (!upstream.ok) {
    console.warn(`[payrollrun][${dbg}] UPSTREAM ERROR BODY - route.ts:188`, truncate(text, 800));
    return NextResponse.json(
      {
        error: "Upstream error",
        block: "DIRECTUS",
        status: upstream.status,
        resource,
        id: id ?? null,
        targetUrl,
        details: truncate(text, 3000),
        debug_id: dbg,
      },
      { status: upstream.status, headers: { "x-debug-id": dbg } }
    );
  }

  if (!text) {
    return NextResponse.json({ ok: true }, { headers: { "x-debug-id": dbg } });
  }

  try {
    return NextResponse.json(JSON.parse(text), { headers: { "x-debug-id": dbg } });
  } catch {
    return NextResponse.json({ ok: true, raw: text }, { headers: { "x-debug-id": dbg } });
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
