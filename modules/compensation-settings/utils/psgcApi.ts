import { PSGCProvince, PSGCCityMunicipality, PSGCRegion } from "../types";

const PSGC_BASE_URL = "https://psgc.gitlab.io/api";

const regionAliases: Record<string, string> = {
  "National Capital Region (NCR)": "NCR",
  "NCR": "NCR",
  "Cordillera Administrative Region (CAR)": "CAR",
  "Region I (Ilocos Region)": "Region 1",
  "Region II (Cagayan Valley)": "Region 2",
  "Region III (Central Luzon)": "Region 3",
  "Region IV-A (CALABARZON)": "Region 4A",
  "Region IV-B (MIMAROPA Region)": "Region 4B",
  "Region V (Bicol Region)": "Region 5",
  "Region VI (Western Visayas)": "Region 6",
  "Region VII (Central Visayas)": "Region 7",
  "Region VIII (Eastern Visayas)": "Region 8",
  "Region IX (Zamboanga Peninsula)": "Region 9",
  "Region X (Northern Mindanao)": "Region 10",
  "Region XI (Davao Region)": "Region 11",
  "Region XII (SOCCSKSARGEN)": "Region 12",
  "Region XIII (Caraga)": "CARAGA",
  "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)": "BARMM",
};

/**
 * Maps a long region name to its shorthand alias.
 * Uses fuzzy matching to handle API variations.
 */
export function getRegionAlias(name: string): string {
  if (!name) return "";
  const normalized = name.trim();
  
  // Exact match
  if (regionAliases[normalized]) return regionAliases[normalized];

  // Fuzzy match (contains)
  const foundByInclude = Object.entries(regionAliases).find(([key]) => 
    normalized.toLowerCase().includes(key.toLowerCase()) || 
    key.toLowerCase().includes(normalized.toLowerCase())
  );
  
  if (foundByInclude) return foundByInclude[1];

  // Pattern match for "Region X"
  const regionMatch = normalized.match(/Region\s+([IVXLCDM\d]+)/i);
  if (regionMatch) {
    const num = regionMatch[1];
    // Map Roman to Arabic if needed, but the alias map already handles common ones.
    return `Region ${num}`;
  }

  return normalized;
}

/**
 * Fetches all regions from PSGC API.
 */
export async function getRegions(): Promise<PSGCRegion[]> {
  const response = await fetch(`${PSGC_BASE_URL}/regions/`);
  if (!response.ok) throw new Error("Failed to fetch regions");
  const data: PSGCRegion[] = await response.json();
  
  return data.map(r => ({
    ...r,
    name: getRegionAlias(r.name)
  }));
}

/**
 * Fetches all provinces from PSGC API.
 */
export async function getProvinces(): Promise<PSGCProvince[]> {
  const response = await fetch(`${PSGC_BASE_URL}/provinces/`);
  if (!response.ok) throw new Error("Failed to fetch provinces");
  return response.json();
}

/**
 * Fetches provinces for a specific region.
 */
export async function getProvincesInRegion(regionCode: string): Promise<PSGCProvince[]> {
  const response = await fetch(`${PSGC_BASE_URL}/regions/${regionCode}/provinces/`);
  if (!response.ok) throw new Error(`Failed to fetch provinces for region ${regionCode}`);
  const data = await response.json();
  
  // NCR Special Case: NCR has Districts instead of Provinces
  if (data.length === 0) {
    const distResponse = await fetch(`${PSGC_BASE_URL}/regions/${regionCode}/districts/`);
    if (distResponse.ok) {
      return distResponse.json();
    }
  }
  
  return data;
}

/**
 * Fetches districts for a specific region (primarily for NCR).
 */
export async function getDistrictsInRegion(regionCode: string): Promise<PSGCProvince[]> {
  const response = await fetch(`${PSGC_BASE_URL}/regions/${regionCode}/districts/`);
  if (!response.ok) return [];
  return response.json();
}

/**
 * Fetches cities and municipalities for a specific province.
 */
export async function getCitiesInProvince(provinceCode: string): Promise<PSGCCityMunicipality[]> {
  // Try Province first
  let response = await fetch(`${PSGC_BASE_URL}/provinces/${provinceCode}/cities-municipalities/`);
  
  // If not found or error, try District (for NCR)
  if (!response.ok) {
    response = await fetch(`${PSGC_BASE_URL}/districts/${provinceCode}/cities-municipalities/`);
  }
  
  if (!response.ok) throw new Error(`Failed to fetch cities for geographic unit ${provinceCode}`);
  return response.json();
}

/**
 * Fetches all cities and municipalities in a specific region.
 */
export async function getCitiesInRegion(regionCode: string): Promise<PSGCCityMunicipality[]> {
  const response = await fetch(`${PSGC_BASE_URL}/regions/${regionCode}/cities-municipalities/`);
  if (!response.ok) throw new Error(`Failed to fetch cities for region ${regionCode}`);
  return response.json();
}

/**
 * Helper to extract name from code (e.g., if we only have the code stored)
 * Note: Since we are storing the name, this might just be for UI display.
 */
export function formatLocation(city: string, province: string): string {
  if (!city && !province) return "";
  if (!city) return province;
  if (!province) return city;
  return `${city}, ${province}`;
}
