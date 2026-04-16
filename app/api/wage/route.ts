// app/api/wage/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveApiConfig } from "@/lib/api-helper";


// Optional service token (recommended for server-to-Directus calls)
const SERVICE_TOKEN =
  process.env.DIRECTUS_TOKEN ||
  process.env.DIRECTUS_SERVICE_TOKEN ||
  process.env.NEXT_PUBLIC_DIRECTUS_TOKEN ||
  "";

function joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function buildForwardHeaders(req: NextRequest, contentType?: string) {
  const headers: Record<string, string> = {};

  if (contentType) headers["Content-Type"] = contentType;

  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  const cookie = req.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;

  if (!headers["Authorization"] && SERVICE_TOKEN) {
    headers["Authorization"] = `Bearer ${SERVICE_TOKEN}`;
  }

  return headers;
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function GET(req: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const BASE = config.apiBase;

    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "";

    // remove "path" from query string and append remaining to the downstream request
    url.searchParams.delete("path");
    const extra = url.searchParams.toString();

    const hasQueryAlready = path.includes("?");
    const fetchUrl = `${joinUrl(BASE, path)}${extra ? (hasQueryAlready ? "&" : "?") + extra : ""
      }`;

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: buildForwardHeaders(req),
      cache: "no-store",
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API wage GET error: - route.ts:77", e);
    return NextResponse.json(
      { error: e?.message || "GET failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const BASE = config.apiBase;

    const body = await req.json();
    const path = body?.path;
    const payload = body?.payload;

    if (!path) {
      return NextResponse.json({ error: "Missing body.path" }, { status: 400 });
    }

    const res = await fetch(joinUrl(BASE, path), {
      method: "POST",
      headers: buildForwardHeaders(req, "application/json"),
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API wage POST error: - route.ts:111", e);
    return NextResponse.json(
      { error: e?.message || "POST failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const BASE = config.apiBase;

    const body = await req.json();
    const path = body?.path;
    const payload = body?.payload;

    if (!path) {
      return NextResponse.json({ error: "Missing body.path" }, { status: 400 });
    }

    const res = await fetch(joinUrl(BASE, path), {
      method: "PATCH",
      headers: buildForwardHeaders(req, "application/json"),
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API wage PATCH error: - route.ts:145", e);
    return NextResponse.json(
      { error: e?.message || "PATCH failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const BASE = config.apiBase;
    if (!BASE) {
      return NextResponse.json(
        { error: "Missing API base URL (API_BASE / NEXT_PUBLIC_API_BASE)" },
        { status: 500 }
      );
    }

    // Support both body.path and ?path=... for flexibility
    const url = new URL(req.url);
    const queryPath = url.searchParams.get("path") || "";

    const body = await req.json().catch(() => null);
    const bodyPath = body?.path as string | undefined;

    const path = bodyPath || queryPath;
    if (!path) {
      return NextResponse.json(
        { error: "Missing body.path or query ?path=" },
        { status: 400 }
      );
    }

    const res = await fetch(joinUrl(BASE, path), {
      method: "DELETE",
      headers: buildForwardHeaders(req),
    });

    // Directus may return 204 No Content
    if (res.status === 204) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API wage DELETE error: - route.ts:190", e);
    return NextResponse.json(
      { error: e?.message || "DELETE failed" },
      { status: 500 }
    );
  }
}
