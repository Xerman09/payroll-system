// app/api/benefit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders, buildProxyUrl } from "@/lib/api-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";




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
  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json(
      { error: "No enterprise entity selected. Please visit the portal to choose one." },
      { status: 400 }
    );
  }
  const DIRECTUS_BASE = (config.apiBase || "").replace(/\/+$/, "");

  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (path === "config") {
    return NextResponse.json({ companyName: config.name });
  }

  const targetUrl = buildProxyUrl(req.url, DIRECTUS_BASE);

  const method = req.method.toUpperCase();

  // Read client body (your client sends { path, payload } for POST/PATCH)
  const bodyJson = await readBodyIfAny(req);
  const payload = bodyJson?.payload ?? bodyJson?.data ?? bodyJson ?? null;

  const init: RequestInit = {
    method,
    headers: buildForwardHeaders(req, config, { contentType: payload ? "application/json" : undefined }),
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
