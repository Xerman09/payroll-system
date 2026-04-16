import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveApiConfig } from "@/lib/api-helper";

const SERVICE_TOKEN = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN || "";

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

  // Use service token if no user auth is present
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
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "";
    url.searchParams.delete("path");
    
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const BASE = config.apiBase;
    const extra = url.searchParams.toString();
    
    const fetchUrl = `${joinUrl(BASE || "", path)}${extra ? (path.includes("?") ? "&" : "?") + extra : ""}`;

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: buildForwardHeaders(req),
      cache: "no-store",
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { path, payload } = body;

    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const BASE = config.apiBase;
    const res = await fetch(joinUrl(BASE || "", path), {
      method: "PATCH",
      headers: buildForwardHeaders(req, "application/json"),
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    // For file uploads, we forward the multipart/form-data directly
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const path = req.nextUrl.searchParams.get("path") || "/files";
      
      const config = await resolveApiConfig();
      if (!config) {
        return NextResponse.json(
          { error: "No enterprise entity selected. Please visit the portal to choose one." },
          { status: 400 }
        );
      }
      const BASE = config.apiBase;
      const res = await fetch(joinUrl(BASE || "", path), {
        method: "POST",
        headers: {
          "Authorization": req.headers.get("authorization") || `Bearer ${SERVICE_TOKEN}`,
        },
        body: formData,
      });
      
      const data = await parseJsonSafe(res);
      return NextResponse.json(data, { status: res.status });
    }

    const body = await req.json();
    const { path, payload } = body;

    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const BASE = config.apiBase;
    const res = await fetch(joinUrl(BASE || "", path), {
      method: "POST",
      headers: buildForwardHeaders(req, "application/json"),
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
