// app/api/additions-deductions/route.ts
import { NextResponse } from "next/server";

const EXTERNAL_API_BASE = process.env.API_BASE;

/**
 * Helper to determine the external endpoint based on 'resource' param
 */
function getEndpoint(resource: string | null, id?: string | null) {
  switch (resource) {
    case "users":
      return `/items/user?limit=-1`;
    case "user":
      // Fetch single user by ID
      return `/items/user/${id}`;
    case "additions":
      return id
        ? `/items/payroll_other_additions/${id}`
        : `/items/payroll_other_additions?limit=-1`;
    case "deductions":
      return id
        ? `/items/payroll_other_deductions/${id}`
        : `/items/payroll_other_deductions?limit=-1`;
    default:
      return null;
  }
}

// GET: Fetch Lists or Single Items
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const id = searchParams.get("id");

  const endpoint = getEndpoint(resource, id);

  if (!endpoint) {
    return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
  }

  try {
    const res = await fetch(`${EXTERNAL_API_BASE}${endpoint}`, {
      cache: "no-store",
    });

    // Handle non-JSON responses or errors
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Proxy Failed" }, { status: 500 });
  }
}

// POST: Create New Records
export async function POST(request: Request) {
  const body = await request.json();
  const { resource, data } = body; // Expect payload wrapper

  const endpoint = getEndpoint(resource);

  if (!endpoint) return NextResponse.json({ error: "Invalid resource" }, { status: 400 });

  try {
    const res = await fetch(`${EXTERNAL_API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Proxy Failed" }, { status: 500 });
  }
}

// PATCH: Update Records
export async function PATCH(request: Request) {
  const body = await request.json();
  const { resource, id, data } = body;

  const endpoint = getEndpoint(resource, id);

  if (!endpoint) return NextResponse.json({ error: "Invalid resource" }, { status: 400 });

  try {
    const res = await fetch(`${EXTERNAL_API_BASE}${endpoint}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Proxy Failed" }, { status: 500 });
  }
}

// DELETE: Remove Records
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const id = searchParams.get("id");

  const endpoint = getEndpoint(resource, id);

  if (!endpoint || !id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const res = await fetch(`${EXTERNAL_API_BASE}${endpoint}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Proxy Failed" }, { status: 500 });
  }
}