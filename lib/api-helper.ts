import { cookies } from "next/headers";
import { CompanyConfig, getCompanyById } from "./companies";

export type { CompanyConfig };

/**
 * Server-side helper to resolve the current company's API configuration.
 * It reads the 'selected_company_id' cookie.
 * If not present, it returns null (Strict Selection).
 * 
 * ✅ NEXT.js 16: cookies() returns a Promise and must be awaited.
 */
export async function resolveApiConfig(): Promise<CompanyConfig | null> {
  const cookieStore = await cookies();
  const companyId = cookieStore.get("selected_company_id")?.value;
  return getCompanyById(companyId);
}

/**
 * Helper to get the API base URL directly.
 */
export async function getApiBase(): Promise<string | null> {
  const config = await resolveApiConfig();
  return config?.apiBase || null;
}

/**
 * Helper to get the default department ID for the current context.
 */
export async function getDefaultDeptId(): Promise<string | null> {
  const config = await resolveApiConfig();
  return config?.deptId || null;
}

const SERVICE_TOKEN =
  process.env.DIRECTUS_TOKEN ||
  process.env.DIRECTUS_SERVICE_TOKEN ||
  process.env.NEXT_PUBLIC_DIRECTUS_TOKEN ||
  "";

/**
 * Builds headers for forwarding requests to the Directus API.
 *
 * Options:
 *   useEntityToken:    Inject the company-specific token (only use when you know the token has sufficient permissions)
 *   forceServiceToken: Ignore incoming user auth, use company or global token (implies useEntityToken)
 *   noAuth:            No Authorization header at all (public endpoints)
 *   contentType:       Set Content-Type header
 */
export function buildForwardHeaders(
  req?: { headers: { get: (name: string) => string | null } } | null,
  config?: CompanyConfig | null,
  options?: { contentType?: string; forceServiceToken?: boolean; noAuth?: boolean; useEntityToken?: boolean; useGlobalToken?: boolean }
) {
  const { contentType, forceServiceToken, noAuth, useGlobalToken } = options || {};
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;

  if (useGlobalToken && SERVICE_TOKEN) {
    headers["Authorization"] = `Bearer ${SERVICE_TOKEN}`;
  } else if (!noAuth) {
    const auth = req?.headers.get("authorization");

    if (auth && !forceServiceToken) {
      // 1. Forward the incoming user's auth header (highest priority)
      headers["Authorization"] = auth;
    } else if (config?.token) {
      // 2. Use entity-specific token (prioritized for multi-company context)
      headers["Authorization"] = `Bearer ${config.token}`;
    } else if (SERVICE_TOKEN) {
      // 3. Fall back to global service token (legacy/global collections)
      headers["Authorization"] = `Bearer ${SERVICE_TOKEN}`;
    }
  }

  // NOTE: Do NOT forward the browser Cookie header to Directus.
  // Cookies belong to the Next.js session layer. Sending them to Directus
  // causes authentication conflicts and INTERNAL_SERVER_ERROR (500) responses.

  return headers;
}

/**
 * Standardizes constructing a downstream URL for proxy routes.
 * Handles the common pattern of a 'path' query parameter containing a downstream endpoint.
 */
export function buildProxyUrl(reqUrl: string, apiBase: string): string {
  const url = new URL(reqUrl);
  const pathValue = url.searchParams.get("path") || "";
  url.searchParams.delete("path");

  // Construct the downstream URL safely
  const downstreamUrl = new URL(apiBase.replace(/\/+$/, ""));
  
  // Parse the 'path' param (which may contain its own path and query string)
  const [purePath, queryStr] = pathValue.split("?");
  
  // Join the paths correctly
  const b = downstreamUrl.pathname.replace(/\/+$/, "");
  const p = purePath.startsWith("/") ? purePath : `/${purePath}`;
  downstreamUrl.pathname = `${b}${p}`;

  // Add query parameters from the 'path' segment
  if (queryStr) {
    const pathParams = new URLSearchParams(queryStr);
    pathParams.forEach((v, k) => downstreamUrl.searchParams.append(k, v));
  }

  // Add any remaining top-level query parameters
  url.searchParams.forEach((v, k) => downstreamUrl.searchParams.append(k, v));

  return downstreamUrl.toString();
}

/**
 * Safely constructs a downstream URL from a base and a path payload, formatting Directus system roots.
 */
export function joinUrl(base: string, path: string): string {
  const b = String(base || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * Safely parses JSON from a response, handling empty bodies and non-JSON text.
 */
export async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { data: null, error: text };
  }
}
