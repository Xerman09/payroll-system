import { NextRequest, NextResponse } from "next/server";

const EXTERNAL_API_BASE = process.env.API_BASE;

// Whitelist allowed collections for security
const ALLOWED_COLLECTIONS = [
  "employee_loan",
  "user",
  "employee_loan_payment",
  "coop_savings_membership",
];

// Helper to construct the external URL
function buildExternalUrl(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const collection = searchParams.get("collection");
  const id = searchParams.get("id"); // ID for specific item operations

  if (!collection || !ALLOWED_COLLECTIONS.includes(collection)) {
    throw new Error("Invalid or missing collection parameter");
  }

  // Copy all other params (limit, offset, filters) to forward to external API
  const externalParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== "collection" && key !== "id") {
      externalParams.append(key, value);
    }
  });

  // Construct URL: http://.../items/collection[/id]?params
  let url = `${EXTERNAL_API_BASE}/items/${collection}`;
  if (id) {
    url += `/${id}`;
  }

  const queryString = externalParams.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  return url;
}

export async function GET(req: NextRequest) {
  try {
    const url = buildExternalUrl(req);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = buildExternalUrl(req);
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const url = buildExternalUrl(req);
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = buildExternalUrl(req);

    const res = await fetch(url, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    // DELETE often returns 204 No Content, handled here
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}