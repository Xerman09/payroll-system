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
    // 1. Fetch overtime_requests
    const otParams = new URLSearchParams();
    otParams.set("limit", "-1");
    otParams.set("sort", "-filed_at");
    
    const otRes = await directusFetch(`/items/overtime_request?${otParams.toString()}`);
    if (!otRes.ok) return json({ error: "External API error", ...otRes }, config.name, { status: otRes.status });
    
    const overtimeRequests = pickArray(otRes.body);

    // 2. Fetch users
    const userParams = new URLSearchParams();
    userParams.set("limit", "-1");
    userParams.set("fields", "user_id,user_fname,user_lname,user_department");
    const uRes = await directusFetch(`/items/user?${userParams.toString()}`);
    const users = uRes.ok ? pickArray(uRes.body) : [];
    const userMap = new Map<number, any>();
    users.forEach(u => userMap.set(Number(u.user_id), u));

    // 3. Fetch departments
    const deptParams = new URLSearchParams();
    deptParams.set("limit", "-1");
    deptParams.set("fields", "department_id,department_name");
    const dRes = await directusFetch(`/items/department?${deptParams.toString()}`);
    const depts = dRes.ok ? pickArray(dRes.body) : [];
    const deptMap = new Map<number, any>();
    depts.forEach(d => deptMap.set(Number(d.department_id), d));

    // Map the data
    const mappedData = overtimeRequests.map((ot) => {
      const u = userMap.get(Number(ot.user_id));
      const deptId = Number(ot.department_id || u?.user_department);
      const d = deptMap.get(deptId);
      
      return {
        ...ot,
        employee_name: u ? `${u.user_fname} ${u.user_lname}`.trim() : "Unknown Employee",
        department_name: d ? d.department_name : "Unknown Dept",
      };
    });

    return json({ data: mappedData }, config.name);

  } catch (error) {
    console.error("Overtime Reports API error:", error);
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
