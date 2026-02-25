// app/api/payroll-run/route.ts
import { NextRequest, NextResponse } from "next/server";

type ResourceKey =
  | "payroll_run"
  | "payroll_run_employee"
  | "cutoff_settings"
  | "department"
  | "user"
  | "user_wage_management"
  | "attendance_approval"
  | "holiday_calendar"
  | "payroll_other_additions"
  | "payroll_other_deductions"
  | "benefit_cutoff_settings"
  | "employee_loan"
  | "benefit_loans"
  | "employee_allowance"
  | "dr_payment"
  // ✅ NEW
  | "user_wage_proration_log"
  | "payroll_run_employee_item"
  | "retro_pay"
  | "coop_savings_membership"
  | "payroll_run_access_log"
  | "benefit_logs"
  ;

const ALLOWED: Record<ResourceKey, true> = {
  payroll_run: true,
  payroll_run_employee: true,
  cutoff_settings: true,
  department: true,
  user: true,
  user_wage_management: true,
  attendance_approval: true,
  holiday_calendar: true,
  payroll_other_additions: true,
  payroll_other_deductions: true,
  benefit_cutoff_settings: true,
  employee_loan: true,
  benefit_loans: true,
  employee_allowance: true,
  dr_payment: true,
  // ✅ NEW
  user_wage_proration_log: true,
  payroll_run_employee_item: true,
  retro_pay: true,
  coop_savings_membership: true,
  payroll_run_access_log: true,
  benefit_logs: true,
};

function baseUrl() {
  const b = process.env.API_BASE ?? process.env.NEXT_PUBLIC_API_BASE;
  if (!b) return "";
  return String(b).replace(/\/+$/, "");
}

function pickAuth(req: NextRequest) {
  const incoming = req.headers.get("authorization");
  if (incoming) return incoming;

  const staticToken =
    process.env.DIRECTUS_TOKEN ??
    process.env.DIRECTUS_STATIC_TOKEN ??
    process.env.API_TOKEN ??
    null;

  return staticToken ? `Bearer ${staticToken}` : null;
}

function jsonError(status: number, error: string, details?: any) {
  return NextResponse.json({ error, details }, { status });
}

async function proxy(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  const resource = (url.searchParams.get("resource") ?? "") as ResourceKey;
  const idRaw = url.searchParams.get("id");

  if (!resource || !(resource in ALLOWED)) {
    return jsonError(400, "Invalid or missing resource", { resource });
  }

  const directus = baseUrl();
  if (!directus) {
    return jsonError(500, "Missing API_BASE / NEXT_PUBLIC_API_BASE env");
  }

  const sp = new URLSearchParams(url.searchParams);
  sp.delete("resource");
  sp.delete("id");

  // ✅ Optional safety clamp (prevents accidental 20k+ queries from breaking anything)
  // If you don't want this behavior, you can remove this block.
  const limitRaw = sp.get("limit");
  if (limitRaw != null) {
    const lim = Number(limitRaw);
    if (Number.isFinite(lim) && lim > 0) {
      sp.set("limit", String(Math.min(lim, 5000)));
    }
  }

  const endpoint =
    idRaw && String(idRaw).trim() !== ""
      ? `${directus}/items/${resource}/${encodeURIComponent(String(idRaw))}`
      : `${directus}/items/${resource}`;

  const finalUrl = sp.toString() ? `${endpoint}?${sp.toString()}` : endpoint;

  const auth = pickAuth(req);

  let body: any = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const raw = await req.json().catch(() => null);
    body = raw?.payload ?? raw ?? null;
  }

  const res = await fetch(finalUrl, {
    method: req.method,
    headers: {
      ...(body != null ? { "Content-Type": "application/json" } : {}),
      ...(auth ? { Authorization: auth } : {}),
    },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  // ✅ IMPORTANT: Directus DELETE commonly returns 204 No Content
  if (res.status === 204 || res.status === 205) {
    return new NextResponse(null, { status: res.status });
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // If Directus returns empty body on other statuses, still respond safely
  return NextResponse.json(data ?? null, { status: res.status });
}

export async function GET(req: NextRequest) {
  return proxy(req);
}
export async function POST(req: NextRequest) {
  return proxy(req);
}
export async function PATCH(req: NextRequest) {
  return proxy(req);
}
export async function DELETE(req: NextRequest) {
  return proxy(req);
}
