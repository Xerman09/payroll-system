import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";


async function forwardResponse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(
      { error: data?.errors?.[0]?.message || data?.error || res.statusText },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const API_TARGET = config.apiBase;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "users") {
      const res = await fetch(`${API_TARGET}/items/user?limit=-1`, {
        headers: buildForwardHeaders(request, config),
        cache: "no-store",
      });
      return forwardResponse(res);
    }

    searchParams.delete("mode");
    const res = await fetch(`${API_TARGET}/items/employee_allowance?${searchParams.toString()}`, {
      headers: buildForwardHeaders(request, config),
      cache: "no-store",
    });
    return forwardResponse(res);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const API_TARGET = config.apiBase;
    const body = await request.json();
    const res = await fetch(`${API_TARGET}/items/employee_allowance`, {
      method: "POST",
      headers: buildForwardHeaders(request, config, { contentType: "application/json" }),
      body: JSON.stringify(body),
    });
    return forwardResponse(res);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const API_TARGET = config.apiBase;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const body = await request.json();
    const res = await fetch(`${API_TARGET}/items/employee_allowance/${id}`, {
      method: "PATCH",
      headers: buildForwardHeaders(request, config, { contentType: "application/json" }),
      body: JSON.stringify(body),
    });
    return forwardResponse(res);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const API_TARGET = config.apiBase;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const res = await fetch(`${API_TARGET}/items/employee_allowance/${id}`, {
      method: "DELETE",
      headers: buildForwardHeaders(request, config),
    });
    if (res.status === 204) return NextResponse.json({ success: true });
    return forwardResponse(res);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}