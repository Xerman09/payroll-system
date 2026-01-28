// src/app/api/payroll-dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function pickArray(payload: any): AnyRow[] {
  if (payload && Array.isArray(payload.data)) return payload.data; // Directus { data: [...] }
  if (Array.isArray(payload)) return payload; // raw array fallback
  return [];
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    return { ok: false as const, status: res.status, url, json, text };
  }

  return { ok: true as const, status: res.status, url, json, text };
}

function buildDirectusUrl(base: string, path: string, params?: Record<string, string>) {
  const u = new URL(path, base);
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const deptId = searchParams.get("deptId") || "";

  // ✅ Correct defaults based on your message
  const MASTER_BASE =
    process.env.PAYROLL_MASTER_API_BASE ?? "http://100.110.197.61:8091/";
  const ATT_BASE =
    process.env.PAYROLL_ATTENDANCE_API_BASE ?? "http://100.110.197.61:8056/";

  const auth = req.headers.get("authorization") || "";

  const common = { limit: "-1" };

  const attendanceParams: Record<string, string> = { ...common };
  if (from && to) attendanceParams["filter[date_schedule][_between]"] = `${from},${to}`;
  else if (from) attendanceParams["filter[date_schedule][_gte]"] = from;
  else if (to) attendanceParams["filter[date_schedule][_lte]"] = to;

  const urls = {
    users: buildDirectusUrl(MASTER_BASE, "items/user", common),
    departments: buildDirectusUrl(MASTER_BASE, "items/department", common),
    wages: buildDirectusUrl(MASTER_BASE, "items/userwage_management", common),
    holidays: buildDirectusUrl(MASTER_BASE, "items/holiday_calendar", common),
    attendance: buildDirectusUrl(ATT_BASE, "items/attendance_approval", attendanceParams),
  };

  const headers = auth ? { Authorization: auth } : undefined;

  const [usersR, depsR, wagesR, holR, attR] = await Promise.all([
    fetchJson(urls.users, { headers }),
    fetchJson(urls.departments, { headers }),
    fetchJson(urls.wages, { headers }),
    fetchJson(urls.holidays, { headers }),
    fetchJson(urls.attendance, { headers }),
  ]);

  const errors = [usersR, depsR, wagesR, holR, attR]
    .filter((r) => !r.ok)
    .map((r) => ({ url: r.url, status: r.status, body: r.json ?? r.text }));

  const data = {
    users: usersR.ok ? pickArray(usersR.json) : [],
    departments: depsR.ok ? pickArray(depsR.json) : [],
    wages: wagesR.ok ? pickArray(wagesR.json) : [],
    holidays: holR.ok ? pickArray(holR.json) : [],
    attendance: attR.ok ? pickArray(attR.json) : [],
  };

  return NextResponse.json(
    {
      ok: errors.length === 0,
      generated_at: new Date().toISOString(),
      filters: { from, to, deptId },
      errors,
      data,
    },
    { status: errors.length ? 207 : 200 }
  );
}
