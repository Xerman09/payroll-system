/**
 * Dynamic Entity Discovery System.
 * This registry automatically scans environment variables (API_BASE_I, API_BASE_II...)
 * to discover and register business units at runtime.
 */

export interface CompanyConfig {
  id: string;
  name: string;
  apiBase: string;
  deptId: string;
  description: string;
  color: string;
  hidden?: boolean;
  token?: string;
}

const ROMAN_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20
};

/**
 * Deterministic color generation based on string name.
 * Used as a fallback if API_BASE_COLOR_[INDEX] is missing.
 */
function generateColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

/**
 * Discover companies from environment variables.
 * Scans for API_BASE_[ROMAN_NUMERAL]
 */
function discoverCompanies(): CompanyConfig[] {
  if (typeof process === "undefined" || !process.env) return [];

  const found: { num: number; config: CompanyConfig }[] = [];

  // Iterate through ROMAN_MAP to find matching environment variables
  for (const [roman, num] of Object.entries(ROMAN_MAP)) {
    const apiBase = process.env[`API_BASE_${roman}`];
    
    // Only register if the base URL exists (Zero-Hardcode Rule)
    if (apiBase) {
      const name = process.env[`API_BASE_NAME_${roman}`] || `Enterprise Entity ${roman}`;
      const config: CompanyConfig = {
        id: process.env[`API_BASE_ID_${roman}`] || roman.toLowerCase(),
        name,
        apiBase: apiBase.replace(/\/+$/, ""), // Normalize URL
        deptId: process.env[`API_DEPT_ID_${roman}`] || "1",
        description: process.env[`API_BASE_DESC_${roman}`] || "Enterprise Resource Hub",
        color: process.env[`API_BASE_COLOR_${roman}`] || generateColor(name),
        hidden: process.env[`API_BASE_HIDDEN_${roman}`] === "true",
        token: process.env[`API_BASE_TOKEN_${roman}`] || undefined
      };
      
      found.push({ num, config });
    }
  }

  // Sort by numeric value (I, II, III...)
  return found.sort((a, b) => a.num - b.num).map(item => item.config);
}

// Singleton instances for performance
export const COMPANIES: CompanyConfig[] = discoverCompanies();

/**
 * Helper to find a company by ID.
 * Since discovery is dynamic, this checks the runtime registry.
 */
export function getCompanyById(id: string | null | undefined): CompanyConfig | null {
  if (!id) return null;
  return COMPANIES.find(c => c.id === id) || null;
}
