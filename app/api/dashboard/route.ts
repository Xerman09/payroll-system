import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveApiConfig } from "@/lib/api-helper";


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
  } catch (e: unknown) {
    console.error("API dashboard GET error:", e);
    const msg = e instanceof Error ? e.message : "GET failed";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
