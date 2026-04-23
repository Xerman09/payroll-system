import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";
import { COMPANIES, CompanyConfig } from "@/lib/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function pickArray(payload: unknown): Record<string, unknown>[] {
  if (payload && typeof payload === "object" && "data" in payload) {
    const d = (payload as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as Record<string, unknown>[];
  }
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  return [];
}

/** Handles 1/0, true/false, "1"/"0", and Directus buffer-ish { data: [1] } */
function isTruthyFlag(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  if (typeof v === "object") {
    const anyV = v as Record<string, unknown>;
    const dataObj = anyV?.data;
    const d0 = Array.isArray(dataObj) ? dataObj[0] : undefined;
    if (d0 === 1 || d0 === "1" || d0 === true) return true;
    if (d0 === 0 || d0 === "0" || d0 === false || d0 == null) return false;
  }

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v.trim() === "1" || v.trim().toLowerCase() === "true";

  return false;
}

function json(payload: unknown, companyName: string, init?: ResponseInit) {
  
  // Create a structured response with data and meta
  const data = payload && typeof payload === "object" && "data" in payload ? (payload as Record<string, unknown>).data : payload;
  const existingMeta = payload && typeof payload === "object" && "meta" in payload ? (payload as Record<string, unknown>).meta as Record<string, unknown> : {};
  
  const body = {
    data: data ?? null,
    meta: {
      ...existingMeta,
      companyName,
    },
  };

  const res = NextResponse.json(body, init);
  res.headers.set("X-Payroll-Records-Route", "top-sheet-onhold-filter-boolean-v4-meta-fix");
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const config = await resolveApiConfig();
  if (!config) {
    return json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      "Selection Required",
      { status: 400 }
    );
  }
  const API_BASE = config.apiBase;

  async function directusFetch(path: string) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: buildForwardHeaders(req, config),
    });

    const text = await res.text();
    let body: unknown = null;
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
      if (!r.ok) return json({ error: "External API error", ...r }, config.name, { status: r.status });
      return json(r.body, config.name);
    }

    if (type === "departments") {
      const qp = new URLSearchParams();
      qp.set("limit", "-1");
      qp.set("sort", "department_name");
      qp.set("fields", ["department_id", "department_name"].join(","));

      const r = await directusFetch(`/items/department?${qp.toString()}`);
      if (!r.ok) return json({ error: "External API error", ...r }, config.name, { status: r.status });
      return json(r.body, config.name);
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
      if (!r.ok) return json({ error: "External API error", ...r }, config.name, { status: r.status });
      return json(r.body, config.name);
    }

    // ✅ Top Sheet (exclude on_hold)
    if (type === "top-sheet") {
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
          "basic_pay",
          "ot_amount",
          "holiday_pay",
          "rest_day_amount",
          "night_diff_amount",
          "total_additions",
          "total_deductions",
          "net_pay",
          "total_days_worked",
          "total_work_minutes",
          "created_at",
          "on_hold",          // ✅ Required for on-hold filtering
          "is_card",          // ✅ Required for Payment Type
          "breakdown_json",   // ✅ Required for all payslip itemizations

          // ✅ Detailed breakdown fields (Required for buildPayslipsPdf fallback)
          "monthly_rate",
          "daily_rate",
          "hourly_rate",
          "late_minutes",
          "undertime_minutes",
          "overtime_minutes",
          "night_diff_minutes",
          "late_deduction",
          "undertime_deduction",
          "shortage_deduction",
          "dr_deduction",
          "other_deductions",
          "loan_vale",
          "loan_car",
          "loan_coop",
          "coop_loan",
          "coop_savings",
          "benefit_sss",
          "benefit_philhealth",
          "benefit_pagibig",
          "benefit_loan_total",
          "allowance",
          "manual_additions",
          "retro_pay",
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
      if (!r.ok) return json({ error: "External API error", ...r }, config.name, { status: r.status });

      // ✅ HARD FILTER (extra safety)
      const body = r.body ?? {};
      const rows = pickArray(body).filter((row: unknown) => {
        const rObj = row as Record<string, unknown>;
        return !isTruthyFlag(rObj?.on_hold);
      });

      return json({ ...(body as object), data: rows, meta: { companyName: config.name } }, config.name);
    }

    // ✅ Company-wide Payroll Summary (Dynamic Multi-DB Aggregator)
    if (type === "summary") {
      const cutoffStart = searchParams.get("cutoff_start");
      const cutoffEnd = searchParams.get("cutoff_end");

      if (!cutoffStart || !cutoffEnd) {
        return json({ error: "cutoff_start and cutoff_end are required" }, config.name, { status: 400 });
      }

      // 1. Gather APIs from Centralized Registry (lib/companies.ts)
      const APIS = COMPANIES.map(c => ({
        name: c.name,
        url: c.apiBase,
        token: c.token, // Include token
        isPrimary: c.id === config.id,
        isMain: c.id === config.id
      })).filter(a => !!a.url);

      async function fetchFromApi(baseUrl: string, path: string, token?: string) {
        const url = `${baseUrl}${path}`;
        const res = await fetch(url, { 
          headers: buildForwardHeaders(null, { token } as CompanyConfig), 
          cache: "no-store" 
        });
        if (!res.ok) return null;
        return res.json().then((p) => pickArray(p));
      }

      // 2. Find the PREVIOUS cutoff from the PRIMARY source
      const primaryApi = APIS.find(a => a.isPrimary) || APIS[0];
      const sourceUrl = primaryApi.url!;
      const histPath = `/items/cutoff_settings_history?sort=-event_at` +
        `&filter[start_date][_lt]=${cutoffStart}` +
        `&limit=1`;
      const prevHist = await fetchFromApi(sourceUrl, histPath, primaryApi.token);
      const prevCutoff = prevHist?.[0];

      // 3. Fetch all data concurrently
      console.log(`[Summary] Fetching data for cutoff: ${cutoffStart} to ${cutoffEnd}`);
      console.log(`[Summary] Previous cutoff detected from ${primaryApi.name}: ${prevCutoff ? `${prevCutoff.start_date} to ${prevCutoff.end_date}` : "None"}`);

      const results = await Promise.all(
        APIS.map(async (api) => {
          const baseUrl = api.url!;
          console.log(`[Summary] Processing API: ${api.name} (${baseUrl})`);

          try {
            const runPath = `/items/payroll_run?filter[cutoff_start][_eq]=${cutoffStart}&filter[cutoff_end][_eq]=${cutoffEnd}&filter[status][_eq]=POSTED`;
            const currEmpPath = `/items/payroll_run_employee?limit=-1&filter[cutoff_start][_eq]=${cutoffStart}&filter[cutoff_end][_eq]=${cutoffEnd}&filter[on_hold][_neq]=true`;

            let prevRunPath = null;
            let prevEmpPath = null;
            if (prevCutoff) {
              prevRunPath = `/items/payroll_run?filter[cutoff_start][_eq]=${prevCutoff.start_date}&filter[cutoff_end][_eq]=${prevCutoff.end_date}&filter[status][_eq]=POSTED`;
              prevEmpPath = `/items/payroll_run_employee?limit=-1&filter[cutoff_start][_eq]=${prevCutoff.start_date}&filter[cutoff_end][_eq]=${prevCutoff.end_date}&filter[on_hold][_neq]=true`;
            }

            // Parallelize WITHIN the company too
            const [currentRunArr, prevRunArr, currEmpsArr, prevEmpsArr] = await Promise.all([
              fetchFromApi(baseUrl, runPath, api.token),
              prevRunPath ? fetchFromApi(baseUrl, prevRunPath, api.token) : Promise.resolve([]),
              fetchFromApi(baseUrl, currEmpPath, api.token),
              prevEmpPath ? fetchFromApi(baseUrl, prevEmpPath, api.token) : Promise.resolve([]),
            ]);

            const currentRun = currentRunArr?.[0];
            const prevRun = prevRunArr?.[0];
            const currEmps = currEmpsArr || [];
            const prevEmps = prevEmpsArr || [];

            console.log(`[Summary] ${api.name}: CurrentRun=${currentRun ? "Y" : "N"}, PrevRun=${prevRun ? "Y" : "N"}, CurrEmps=${currEmps.length}, PrevEmps=${prevEmps.length}`);

            return {
              companyName: api.name,
              isMain: api.isMain,
              currentRun,
              prevRun,
              currEmps,
              prevEmps,
            };
          } catch (e) {
            console.error(`[Summary] Error fetching from ${api.name}:`, e);
            return {
              companyName: api.name,
              isMain: api.isMain,
              currentRun: null,
              prevRun: null,
              currEmps: [],
              prevEmps: [],
              error: e instanceof Error ? e.message : String(e),
            };
          }
        }),
      );

      return json({
        data: results,
        meta: {
          currentCutoff: { start: cutoffStart, end: cutoffEnd },
          prevCutoff: prevCutoff ? { start: prevCutoff.start_date, end: prevCutoff.end_date } : null,
          companyName: config.name,
        },
      }, config.name);
    }

    return json({ error: "Invalid type parameter." }, config.name, { status: 400 });
  } catch (error) {
    console.error("Payroll Records proxy error:", error);
    return json(
      {
        error: "Failed to fetch external data",
        details: error instanceof Error ? error.message : String(error)
      },
      config.name || "Default Entity",
      { status: 500 }
    );
  }
}
