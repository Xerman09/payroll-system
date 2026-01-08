// app/api/cutoff-settings/route.ts
import { NextRequest, NextResponse } from "next/server";

type HttpMethod = "GET" | "POST" | "PATCH";

const API_BASE =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://100.110.197.61:8056";

const DIRECTUS_TOKEN =
  process.env.DIRECTUS_TOKEN ||
  process.env.DIRECTUS_STATIC_TOKEN ||
  process.env.NEXT_PUBLIC_DIRECTUS_TOKEN ||
  "";

function normalizeBaseUrl(url: string) {
  return String(url || "").replace(/\/+$/, "");
}

function buildUrl(path: string) {
  const base = normalizeBaseUrl(API_BASE);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
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
async function directusFetchAuth(method: HttpMethod, path: string, body?: unknown) {
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (method !== "GET") headers["Content-Type"] = "application/json";
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;

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
async function directusFetchNoAuth(method: HttpMethod, path: string, body?: unknown) {
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (method !== "GET") headers["Content-Type"] = "application/json";

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
  if (!API_BASE) {
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");

  // Users proxy
  if (resource === "users") {
    const ids = parseIdsParam(url.searchParams.get("ids"));
    const qs = buildUsersQuery(ids);

    // Use no-auth for users, like login
    const result = await directusFetchNoAuth("GET", `/items/user?${qs}`);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, raw: result.raw },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  }

  // Cutoff settings proxy (token-based if available)
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");
  const qs = buildCutoffSettingsQuery(month, year);

  const result = await directusFetchAuth("GET", `/items/cutoff_settings?${qs}`);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status }
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}

export async function POST(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await directusFetchAuth("POST", `/items/cutoff_settings`, payload);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, raw: result.raw },
      { status: result.status }
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const items = Array.isArray(payload) ? payload : [payload];
  const results: unknown[] = [];

  for (const item of items) {
    const id = item?.id;

    if (id) {
      const { id: _id, ...patchBody } = item;
      const r = await directusFetchAuth(
        "PATCH",
        `/items/cutoff_settings/${id}`,
        patchBody
      );

      if (!r.ok) {
        return NextResponse.json(
          { error: r.error, raw: r.raw },
          { status: r.status }
        );
      }

      results.push((r.data as any)?.data ?? r.data);
    } else {
      const r = await directusFetchAuth("POST", `/items/cutoff_settings`, item);

      if (!r.ok) {
        return NextResponse.json(
          { error: r.error, raw: r.raw },
          { status: r.status }
        );
      }

      results.push((r.data as any)?.data ?? r.data);
    }
  }

  return NextResponse.json({ data: results }, { status: 200 });
}

// Testable helpers
export const __testables = {
  normalizeBaseUrl,
  buildCutoffSettingsQuery,
  buildUsersQuery,
  buildUrl,
  parseIdsParam,
};
