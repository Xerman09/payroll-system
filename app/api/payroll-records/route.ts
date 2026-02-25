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
  res.headers.set("X-Payroll-Records-Route", "top-sheet-onhold-filter-boolean-v4");
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
      const companyName = process.env.API_BASE_NAME || "COMPANY NAME";

      return json({ ...body, data: rows, meta: { companyName } });
    }

    // ✅ Company-wide Payroll Summary (Dynamic Multi-DB Aggregator)
    if (type === "summary") {
      const cutoffStart = searchParams.get("cutoff_start");
      const cutoffEnd = searchParams.get("cutoff_end");

      if (!cutoffStart || !cutoffEnd) {
        return json({ error: "cutoff_start and cutoff_end are required" }, { status: 400 });
      }

      // 1. Gather APIs from Environment Variables (Registry)
      const APIS: any[] = [];

      // Map prefixes to their names
      const prefixes = ["BASE", "I", "II", "III", "IV", "V"];
      for (const p of prefixes) {
        const urlKey = p === "BASE" ? "API_BASE" : `API_${p}`;
        const nameKey = `${urlKey}_NAME`;

        const url = process.env[urlKey];
        const name = process.env[nameKey];

        if (url) {
          APIS.push({
            name: name || (p === "BASE" ? "Primary Company" : `Company ${p}`),
            url: url,
            isPrimary: p === "BASE",
            isMain: p === "BASE"
          });
        }
      }

      // Check for Database Registry as a secondary fallback if no Env found
      if (APIS.length === 0) {
        const registryPath = `/items/company_registry?filter[status][_eq]=published&limit=-1`;
        const registryData = await directusFetch(registryPath);
        if (registryData.ok) {
          const dbRows = pickArray(registryData.body).map((item: any) => ({
            name: item.name,
            url: item.api_url,
            isPrimary: isTruthyFlag(item.is_primary),
            isMain: isTruthyFlag(item.is_main)
          }));
          APIS.push(...dbRows);
        }
      }

      async function fetchFromApi(baseUrl: string, path: string) {
        const url = `${baseUrl}${path}`;
        const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
        if (!res.ok) return null;
        return res.json().then((p) => pickArray(p));
      }

      // 2. Find the PREVIOUS cutoff from the PRIMARY source
      const primaryApi = APIS.find(a => a.isPrimary) || APIS[0];
      const sourceUrl = primaryApi.url!;
      const histPath = `/items/cutoff_settings_history?sort=-event_at` +
        `&filter[start_date][_lt]=${cutoffStart}` +
        `&limit=1`;
      const prevHist = await fetchFromApi(sourceUrl, histPath);
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
              fetchFromApi(baseUrl, runPath),
              prevRunPath ? fetchFromApi(baseUrl, prevRunPath) : Promise.resolve([]),
              fetchFromApi(baseUrl, currEmpPath),
              prevEmpPath ? fetchFromApi(baseUrl, prevEmpPath) : Promise.resolve([]),
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
        },
      });
    }

    return json({ error: "Invalid type parameter." }, { status: 400 });
  } catch (error) {
    console.error("Payroll Records proxy error:", error);
    return json(
      {
        error: "Failed to fetch external data",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
