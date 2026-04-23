import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders, CompanyConfig } from "@/lib/api-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function normalizeBase(base: string): string {
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function buildHeaders(req: NextRequest, config: CompanyConfig, opts?: { json?: boolean }): Headers {
  const h = new Headers(buildForwardHeaders(req, config, { 
    contentType: opts?.json ? "application/json" : undefined 
  }));
  return h;
}

type ResourceKey = "users" | "additions" | "deductions";

function endpoints(resource: ResourceKey) {
  switch (resource) {
    case "users":
      return {
        list: "/items/user?limit=-1",
        single: (id: string) => `/items/user/${id}`,
        create: "/items/user",
      };
    case "additions":
      return {
        list: "/items/payroll_other_additions?limit=-1",
        single: (id: string) => `/items/payroll_other_additions/${id}`,
        create: "/items/payroll_other_additions",
      };
    case "deductions":
      return {
        list: "/items/payroll_other_deductions?limit=-1",
        single: (id: string) => `/items/payroll_other_deductions/${id}`,
        create: "/items/payroll_other_deductions",
      };
    default:
      return null;
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function jsonError(message: string, status = 500, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: message, ...(extra ? { extra } : {}) },
    { status }
  );
}

function log(...args: unknown[]) {
  // server-side logs (terminal)
  console.log("[ADDDED API] - route.ts:89", ...args);
}

function logErr(...args: unknown[]) {
  console.error("[ADDDED API] - route.ts:93", ...args);
}

// =====================
// GET
// =====================
export async function GET(request: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return jsonError("No enterprise entity selected. Please visit the portal to choose one.", 400);
  }
  const EXTERNAL_API_BASE = config.apiBase;
  const base = normalizeBase(EXTERNAL_API_BASE);
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") as ResourceKey | null;
  const id = searchParams.get("id");

  log("GET", { resource, id, base });

  if (!base) {
    logErr("Missing API base env. Set API_BASE in .env.local and restart dev server.");
    return jsonError("API_BASE is not set. Set API_BASE in .env.local and restart.", 500);
  }

  if (!resource) return jsonError("Missing resource", 400);

  const ep = endpoints(resource);
  if (!ep) return jsonError("Invalid resource", 400);

  const path = id ? ep.single(id) : ep.list;

  try {
    const url = `${base}${path}`;
    log("Fetching external:", url);

    const res = await fetch(url, {
      cache: "no-store",
      headers: buildHeaders(request as NextRequest, config),
    });

    log("External response:", { status: res.status, ok: res.ok, url });

    if (!res.ok) {
      const text = await safeReadText(res);
      logErr("External error response:", { status: res.status, url, text: text.slice(0, 600) });
      return jsonError(text || res.statusText, res.status, { url });
    }

    const data: unknown = await res.json();

    // extra logging for list endpoints
    const maybe = data as { data?: unknown };
    if (Array.isArray(maybe?.data)) {
      log("Returned array length:", maybe.data.length, "resource:", resource);
    } else {
      log("Returned payload keys:", data && typeof data === "object" ? Object.keys(data as object) : typeof data);
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    logErr("Proxy fetch failed:", { message: messageOf(err), base, path });
    return jsonError("Proxy failed to reach external API.", 502, {
      message: messageOf(err),
      base,
      path,
    });
  }
}

// =====================
// POST
// =====================
type PostBody = { resource: ResourceKey; data: unknown };

export async function POST(request: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return jsonError("No enterprise entity selected. Please visit the portal to choose one.", 400);
  }
  const EXTERNAL_API_BASE = config.apiBase;
  const base = normalizeBase(EXTERNAL_API_BASE);
  if (!base) return jsonError("API_BASE is not set. Set API_BASE and restart.", 500);

  const body = (await request.json().catch(() => null)) as PostBody | null;
  const resource = body?.resource;
  const data = body?.data;

  log("POST", { resource, base });

  if (!resource) return jsonError("Missing resource in body", 400);
  if (!data) return jsonError("Missing data in body", 400);

  const ep = endpoints(resource);
  if (!ep) return jsonError("Invalid resource", 400);

  try {
    const url = `${base}${ep.create}`;
    log("Creating external:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(request as NextRequest, config, { json: true }),
      body: JSON.stringify(data),
    });

    log("External response:", { status: res.status, ok: res.ok, url });

    if (!res.ok) {
      const text = await safeReadText(res);
      logErr("External error response:", { status: res.status, url, text: text.slice(0, 600) });
      return jsonError(text || res.statusText, res.status);
    }

    const result: unknown = await res.json();
    return NextResponse.json(result);
  } catch (err: unknown) {
    logErr("POST proxy failed:", messageOf(err));
    return jsonError("Proxy failed to reach external API.", 502, { message: messageOf(err) });
  }
}

// =====================
// PATCH
// =====================
type PatchBody = { resource: ResourceKey; id: string | number; data: unknown };

export async function PATCH(request: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return jsonError("No enterprise entity selected. Please visit the portal to choose one.", 400);
  }
  const EXTERNAL_API_BASE = config.apiBase;
  const base = normalizeBase(EXTERNAL_API_BASE);
  if (!base) return jsonError("API_BASE is not set. Set API_BASE and restart.", 500);

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const resource = body?.resource;
  const id = body?.id;
  const data = body?.data;

  log("PATCH", { resource, id, base });

  if (!resource) return jsonError("Missing resource in body", 400);
  if (id === undefined || id === null) return jsonError("Missing id in body", 400);
  if (!data) return jsonError("Missing data in body", 400);

  const ep = endpoints(resource);
  if (!ep) return jsonError("Invalid resource", 400);

  try {
    const url = `${base}${ep.single(String(id))}`;
    log("Patching external:", url);

    const res = await fetch(url, {
      method: "PATCH",
      headers: buildHeaders(request as NextRequest, config, { json: true }),
      body: JSON.stringify(data),
    });

    log("External response:", { status: res.status, ok: res.ok, url });

    if (!res.ok) {
      const text = await safeReadText(res);
      logErr("External error response:", { status: res.status, url, text: text.slice(0, 600) });
      return jsonError(text || res.statusText, res.status);
    }

    const result: unknown = await res.json();
    return NextResponse.json(result);
  } catch (err: unknown) {
    logErr("PATCH proxy failed:", messageOf(err));
    return jsonError("Proxy failed to reach external API.", 502, { message: messageOf(err) });
  }
}

// =====================
// DELETE
// =====================
export async function DELETE(request: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return jsonError("No enterprise entity selected. Please visit the portal to choose one.", 400);
  }
  const EXTERNAL_API_BASE = config.apiBase;
  const base = normalizeBase(EXTERNAL_API_BASE);
  if (!base) return jsonError("API_BASE is not set. Set API_BASE and restart.", 500);

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") as ResourceKey | null;
  const id = searchParams.get("id");

  log("DELETE", { resource, id, base });

  if (!resource) return jsonError("Missing resource", 400);
  if (!id) return jsonError("Missing id", 400);

  const ep = endpoints(resource);
  if (!ep) return jsonError("Invalid resource", 400);

  try {
    const url = `${base}${ep.single(id)}`;
    log("Deleting external:", url);

    const res = await fetch(url, {
      method: "DELETE",
      headers: buildHeaders(request as NextRequest, config),
    });

    log("External response:", { status: res.status, ok: res.ok, url });

    if (!res.ok) {
      const text = await safeReadText(res);
      logErr("External error response:", { status: res.status, url, text: text.slice(0, 600) });
      return jsonError(text || res.statusText, res.status);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    logErr("DELETE proxy failed:", messageOf(err));
    return jsonError("Proxy failed to reach external API.", 502, { message: messageOf(err) });
  }
}