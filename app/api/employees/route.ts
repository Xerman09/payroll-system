import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders, buildProxyUrl, parseJsonSafe, joinUrl } from "@/lib/api-helper";

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

    const url = new URL(req.url);
    if (!url.searchParams.get("path")) {
      url.searchParams.set("path", "/items/user?limit=-1&sort=user_lname");
    }

    const fetchUrl = buildProxyUrl(url.toString(), BASE);
    const fwdHeaders = buildForwardHeaders(req, config);

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: fwdHeaders,
      cache: "no-store",
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API employees GET error:", e);
    return NextResponse.json(
      { error: e?.message || "GET failed" },
      { status: 500 }
    );
  }
}

async function checkEmployeeReadOnly(req: NextRequest, config: any): Promise<boolean> {
  try {
    const BASE = config.apiBase;
    const fetchUrl = joinUrl(BASE, "/items/general_setting?filter[setting_key][_eq]=payroll_employee_management_read_only&limit=1");
    const fwdHeaders = buildForwardHeaders(req, config);
    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: fwdHeaders,
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = await parseJsonSafe(res);
    const rows = json?.data || [];
    if (rows.length > 0 && rows[0]?.setting_value != null) {
      const val = String(rows[0].setting_value).trim();
      return val === "1" || val.toLowerCase() === "true";
    }
    return false;
  } catch {
    return false;
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

    if (path.startsWith("/items/user")) {
      const isReadOnly = await checkEmployeeReadOnly(req, config);
      if (isReadOnly) {
        return NextResponse.json(
          { error: "Employee Management is currently in read-only mode. Adding records is disabled." },
          { status: 403 }
        );
      }
    }

    console.log("[employees POST payload to Directus]:", JSON.stringify(payload));
    const res = await fetch(joinUrl(BASE, path), {
      method: "POST",
      headers: buildForwardHeaders(req, config, { contentType: "application/json" }),
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API employees POST error:", e);
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

    if (path.startsWith("/items/user")) {
      const isReadOnly = await checkEmployeeReadOnly(req, config);
      if (isReadOnly) {
        return NextResponse.json(
          { error: "Employee Management is currently in read-only mode. Editing records is disabled." },
          { status: 403 }
        );
      }
    }

    const res = await fetch(joinUrl(BASE, path), {
      method: "PATCH",
      headers: buildForwardHeaders(req, config, { contentType: "application/json" }),
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API employees PATCH error:", e);
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

    if (path.startsWith("/items/user")) {
      const isReadOnly = await checkEmployeeReadOnly(req, config);
      if (isReadOnly) {
        return NextResponse.json(
          { error: "Employee Management is currently in read-only mode. Deleting records is disabled." },
          { status: 403 }
        );
      }
    }

    const res = await fetch(joinUrl(BASE, path), {
      method: "DELETE",
      headers: buildForwardHeaders(req, config),
    });

    if (res.status === 204) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const data = await parseJsonSafe(res);
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API employees DELETE error:", e);
    return NextResponse.json(
      { error: e?.message || "DELETE failed" },
      { status: 500 }
    );
  }
}
