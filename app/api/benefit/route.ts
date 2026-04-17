// app/api/benefit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig } from "@/lib/api-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const SERVICE_TOKEN =
  process.env.DIRECTUS_TOKEN ||
  process.env.DIRECTUS_SERVICE_TOKEN ||
  process.env.DIRECTUS_ACCESS_TOKEN ||
  "";

function joinUrl(base: string, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function buildForwardHeaders(req: NextRequest, contentType?: string) {
  const h: Record<string, string> = {};

  // pass through Authorization if present
  const auth = req.headers.get("authorization");
  if (auth) h["Authorization"] = auth;
  else if (SERVICE_TOKEN) h["Authorization"] = `Bearer ${SERVICE_TOKEN}`;

  if (contentType) h["Content-Type"] = contentType;

  return h;
}

async function readBodyIfAny(req: NextRequest) {
  // Some methods have no body; avoid crashing on empty
  const text = await req.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function forward(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing ?path=" }, { status: 400 });
  }

  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }
  const DIRECTUS_BASE = (config.apiBase || "").replace(/\/+$/, "");

  if (path === "config") {
    return NextResponse.json({ companyName: config.name });
  }

  const targetUrl = joinUrl(DIRECTUS_BASE, path);

  const method = req.method.toUpperCase();

  // Read client body (your client sends { path, payload } for POST/PATCH)
  const bodyJson = await readBodyIfAny(req);
  const payload = bodyJson?.payload ?? bodyJson?.data ?? bodyJson ?? null;

  const init: RequestInit = {
    method,
    headers: buildForwardHeaders(req, payload ? "application/json" : undefined),
    // Only attach body for methods that normally carry body
    body:
      payload && (method === "POST" || method === "PATCH" || method === "PUT")
        ? JSON.stringify(payload)
        : undefined,
  };

  const upstream = await fetch(targetUrl, init);

  // ✅ Directus DELETE commonly returns 204 No Content
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const text = await upstream.text().catch(() => "");

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: "Upstream error",
        status: upstream.status,
        path,
        targetUrl,
        details: text || null,
      },
      { status: upstream.status }
    );
  }

  // ✅ If upstream returned empty body but not 204, still respond safely
  if (!text) return NextResponse.json({ ok: true });

  // Try JSON; fallback to raw
  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({ ok: true, raw: text });
  }
}

export async function GET(req: NextRequest) {
  return forward(req);
}
export async function POST(req: NextRequest) {
  return forward(req);
}
export async function PATCH(req: NextRequest) {
  return forward(req);
}
export async function DELETE(req: NextRequest) {
  return forward(req);
}
