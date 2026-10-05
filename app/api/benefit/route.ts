import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders, buildProxyUrl } from "@/lib/api-helper";
import { decryptNumber } from "@/lib/encryption";

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
  let path: string | null = null;
  let targetUrl = "";
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const DIRECTUS_BASE = (config.apiBase || "").replace(/\/+$/, "");

    const url = new URL(req.url);
    path = url.searchParams.get("path");
    if (path === "config") {
      return NextResponse.json({ companyName: config.name });
    }

    targetUrl = buildProxyUrl(req.url, DIRECTUS_BASE);

    const method = req.method.toUpperCase();

    // Read client body (your client sends { path, payload } for POST/PATCH)
    const bodyJson = await readBodyIfAny(req);
    const payload = bodyJson?.payload ?? bodyJson?.data ?? bodyJson ?? null;

    const init: RequestInit = {
      method,
      headers: buildForwardHeaders(req, config, { contentType: payload ? "application/json" : undefined }),
      cache: "no-store",
      // Only attach body for methods that normally carry body
      body:
        payload && (method === "POST" || method === "PATCH" || method === "PUT")
          ? JSON.stringify(payload)
          : undefined,
    };

    // Retry loop for GET requests to handle transient Tailscale/network glitches
    let upstream: Response | null = null;
    let lastError: unknown = null;
    const maxRetries = method === "GET" ? 3 : 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        upstream = await fetch(targetUrl, init);
        break;
      } catch (fErr: unknown) {
        lastError = fErr;
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 200 * attempt));
        }
      }
    }

    if (!upstream) {
      throw lastError || new Error("Failed to reach Directus upstream after retries");
    }

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
      const json = JSON.parse(text);

      // Intercept and decrypt user_wage_management data
      if (path && path.includes("user_wage_management") && json?.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resolveDaily = (row: any) => {
          if (row?.encrypted_daily_wage) {
            const dec = decryptNumber(row.encrypted_daily_wage);
            if (dec > 0) return dec;
          }
          return Number(row?.daily_wage || 0);
        };

        if (Array.isArray(json.data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          json.data = json.data.map((row: any) => ({
            ...row,
            daily_wage: resolveDaily(row),
          }));
        } else if (typeof json.data === "object" && json.data !== null) {
          json.data.daily_wage = resolveDaily(json.data);
        }
      }

      return NextResponse.json(json);
    } catch {
      return NextResponse.json({ ok: true, raw: text });
    }
  } catch (err: unknown) {
    const e = err as Error;
    console.error("[api/benefit] Forward failed:", e);
    return NextResponse.json(
      {
        error: "Upstream connection error",
        message: e.message || "Failed to reach Directus upstream",
        path,
        targetUrl,
      },
      { status: 502 }
    );
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
