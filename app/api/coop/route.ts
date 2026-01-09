import { NextRequest, NextResponse } from "next/server";
import { buildExternalUrlFromUrl } from "./_routeHelpers";

const EXTERNAL_API_BASE = process.env.API_BASE;

export async function GET(req: NextRequest) {
  try {
    const url = buildExternalUrlFromUrl(req.url, EXTERNAL_API_BASE);
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
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
    const url = buildExternalUrlFromUrl(req.url, EXTERNAL_API_BASE);
    const body = await req.json();

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const url = buildExternalUrlFromUrl(req.url, EXTERNAL_API_BASE);
    const body = await req.json();

    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
    const url = buildExternalUrlFromUrl(req.url, EXTERNAL_API_BASE);

    const res = await fetch(url, { method: "DELETE" });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // @ts-ignore
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
