import { cookies } from "next/headers";
import { CompanyConfig, getCompanyById } from "./companies";

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
