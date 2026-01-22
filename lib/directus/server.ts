// src/lib/directus/server.ts
import { buildItemsUrl, getDirectusBase, getDirectusToken, makeAuthHeaders } from "./directus";

type ProxyArgs = {
  collection: string;
  id?: string;
  search?: string; // includes "?a=b" or "a=b"
  method: string;
  bodyText?: string | null;
  contentType?: string | null;
};

export async function directusProxyRequest(args: ProxyArgs): Promise<Response> {
  const base = getDirectusBase();
  const token = getDirectusToken();

  const url = buildItemsUrl({
    base,
    collection: args.collection,
    id: args.id,
    search: args.search,
  });

  const headers = makeAuthHeaders(token, {
    // Forward JSON content-type if present; Directus likes it for writes
    ...(args.contentType ? { "Content-Type": args.contentType } : {}),
  });

  const res = await fetch(url, {
    method: args.method,
    headers,
    body: args.bodyText ?? undefined,
    // Always dynamic; this is a transactional module (payroll)
    cache: "no-store",
  });

  // Return upstream payload as-is (status + body)
  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: {
      // preserve json if upstream sets it; fallback:
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
