import { LogisticsArea, LogisticsLocation, LogisticsStaff, LogisticsVehicleType } from "../types";

const BASE_API = "/api/compensation-settings";

async function apiFetch(resource: string, options: RequestInit = {}) {
  const url = `${BASE_API}?resource=${resource}&limit=-1`;
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  
  if (!res.ok) throw new Error(data?.error || "API request failed");
  return data;
}

async function apiMutate(method: "POST" | "PATCH" | "DELETE", resource: string, body?: { id?: number; [key: string]: unknown }) {
  const url = `${BASE_API}?resource=${resource}${method === "DELETE" && body?.id ? `&id=${body.id}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method !== "DELETE" ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }

  if (!res.ok) throw new Error(data?.error || "API mutation failed");
  return data;
}

// Area API
export const fetchAreas = () => apiFetch("area");
export const createArea = (data: Partial<LogisticsArea>) => apiMutate("POST", "area", data);
export const patchArea = (id: number, data: Partial<LogisticsArea>) => apiMutate("PATCH", "area", { ...data, id });
export const deleteArea = (id: number) => apiMutate("DELETE", "area", { id });

// Location API
export const fetchLocations = () => apiFetch("location");
export const createLocation = (data: Partial<LogisticsLocation>) => apiMutate("POST", "location", data);
export const patchLocation = (id: number, data: Partial<LogisticsLocation>) => apiMutate("PATCH", "location", { ...data, id });
export const deleteLocation = (id: number) => apiMutate("DELETE", "location", { id });

// Staff API
export const fetchStaffs = () => apiFetch("staff");
export const createStaff = (data: Partial<LogisticsStaff>) => apiMutate("POST", "staff", data);
export const patchStaff = (id: number, data: Partial<LogisticsStaff>) => apiMutate("PATCH", "staff", { ...data, id });
export const deleteStaff = (id: number) => apiMutate("DELETE", "staff", { id });

// Vehicle Type API
export const fetchVehicleTypes = () => apiFetch("vehicle_type");
export const createVehicleType = (data: Partial<LogisticsVehicleType>) => apiMutate("POST", "vehicle_type", data);
export const patchVehicleType = (id: number, data: Partial<LogisticsVehicleType>) => apiMutate("PATCH", "vehicle_type", { ...data, id });
export const deleteVehicleType = (id: number) => apiMutate("DELETE", "vehicle_type", { id });
