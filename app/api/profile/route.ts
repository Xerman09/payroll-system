import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders, buildProxyUrl, parseJsonSafe, joinUrl } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

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
    const fetchUrl = buildProxyUrl(req.url, BASE);

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: buildForwardHeaders(req, config),
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
      headers: buildForwardHeaders(req, config, { contentType: "application/json" }),
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
        headers: buildForwardHeaders(req, config),
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
      headers: buildForwardHeaders(req, config, { contentType: "application/json" }),
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
