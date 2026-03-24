export interface LogisticsArea {
  id: number;
  area_id: number;
  area_name: string;
  max_days: number | null;
  mode_type: 'DELIVERY' | 'PICKUP ONLY' | 'PICKUP W/ MP DELIVERY';
}

export interface LogisticsStaff {
  id: number;
  staff_id: number;
  role: 'Driver' | 'Helper';
  employment_type: string | null;
  vehicle_type_id: number | null;
}

export interface LogisticsVehicleType {
  id: number;
  type_name: string;
}

export interface SalaryMatrix {
  id?: number;
  area_id: number;
  staff_id: number;
  vehicle_type_id: number | null;
  wage_amount: number;
}

export interface WageMatrixData {
  areas: LogisticsArea[];
  staff: LogisticsStaff[];
  vehicleTypes: LogisticsVehicleType[];
  matrix: SalaryMatrix[];
}
