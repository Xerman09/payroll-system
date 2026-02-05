import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authHeaders() {
  const token = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_STATIC_TOKEN;

  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function pickArray(payload: any) {
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

/** Handles 1/0, true/false, "1"/"0", and Directus buffer-ish { data: [1] } */
function isTruthyFlag(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  if (typeof v === "object") {
    const anyV = v as any;
    const d0 = anyV?.data?.[0];
    if (d0 === 1 || d0 === "1" || d0 === true) return true;
    if (d0 === 0 || d0 === "0" || d0 === false || d0 == null) return false;
  }

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v.trim() === "1" || v.trim().toLowerCase() === "true";

  return false;
}

function json(data: any, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("X-Payroll-Records-Route", "tap-sheet-onhold-filter-boolean-v4");
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const API_BASE =
    process.env.API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL;

  if (!API_BASE) {
    return json({ error: "API_BASE is not defined" }, { status: 500 });
  }

  async function directusFetch(path: string) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: authHeaders(),
    });

    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!res.ok) {
      return {
        ok: false as const,
        status: res.status,
        url,
        body: body ?? text,
      };
    }

    return { ok: true as const, status: res.status, url, body };
  }

  try {
    if (type === "employees") {
      const qp = new URLSearchParams();
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

      const r = await directusFetch(`/items/user?${qp.toString()}`);
      if (!r.ok) return json({ error: "External API error", ...r }, { status: r.status });
      return json(r.body);
    }

    if (type === "departments") {
      const qp = new URLSearchParams();
      qp.set("limit", "-1");
      qp.set("sort", "department_name");
      qp.set("fields", ["department_id", "department_name"].join(","));

      const r = await directusFetch(`/items/department?${qp.toString()}`);
      if (!r.ok) return json({ error: "External API error", ...r }, { status: r.status });
      return json(r.body);
    }

    if (type === "cutoffs") {
      const qp = new URLSearchParams();
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

      const r = await directusFetch(`/items/cutoff_settings_history?${qp.toString()}`);
      if (!r.ok) return json({ error: "External API error", ...r }, { status: r.status });
      return json(r.body);
    }

    // ✅ Top Sheet (exclude on_hold)
    if (type === "tap-sheet") {
      const qp = new URLSearchParams();
      qp.set("limit", "-1");
      qp.set("sort", "-payroll_run_id,-id");

      qp.set(
        "fields",
        [
          "id",
          "payroll_run_id.payroll_ref_no",
          "payroll_run_id.posted_at",
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
          "on_hold", // ✅ MUST BE INCLUDED
          "is_card", // ✅ MUST BE INCLUDED for Payment Type
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

      // ✅ BOOLEAN-SAFE: exclude rows where on_hold === true
      qp.set("filter[on_hold][_neq]", "true");

      const r = await directusFetch(`/items/payroll_run_employee?${qp.toString()}`);
      if (!r.ok) return json({ error: "External API error", ...r }, { status: r.status });

      // ✅ HARD FILTER (extra safety)
      const body = r.body ?? {};
      const rows = pickArray(body).filter((row: any) => !isTruthyFlag(row?.on_hold));

      return json({ ...body, data: rows });
    }

    // ✅ Company-wide Payroll Summary (Multi-DB Aggregator)
    if (type === "summary") {
      const cutoffStart = searchParams.get("cutoff_start");
      const cutoffEnd = searchParams.get("cutoff_end");

      if (!cutoffStart || !cutoffEnd) {
        return json({ error: "cutoff_start and cutoff_end are required" }, { status: 400 });
      }

      const APIS = [
        { name: "Dummy", url: process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE }, // 8056
        { name: "Vertex", url: process.env.API_I }, // 8090
        { name: "Men2", url: process.env.API_II }, // 8091
        { name: "Hanvin", url: process.env.API_III }, // 8092
      ].filter((x) => !!x.url);

      async function fetchFromApi(baseUrl: string, path: string) {
        const url = `${baseUrl}${path}`;
        const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
        if (!res.ok) return null;
        return res.json().then((p) => pickArray(p));
      }

      // 1. Find the PREVIOUS cutoff from the source (8056)
      const sourceUrl = APIS[0].url!;
      const histPath = `/items/cutoff_settings_history?sort=-event_at` +
        `&filter[start_date][_lt]=${cutoffStart}` +
        `&limit=1`;
      const prevHist = await fetchFromApi(sourceUrl, histPath);
      const prevCutoff = prevHist?.[0];

      // 2. Fetch all data concurrently
      const results = await Promise.all(
        APIS.map(async (api) => {
          const baseUrl = api.url!;

          // Runs
          const runPath = `/items/payroll_run?filter[cutoff_start][_eq]=${cutoffStart}&filter[cutoff_end][_eq]=${cutoffEnd}&filter[status][_eq]=POSTED`;
          const currentRunArr = await fetchFromApi(baseUrl, runPath);
          const currentRun = currentRunArr?.[0];

          let prevRun = null;
          if (prevCutoff) {
            const prevRunPath = `/items/payroll_run?filter[cutoff_start][_eq]=${prevCutoff.start_date}&filter[cutoff_end][_eq]=${prevCutoff.end_date}&filter[status][_eq]=POSTED`;
            const prevRunArr = await fetchFromApi(baseUrl, prevRunPath);
            prevRun = prevRunArr?.[0];
          }

          // Employees (Current)
          const currEmpPath = `/items/payroll_run_employee?limit=-1&filter[cutoff_start][_eq]=${cutoffStart}&filter[cutoff_end][_eq]=${cutoffEnd}&filter[on_hold][_neq]=true`;
          const currEmps = (await fetchFromApi(baseUrl, currEmpPath)) || [];

          // Employees (Previous)
          let prevEmps: any[] = [];
          if (prevCutoff) {
            const prevEmpPath = `/items/payroll_run_employee?limit=-1&filter[cutoff_start][_eq]=${prevCutoff.start_date}&filter[cutoff_end][_eq]=${prevCutoff.end_date}&filter[on_hold][_neq]=true`;
            prevEmps = (await fetchFromApi(baseUrl, prevEmpPath)) || [];
          }

          return {
            companyName: api.name,
            currentRun,
            prevRun,
            currEmps,
            prevEmps,
          };
        }),
      );

      return json({
        data: results,
        meta: {
          currentCutoff: { start: cutoffStart, end: cutoffEnd },
          prevCutoff: prevCutoff ? { start: prevCutoff.start_date, end: prevCutoff.end_date } : null,
        },
      });
    }

    return json({ error: "Invalid type parameter." }, { status: 400 });
  } catch (error) {
    console.error("Payroll Records proxy error: - route.ts:199", error);
    return json({ error: "Failed to fetch external data" }, { status: 500 });
  }
}
