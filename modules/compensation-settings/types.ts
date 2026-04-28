export interface LogisticsArea {
  id: number;
  area_id: number;
  area_name: string;
  max_days?: number | null;
  mode_type?: 'DELIVERY' | 'PICKUP ONLY' | 'PICKUP W/ MP DELIVERY' | null;
  is_deleted: number;
  created_by?: number | null;
  created_at: string;
}

export interface LogisticsLocation {
  id: number;
  location_id: number;
  area_id: number;
  region: string;
  province: string;
  city: string;
  location?: string; // Re-added as optional for legacy compatibility and runtime safety
  distance?: number | null;
  is_deleted: number;
  created_by?: number | null;
  created_at: string;
}

export interface LogisticsStaff {
  id: number;
  staff_id: number;
  role: 'Driver' | 'Helper';
  employment_type?: 'EXTRA' | 'PROBATIONARY' | 'REGULAR(<10W)' | 'REGULAR(10W/T)' | null;
  vehicle_type_id?: number | null;
  is_deleted: number;
  created_by?: number | null;
  created_at: string;
}

export interface LogisticsVehicleType {
  id: number;
  type_name: string;
  is_payroll?: boolean | number;
}

export interface PSGCRegion {
  code: string;
  name: string;
  regionName: string;
  islandGroupCode: string;
}

export interface PSGCProvince {
  code: string;
  name: string;
  regionCode: string;
  islandGroupCode: string;
}

export interface PSGCCityMunicipality {
  code: string;
  name: string;
  oldName: string;
  isCity: boolean;
  isMunicipality: boolean;
  provinceCode: string;
  districtCode: string;
  regionCode: string;
  islandGroupCode: string;
}
