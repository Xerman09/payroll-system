import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

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

function json(payload: unknown, companyName: string, init?: ResponseInit) {
  const data = payload && typeof payload === "object" && "data" in payload ? (payload as Record<string, unknown>).data : payload;
  const existingMeta = payload && typeof payload === "object" && "meta" in payload ? (payload as Record<string, unknown>).meta as Record<string, unknown> : {};
  
  const body = {
    data: data ?? null,
    meta: {
      ...existingMeta,
      companyName,
    },
  };

  return NextResponse.json(body, init);
}

export async function GET(req: NextRequest) {
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
      return { ok: false as const, status: res.status, url, body: body ?? text };
    }
    return { ok: true as const, status: res.status, url, body };
  }

  try {
    // 1. Fetch payroll_run_employee where on_hold is true (1 or true)
    const empParams = new URLSearchParams();
    empParams.set("limit", "-1");
    // Some databases might store as boolean, some as 1/0. Directus usually handles both if we use logical operators or we might just fetch all and filter, but it's better to filter. Let's try filtering on_hold=1 or on_hold=true. To be safe, we will fetch those with on_hold=1 or true.
    // In Directus format: filter[on_hold][_eq]=1
    empParams.set("filter[on_hold][_eq]", "1");
    
    let empRes = await directusFetch(`/items/payroll_run_employee?${empParams.toString()}`);
    
    // If it fails or returns nothing, let's try true
    if (!empRes.ok || pickArray(empRes.body).length === 0) {
        empParams.set("filter[on_hold][_eq]", "true");
        const altRes = await directusFetch(`/items/payroll_run_employee?${empParams.toString()}`);
        if (altRes.ok && pickArray(altRes.body).length > 0) {
            empRes = altRes;
        }
    }

    if (!empRes.ok) return json({ error: "External API error", ...empRes }, config.name, { status: empRes.status });
    
    const onHoldEmployees = pickArray(empRes.body);

    // 2. Fetch payroll_runs to check status and get cutoff dates
    const prParams = new URLSearchParams();
    prParams.set("limit", "-1");
    // We want all payroll runs or just the ones that are not PROCESSED
    prParams.set("filter[status][_neq]", "PROCESSED");
    const prRes = await directusFetch(`/items/payroll_run?${prParams.toString()}`);
    
    const payrollRuns = prRes.ok ? pickArray(prRes.body) : [];
    
    // Fallback: If id is named differently, let's just map whatever identifier we have
    const runMap = new Map<number, any>();
    payrollRuns.forEach(r => {
        const id = r.id || r.payroll_run_id; // Check both standard id and custom
        if (id) runMap.set(Number(id), r);
    });

    // Map the data and filter out employees whose payroll run is PROCESSED or doesn't exist in our map
    const mappedData = onHoldEmployees
      .map((emp) => {
        const runId = Number(emp.payroll_run_id);
        const run = runMap.get(runId);
        
        if (!run) return null; // If run is processed or not found, skip

        return {
          id: emp.id,
          payroll_run_id: runId,
          user_id: emp.user_id,
          employee_name: emp.employee_name || "Unknown Employee",
          department_name: emp.department_name || "Unknown Dept",
          gross_pay: emp.gross_pay || 0,
          net_pay: emp.net_pay || 0,
          cutoff_start: run.cutoff_start,
          cutoff_end: run.cutoff_end,
          run_status: run.status,
          cutoff_period: `${run.cutoff_start || ''} to ${run.cutoff_end || ''}`
        };
      })
      .filter(Boolean); // Remove nulls

    return json({ data: mappedData }, config.name);

  } catch (error) {
    console.error("On-Hold Payroll Reports API error:", error);
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
