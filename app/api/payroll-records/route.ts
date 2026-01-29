// app/dashboard/api/payroll-records/route.ts
import { NextRequest, NextResponse } from "next/server";

function authHeaders(req: NextRequest) {
  // ✅ use .env.local DIRECTUS_TOKEN (long-lived Directus token)
  const staticToken =
    process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_STATIC_TOKEN;

  const cookieToken = req.cookies.get("vos_access_token")?.value;

  // Prefer static token ALWAYS (cookie is NOT a Directus token in your setup)
  const token = staticToken || cookieToken;

  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  // Use your .env.local values (API_BASE is server-safe).
  const API_BASE =
    process.env.API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL;

  if (!API_BASE) {
    return NextResponse.json({ error: "API_BASE is not defined" }, { status: 500 });
  }

  let endpoint = "";
  const qp = new URLSearchParams();

  switch (type) {
    case "employees": {
      endpoint = "/items/user";
      qp.set("limit", "-1");
      qp.set(
        "fields",
        [
          "user_id",
          "user_fname",
          "user_mname",
          "user_lname",
          "user_department",
          "user_position",
          "user_dateOfHire",
          "user_contact",
          "is_deleted",
        ].join(","),
      );
      break;
    }

    case "departments": {
      endpoint = "/items/department";
      qp.set("limit", "-1");
      qp.set("sort", "department_name");
      qp.set("fields", ["department_id", "department_name"].join(","));
      break;
    }

    case "cutoffs": {
      endpoint = "/items/cutoff_settings_history";
      qp.set("limit", "-1");
      qp.set("sort", "-event_at");
      qp.set(
        "fields",
        [
          "id",
          "cutoff_setting_id",
          "event_at",
          "status",
          "month",
          "year",
          "cutoff_type",
          "start_date",
          "end_date",
          "payout_date",
          "period_status",
        ].join(","),
      );
      break;
    }

    case "tap-sheet": {
      endpoint = "/items/payroll_run_employee";
      qp.set("limit", "-1");
      qp.set(
        "fields",
        [
          "id",
          "payroll_run_id",
          "user_id",
          "employee_name",
          "department_name",
          "department_name_snapshot",
          "cutoff_start",
          "cutoff_end",
          "cutoff_label",
          "gross_pay",
          "total_additions",
          "total_deductions",
          "net_pay",
          "created_at",
        ].join(","),
      );

      const cutoffStart = searchParams.get("cutoff_start");
      const cutoffEnd = searchParams.get("cutoff_end");
      const deptName = searchParams.get("department_name");

      if (cutoffStart) qp.set("filter[cutoff_start][_eq]", cutoffStart);
      if (cutoffEnd) qp.set("filter[cutoff_end][_eq]", cutoffEnd);

      if (deptName) {
        qp.set("filter[_or][0][department_name_snapshot][_eq]", deptName);
        qp.set("filter[_or][1][department_name][_eq]", deptName);
      }
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid type parameter." }, { status: 400 });
  }

  try {
    const url = `${API_BASE}${endpoint}${qp.toString() ? `?${qp}` : ""}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: authHeaders(req),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "External API error", status: res.status, url, body: json ?? text },
        { status: res.status },
      );
    }

    return NextResponse.json(json);
  } catch (error) {
    console.error("Payroll Records proxy error: - route.ts:156", error);
    return NextResponse.json({ error: "Failed to fetch external data" }, { status: 500 });
  }
}
