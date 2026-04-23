import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

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



function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

async function proxy(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  const resource = (url.searchParams.get("resource") ?? "") as ResourceKey;
  const idRaw = url.searchParams.get("id");

  if (!resource || !(resource in ALLOWED)) {
    return jsonError(400, "Invalid or missing resource", { resource });
  }

  const config = await resolveApiConfig();
  if (!config) {
    return jsonError(400, "No enterprise entity selected. Please visit the portal to choose one.");
  }
  const directus = (config.apiBase ?? "").replace(/\/+$/, "");
  const companyName = config.name;

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

  const endpointPath = `/items/${resource}`;
  
  // Inject explicit fields for user table to prevent 500 Server Errors due to broken columns
  if (resource === "user" && !sp.has("fields")) {
    sp.set("fields", "user_id,user_fname,user_mname,user_lname,user_department,is_deleted,user_position");
  }
  const endpoint =
    idRaw && String(idRaw).trim() !== ""
      ? `${directus}${endpointPath}/${encodeURIComponent(String(idRaw))}`
      : `${directus}${endpointPath}`;

  const finalUrl = sp.toString() ? `${endpoint}?${sp.toString()}` : endpoint;

  let body: unknown = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const raw = await req.json().catch(() => null);
    body = raw?.payload ?? raw ?? null;
  }

  const res = await fetch(finalUrl, {
    method: req.method,
    headers: buildForwardHeaders(req, config, { contentType: body != null ? "application/json" : undefined }),
    ...(body != null ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  // ✅ IMPORTANT: Directus DELETE commonly returns 204 No Content
  if (res.status === 204 || res.status === 205) {
    return new NextResponse(null, { status: res.status });
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // If Directus returns empty body on other statuses, still respond safely

  // If data is an object, inject companyName into metadata
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    return NextResponse.json(
      {
        ...obj,
        meta: {
          ...((obj.meta as Record<string, unknown>) || {}),
          companyName,
        },
      },
      { status: res.status },
    );
  }

  // Fallback for arrays or other types
  return NextResponse.json(
    {
      data: data ?? null,
      meta: { companyName },
    },
    { status: res.status },
  );
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
