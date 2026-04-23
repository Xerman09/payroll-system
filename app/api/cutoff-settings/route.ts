// app/api/cutoff-settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";
import { COMPANIES } from "@/lib/companies";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}



function normalizeBaseUrl(url: string) {
  return String(url || "").replace(/\/+$/, "");
}

function buildUrl(base: string, path: string) {
  const b = normalizeBaseUrl(base);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function parseIdsParam(idsParam: string | null): string[] {
  if (!idsParam) return [];
  return idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch (uses DIRECTUS_TOKEN if available)
 * Good for collections that require token access.
 */
async function directusFetchAuth(method: HttpMethod, path: string, base: string, body?: unknown, req?: NextRequest) {
  const url = buildUrl(base, path);
  const config = COMPANIES.find(c => c.apiBase === normalizeBaseUrl(base)) || null;

  const headers = buildForwardHeaders(req, config, { contentType: method !== "GET" ? "application/json" : undefined });
  headers["Accept"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  const json = await safeJsonParse(text);

  if (!res.ok) {
    const message =
      json?.errors?.[0]?.message ||
      json?.message ||
      `Directus request failed (${res.status}).`;

    return {
      ok: false as const,
      status: res.status,
      error: message,
      raw: json ?? text,
    };
  }

  return {
    ok: true as const,
    status: res.status,
    data: json,
  };
}

/**
 * No-auth fetch (NO Bearer token)
 * Matches your /api/auth/login behavior for /items/user
 */


function buildCutoffSettingsQuery(month?: string | null, year?: string | null) {
  const qs = new URLSearchParams();
  qs.set("fields", "*");
  qs.set("limit", "200");
  qs.set("sort", "cutoff_type");

  if (month) qs.set("filter[month][_eq]", month);
  if (year) qs.set("filter[year][_eq]", year);

  return qs.toString();
}

/**
 * Logs history to cutoff_settings_history
 */
async function logHistory(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  data: Record<string, unknown>,
  changedBy: string | null
) {
  try {
    const historyData = {
      cutoff_setting_id: data.id,
      event_type: eventType,
      event_at: new Date().toISOString(),
      changed_by: changedBy || data.updated_by || data.created_by,
      status: data.status,
      source_date_created: data.date_created,
      source_date_updated: data.date_updated,
      month: data.month,
      year: data.year,
      cutoff_type: data.cutoff_type,
      start_date: data.start_date,
      end_date: data.end_date,
      payout_date: data.payout_date,
      period_status: data.period_status,
      created_by: data.created_by,
      updated_by: data.updated_by,
      raw_payload: data,
    };

    const config = await resolveApiConfig();
    if (!config) return;
    await directusFetchAuth("POST", "/items/cutoff_settings_history", config.apiBase, historyData);
  } catch (error) {
    console.error("Failed to log history:", error);
  }
}

/**
 * Synchronizes benefit_cutoff_settings based on cutoff_settings changes
 */
async function syncBenefitCutoffs(
  cutoffType: string,
  startDate: string,
  endDate: string,
  updatedBy: string | null
) {
  try {
    // 1. Fetch matching benefit cutoff settings
    const qs = new URLSearchParams();
    qs.set("filter[cutoff][_eq]", cutoffType);
    qs.set("fields", "id");

    const config = await resolveApiConfig();
    if (!config) return;
    const base = config.apiBase;
    const getRes = await directusFetchAuth("GET", `/items/benefit_cutoff_settings?${qs}`, base);
    if (!getRes.ok) {
      console.error("Failed to fetch benefit cutoffs for sync:", getRes.error);
      return;
    }

    const items = (getRes.data as { data?: { id: string }[] })?.data || [];
    if (!items.length) return;

    // 2. Update each matching row
    for (const item of items) {
      const patchBody = {
        effective_from: startDate,
        effective_to: endDate,
        updated_by: updatedBy,
      };

      const patchRes = await directusFetchAuth(
        "PATCH",
        `/items/benefit_cutoff_settings/${item.id}`,
        base,
        patchBody
      );

      if (!patchRes.ok) {
        console.error(`Failed to sync benefit cutoff id ${item.id}:`, patchRes.error);
      }
    }
  } catch (error) {
    console.error("Benefit cutoff sync error:", error);
  }
}

/**
 * Checks if relevant fields have changed between old and new data
 */
function hasChanged(oldData: Record<string, unknown>, newData: Record<string, unknown>) {
  const fieldsToCompare = [
    "status",
    "month",
    "year",
    "cutoff_type",
    "start_date",
    "end_date",
    "payout_date",
    "period_status",
    "created_by",
    "updated_by",
  ];

  return fieldsToCompare.some((field) => {
    const oldVal = oldData?.[field];
    const newVal = newData?.[field];
    // Simple comparison; adjust if needed for dates/json
    return oldVal !== newVal;
  });
}

/**
 * Builds query for /items/user.
 * If ids are provided: filters by OR(id in ids, user_id in ids).
 */
function buildUsersQuery(ids: string[]) {
  const qs = new URLSearchParams();
  qs.set("fields", "user_id,user_fname,user_mname,user_lname,user_email");
  qs.set("limit", "500");

  // If you want stable ordering. Some roles block sort; remove if needed.
  // qs.set("sort", "user_lname");

  if (ids.length) {
    // Filter by user_id in ids
    qs.set("filter[user_id][_in]", ids.join(","));
  }

  return qs.toString();
}

/**
 * GET /api/cutoff-settings
 * - default: returns cutoff_settings (optionally filtered by month/year)
 * - if ?resource=users : returns user list (optionally filtered by ids)
 */
export async function GET(req: NextRequest) {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const API_BASE = config.apiBase;

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");

  // Users proxy
  if (resource === "users") {
    const ids = parseIdsParam(url.searchParams.get("ids"));
    const qs = buildUsersQuery(ids);

    // Use auth proxy to allow Directus to authenticate the request
    const result = await directusFetchAuth("GET", `/items/user?${qs}`, API_BASE, undefined, req);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, raw: result.raw },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data, {
      status: 200,
      headers: corsHeaders(),
    });
  }

  // Cutoff settings proxy (token-based if available)
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");
  const qs = buildCutoffSettingsQuery(month, year);

  const result = await directusFetchAuth("GET", `/items/cutoff_settings?${qs}`, API_BASE, undefined, req);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status, headers: corsHeaders() }
    );
  }

  return NextResponse.json(result.data, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req: NextRequest) {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const API_BASE = config.apiBase;

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await directusFetchAuth("POST", `/items/cutoff_settings`, API_BASE, payload, req);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status, headers: corsHeaders() }
    );
  }

  // Log History for INSERT
  const newData = (result.data as { data?: Record<string, unknown> })?.data || result.data as Record<string, unknown>;
  if (newData) {
    await logHistory("INSERT", newData, newData.created_by as string | null);
    await syncBenefitCutoffs(
      newData.cutoff_type as string,
      newData.start_date as string,
      newData.end_date as string,
      newData.created_by as string | null
    );
  }

  return NextResponse.json(result.data, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function PATCH(req: NextRequest) {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const API_BASE = config.apiBase;

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const items = Array.isArray(payload) ? payload : [payload];
  const results: unknown[] = [];

  for (const item of items) {
    const id = item?.id;

    if (id) {
      // Fetch OLD data for comparison if needed
      const oldRes = await directusFetchAuth("GET", `/items/cutoff_settings/${id}`, API_BASE, undefined, req);
      const oldData = oldRes.ok ? (oldRes.data as { data?: Record<string, unknown> })?.data || oldRes.data as Record<string, unknown> : null;

      const patchBody = { ...item };
      delete patchBody.id;
      const r = await directusFetchAuth(
        "PATCH",
        `/items/cutoff_settings/${id}`,
        API_BASE,
        patchBody,
        req
      );

      if (!r.ok) {
        return NextResponse.json(
          { error: r.error, raw: r.raw },
          { status: r.status, headers: corsHeaders() }
        );
      }

      const newData = (r.data as { data?: Record<string, unknown> })?.data || r.data as Record<string, unknown>;
      if (newData && oldData && hasChanged(oldData, newData)) {
        await logHistory("UPDATE", newData, newData.updated_by as string | null);

        // Sync if relevant fields changed
        if (
          oldData.start_date !== newData.start_date ||
          oldData.end_date !== newData.end_date ||
          oldData.cutoff_type !== newData.cutoff_type
        ) {
          await syncBenefitCutoffs(
            newData.cutoff_type as string,
            newData.start_date as string,
            newData.end_date as string,
            newData.updated_by as string | null
          );
        }
      }

      results.push(newData);
    } else {
      const r = await directusFetchAuth("POST", `/items/cutoff_settings`, API_BASE, item, req);

      if (!r.ok) {
        return NextResponse.json(
          { error: r.error, raw: r.raw },
          { status: r.status, headers: corsHeaders() }
        );
      }

      const newData = (r.data as { data?: Record<string, unknown> })?.data || r.data as Record<string, unknown>;
      if (newData) {
        await logHistory("INSERT", newData, newData.created_by as string | null);
        await syncBenefitCutoffs(
          newData.cutoff_type as string,
          newData.start_date as string,
          newData.end_date as string,
          newData.created_by as string | null
        );
      }

      results.push(newData);
    }
  }

  return NextResponse.json(
    { data: results },
    { status: 200, headers: corsHeaders() }
  );
}

export async function DELETE(req: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }
  const API_BASE = config.apiBase;

  if (!API_BASE) {
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500, headers: corsHeaders() }
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing ID for deletion" },
      { status: 400, headers: corsHeaders() }
    );
  }

  // Fetch data BEFORE deletion for history
  const getOld = await directusFetchAuth("GET", `/items/cutoff_settings/${id}`, API_BASE, undefined, req);
  const oldData = getOld.ok ? (getOld.data as { data?: Record<string, unknown> })?.data || getOld.data as Record<string, unknown> : null;

  const result = await directusFetchAuth("DELETE", `/items/cutoff_settings/${id}`, API_BASE, undefined, req);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status, headers: corsHeaders() }
    );
  }

  if (oldData) {
    await logHistory("DELETE", oldData, oldData.updated_by as string | null);
  }

  return NextResponse.json(
    { message: "Deleted successfully" },
    { status: 200, headers: corsHeaders() }
  );
}

// Testable helpers
export const __testables = {
  normalizeBaseUrl,
  buildCutoffSettingsQuery,
  buildUsersQuery,
  buildUrl,
  parseIdsParam,
};
