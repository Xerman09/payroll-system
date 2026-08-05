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
    // 1. Fetch payroll run employees for department breakdown
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("sort", "-cutoff_end"); // Newest first
    params.set("filter[payroll_run_id][status][_eq]", "POSTED");
    params.set("fields", "payroll_run_id.payroll_ref_no,cutoff_start,cutoff_end,department_name,gross_pay,net_pay");
    
    const res = await directusFetch(`/items/payroll_run_employee?${params.toString()}`);
    if (!res.ok) return json({ error: "External API error", ...res }, config.name, { status: res.status });
    
    const runsRaw = pickArray(res.body);
    
    // Aggregate by cutoff and department
    const aggregated: Record<string, any> = {};
    
    runsRaw.forEach((row: any) => {
      const cutoff = row.cutoff_end;
      const dept = row.department_name || "Unassigned";
      const key = `${cutoff}_${dept}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          payroll_ref_no: row.payroll_run_id?.payroll_ref_no || "-",
          cutoff_start: row.cutoff_start,
          cutoff_end: row.cutoff_end,
          department_name: dept,
          total_gross: 0,
          total_net: 0,
          status: "POSTED"
        };
      }
      
      aggregated[key].total_gross += Number(row.gross_pay || 0);
      aggregated[key].total_net += Number(row.net_pay || 0);
    });
    
    const runs = Object.values(aggregated);
    // Sort by cutoff_end descending, then by department name
    runs.sort((a, b) => {
      const dateDiff = new Date(b.cutoff_end).getTime() - new Date(a.cutoff_end).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.department_name.localeCompare(b.department_name);
    });

    return json({ data: runs, ai_insights: null }, config.name);

  } catch (error) {
    console.error("Payroll Report API error:", error);
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
