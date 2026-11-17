import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

function normalizeBaseUrl(url: string) {
  return String(url || "").replace(/\/+$/, "");
}

function buildUrl(base: string, path: string) {
  const b = normalizeBaseUrl(base);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function GET(req: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json({ error: "No enterprise entity selected." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const prefix = searchParams.get("prefix");

    let query = "/items/general_setting?limit=250&sort=setting_key";
    if (prefix) {
      query += `&filter[setting_key][_starts_with]=${encodeURIComponent(prefix)}`;
    }

    const url = buildUrl(config.apiBase, query);
    const headers = buildForwardHeaders(req, config);

    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: json?.errors?.[0]?.message || `Directus request failed (${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json(json);
  } catch (err: any) {
    console.error("General Settings GET error:", err);
    return NextResponse.json({ error: err?.message || "Failed to load settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json({ error: "No enterprise entity selected." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Support either single { setting_key, setting_value } or batch [{ setting_key, setting_value }]
    const items: Array<{ setting_key: string; setting_value: string }> = Array.isArray(body)
      ? body
      : body.items && Array.isArray(body.items)
      ? body.items
      : [body];

    if (items.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    // 1. Fetch current settings to check existing IDs
    const listUrl = buildUrl(config.apiBase, "/items/general_setting?limit=250");
    const getHeaders = buildForwardHeaders(req, config);
    const listRes = await fetch(listUrl, {
      method: "GET",
      headers: getHeaders,
      cache: "no-store",
    });

    const listJson = await listRes.json().catch(() => null);
    const existingList: Array<{ id: number; setting_key: string; setting_value: string }> =
      listJson?.data || [];

    const existingMap = new Map<string, number>();
    for (const row of existingList) {
      if (row.setting_key && row.id != null) {
        existingMap.set(String(row.setting_key).trim(), row.id);
      }
    }

    const jsonHeaders = buildForwardHeaders(req, config, { contentType: "application/json" });
    const results = [];

    const nowIso = new Date().toISOString();

    for (const item of items) {
      const key = String(item.setting_key || "").trim();
      const val = String(item.setting_value ?? "").trim();
      if (!key) continue;

      const existingId = existingMap.get(key);

      if (existingId) {
        // Update existing setting
        const patchUrl = buildUrl(config.apiBase, `/items/general_setting/${existingId}`);
        const patchRes = await fetch(patchUrl, {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({
            setting_value: val,
            updated_at: nowIso,
          }),
        });
        const patchData = await patchRes.json().catch(() => null);
        results.push({ key, id: existingId, action: "updated", ok: patchRes.ok, data: patchData?.data });
      } else {
        // Insert new setting
        const postUrl = buildUrl(config.apiBase, "/items/general_setting");
        const postRes = await fetch(postUrl, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            setting_key: key,
            setting_value: val,
            created_at: nowIso,
            updated_at: nowIso,
          }),
        });
        const postData = await postRes.json().catch(() => null);
        results.push({ key, action: "created", ok: postRes.ok, data: postData?.data });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("General Settings POST error:", err);
    return NextResponse.json({ error: err?.message || "Failed to save settings" }, { status: 500 });
  }
}

