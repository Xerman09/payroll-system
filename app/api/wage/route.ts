// app/api/wage/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "";
    const query = url.searchParams.toString().replace(/^path=[^&]*&?/, "");
    const fetchUrl = `${BASE}${path}${query ? `?${query}` : ""}`;

    const res = await fetch(fetchUrl);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("API wage GET error: - route.ts:18", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = body.path;
    const payload = body.payload;

    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("API wage POST error: - route.ts:37", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const path = body.path;
    const payload = body.payload;

    const res = await fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("API wage PATCH error: - route.ts:56", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
