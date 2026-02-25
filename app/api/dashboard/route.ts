import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

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
        { error: "Missing API base URL" },
        { status: 500 }
      );
    }

    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "";

    url.searchParams.delete("path");
    const extra = url.searchParams.toString();

    const fetchUrl = `${joinUrl(BASE, path)}${extra ? (path.includes("?") ? "&" : "?") + extra : ""}`;
    console.log(`[dashboardProxy] Final Fetch URL: ${fetchUrl}`);

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: buildForwardHeaders(req),
      cache: "no-store",
    });

    const data = await parseJsonSafe(res);
    console.log(`[dashboardProxy] Downstream response: ${res.status}, items: ${data?.data?.length ?? 0}`);
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("API dashboard GET error:", e);
    return NextResponse.json(
      { error: e?.message || "GET failed" },
      { status: 500 }
    );
  }
}
