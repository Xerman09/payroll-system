import type { NextRequest } from "next/server";
// Standardized Multi-Entity Proxy Handler
import { NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders, buildProxyUrl, parseJsonSafe } from "@/lib/api-helper";

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
    console.log(`[dashboardProxy] Target: ${fetchUrl}`);

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: buildForwardHeaders(req, config),
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
