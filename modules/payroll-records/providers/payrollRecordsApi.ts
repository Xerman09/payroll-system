// modules/payroll-records/providers/payrollRecordsApi.ts
import type { CutoffHistoryRow, Department, Employee, PayrollRunEmployeeRow } from "../types";

const BASE = "/api/payroll-records";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const detail =
      json?.error ||
      json?.body?.error ||
      (typeof text === "string" ? text.slice(0, 300) : "No body");
    throw new Error(`PayrollRecords API ${res.status} ${res.statusText}: ${detail}`);
  }

  return json as T;
}

export async function fetchEmployees(): Promise<Employee[]> {
  const data = await getJson<{ data: Employee[] }>(`${BASE}?type=employees`);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchDepartments(): Promise<Department[]> {
  const data = await getJson<{ data: Department[] }>(`${BASE}?type=departments`);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchCutoffs(): Promise<CutoffHistoryRow[]> {
  const data = await getJson<{ data: CutoffHistoryRow[] }>(`${BASE}?type=cutoffs`);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchTapSheet(args: {
  cutoffStart: string;
  cutoffEnd: string;
  departmentName: string;
}): Promise<PayrollRunEmployeeRow[]> {
  const qs = new URLSearchParams({
    type: "top-sheet",
    cutoff_start: args.cutoffStart,
    cutoff_end: args.cutoffEnd,
    department_name: args.departmentName,
  });

  const data = await getJson<{ data: PayrollRunEmployeeRow[] }>(`${BASE}?${qs.toString()}`);
  return Array.isArray(data?.data) ? data.data : [];
}
