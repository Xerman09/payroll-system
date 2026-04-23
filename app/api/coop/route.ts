import { NextRequest, NextResponse } from "next/server";
import { buildExternalUrlFromUrl } from "./_routeHelpers";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

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
    const EXTERNAL_API_BASE = config.apiBase;
    const url = buildExternalUrlFromUrl(req.url, EXTERNAL_API_BASE);
    const res = await fetch(url, {
      headers: buildForwardHeaders(req, config),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    const EXTERNAL_API_BASE = config.apiBase;
    const url = buildExternalUrlFromUrl(req.url, EXTERNAL_API_BASE);
    const body = await req.json();

    const res = await fetch(url, {
      method: "POST",
      headers: buildForwardHeaders(req, config, { contentType: "application/json" }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    const EXTERNAL_API_BASE = config.apiBase;
    const url = buildExternalUrlFromUrl(req.url, EXTERNAL_API_BASE);
    const body = await req.json();

    const res = await fetch(url, {
      method: "PATCH",
      headers: buildForwardHeaders(req, config, { contentType: "application/json" }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    const EXTERNAL_API_BASE = config.apiBase;
    const url = buildExternalUrlFromUrl(req.url, EXTERNAL_API_BASE);

    const res = await fetch(url, { 
      method: "DELETE",
      headers: buildForwardHeaders(req, config),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
