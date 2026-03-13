import { NextRequest, NextResponse } from "next/server";

const API_TARGET = process.env.API_BASE;

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
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "users") {
      const res = await fetch(`${API_TARGET}/items/user?limit=-1`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      return forwardResponse(res);
    }

    searchParams.delete("mode");
    const res = await fetch(`${API_TARGET}/items/employee_allowance?${searchParams.toString()}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return forwardResponse(res);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_TARGET}/items/employee_allowance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return forwardResponse(res);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const body = await request.json();
    const res = await fetch(`${API_TARGET}/items/employee_allowance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return forwardResponse(res);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const res = await fetch(`${API_TARGET}/items/employee_allowance/${id}`, {
      method: "DELETE",
    });
    if (res.status === 204) return NextResponse.json({ success: true });
    return forwardResponse(res);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}