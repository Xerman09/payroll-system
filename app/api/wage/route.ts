// app/api/wage/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

// Optional service token (recommended for server-to-Directus calls)
// If set, it will be used when the browser request has no Authorization header.
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

  // Forward incoming Authorization if present (browser may not have this)
  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  // Forward cookies (if your Directus auth uses cookies)
  const cookie = req.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;

  // If no incoming Authorization, use service token if available
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
    if (!BASE) {
      return NextResponse.json(
        { error: "Missing API base URL (API_BASE / NEXT_PUBLIC_API_BASE)" },
        { status: 500 }
      );
    }

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

    // ✅ propagate status code from Directus
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("API wage GET error: - route.ts:83", e);
    return NextResponse.json({ error: e?.message || "GET failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!BASE) {
      return NextResponse.json(
        { error: "Missing API base URL (API_BASE / NEXT_PUBLIC_API_BASE)" },
        { status: 500 }
      );
    }

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

    // ✅ propagate Directus status code
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("API wage POST error: - route.ts:116", e);
    return NextResponse.json({ error: e?.message || "POST failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!BASE) {
      return NextResponse.json(
        { error: "Missing API base URL (API_BASE / NEXT_PUBLIC_API_BASE)" },
        { status: 500 }
      );
    }

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

    // ✅ propagate Directus status code
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("API wage PATCH error: - route.ts:149", e);
    return NextResponse.json({ error: e?.message || "PATCH failed" }, { status: 500 });
  }
}
