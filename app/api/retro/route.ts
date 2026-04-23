import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

// Access the environment variable securely

/**
 * GET: Fetch all employees and retro pays
 */
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
    const [empRes, retroRes] = await Promise.all([
      fetch(
        `${EXTERNAL_API_BASE}/items/user?limit=-1&fields=user_id,user_fname,user_mname,user_lname,user_email,user_position`,
        { 
          headers: buildForwardHeaders(req, config),
          cache: "no-store" 
        }
      ),
      fetch(`${EXTERNAL_API_BASE}/items/retro_pay?fields=*,user_id.*`, {
        headers: buildForwardHeaders(req, config),
        cache: "no-store",
      }),
    ]);

    if (!empRes.ok || !retroRes.ok) {
      throw new Error("Failed to fetch data from external API");
    }

    const empJson = await empRes.json();
    const retroJson = await retroRes.json();

    return NextResponse.json({
      employees: empJson.data || [],
      retroPays: retroJson.data || [],
    });
  } catch (error) {
    console.error("API Proxy GET Error: - route.ts:33", error);
    return NextResponse.json(
      { error: "Failed to fetch retro pay data" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new retro pay
 */
export async function POST(request: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const EXTERNAL_API_BASE = config.apiBase;
    const body = await request.json();

    const res = await fetch(`${EXTERNAL_API_BASE}/items/retro_pay`, {
      method: "POST",
      headers: buildForwardHeaders(request, config, { contentType: "application/json" }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Proxy POST Error: - route.ts:65", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update a record
 * Usage: /api/retro?id=123
 */
export async function PATCH(request: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const EXTERNAL_API_BASE = config.apiBase;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required in query params" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const res = await fetch(`${EXTERNAL_API_BASE}/items/retro_pay/${id}`, {
      method: "PATCH",
      headers: buildForwardHeaders(request, config, { contentType: "application/json" }),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Proxy PATCH Error: - route.ts:108", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove a record
 * Usage: /api/retro?id=123
 */
export async function DELETE(request: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const EXTERNAL_API_BASE = config.apiBase;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required in query params" },
        { status: 400 }
      );
    }

    const res = await fetch(`${EXTERNAL_API_BASE}/items/retro_pay/${id}`, {
      method: "DELETE",
      headers: buildForwardHeaders(request, config),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: errorText },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Proxy DELETE Error: - route.ts:146", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}