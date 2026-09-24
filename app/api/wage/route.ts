import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders, buildProxyUrl, parseJsonSafe, joinUrl } from "@/lib/api-helper";
import { encryptNumber, decryptNumber } from "@/lib/encryption";

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
    const fwdHeaders = buildForwardHeaders(req, config);

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: fwdHeaders,
      cache: "no-store",
    });

    const data = await parseJsonSafe(res);
    
    // Intercept and decrypt user_wage_management data
    if (fetchUrl.includes("user_wage_management") && data?.data) {
      const resolveDaily = (row: any) => {
        if (row?.encrypted_daily_wage) {
          const dec = decryptNumber(row.encrypted_daily_wage);
          if (dec > 0) return dec;
        }
        return Number(row?.daily_wage || 0);
      };

      if (Array.isArray(data.data)) {
        data.data = data.data.map((row: any) => ({
          ...row,
          daily_wage: resolveDaily(row),
        }));
      } else if (typeof data.data === "object") {
        data.data.daily_wage = resolveDaily(data.data);
      }
    }

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

    // Intercept and encrypt user_wage_management data
    const modifiedPayload = { ...payload };
    if (path.includes("user_wage_management") && modifiedPayload.daily_wage !== undefined) {
      modifiedPayload.encrypted_daily_wage = encryptNumber(modifiedPayload.daily_wage);
      modifiedPayload.daily_wage = Number(modifiedPayload.daily_wage) || 0;
    }

    console.log("[wage POST payload to Directus]:", JSON.stringify(modifiedPayload));
    const res = await fetch(joinUrl(BASE, path), {
      method: "POST",
      headers: buildForwardHeaders(req, config, { contentType: "application/json" }),
      body: JSON.stringify(modifiedPayload),
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

    // Intercept and encrypt user_wage_management data
    const modifiedPayload = { ...payload };
    if (path.includes("user_wage_management") && modifiedPayload.daily_wage !== undefined) {
      modifiedPayload.encrypted_daily_wage = encryptNumber(modifiedPayload.daily_wage);
      modifiedPayload.daily_wage = Number(modifiedPayload.daily_wage) || 0;
    }

    const res = await fetch(joinUrl(BASE, path), {
      method: "PATCH",
      headers: buildForwardHeaders(req, config, { contentType: "application/json" }),
      body: JSON.stringify(modifiedPayload),
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
      headers: buildForwardHeaders(req, config),
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
