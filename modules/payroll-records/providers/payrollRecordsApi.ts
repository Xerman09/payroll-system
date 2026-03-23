// modules/payroll-records/providers/payrollRecordsApi.ts
import type { CutoffHistoryRow, Department, Employee, PayrollRunEmployeeRow } from "../types";

const BASE = "/api/payroll-records";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const detail =
      json?.error ||
      (json?.body as Record<string, unknown>)?.error ||
      (typeof text === "string" ? text.slice(0, 300) : "No body");
    throw new Error(`PayrollRecords API ${res.status} ${res.statusText}: ${detail}`);
  }

  return json as T;
}

export async function fetchEmployees(): Promise<{ data: Employee[]; meta?: { companyName?: string } }> {
  const data = await getJson<{ data: Employee[]; meta?: { companyName?: string } }>(`${BASE}?type=employees`);
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta,
  };
}

export async function fetchDepartments(): Promise<{ data: Department[]; meta?: { companyName?: string } }> {
  const data = await getJson<{ data: Department[]; meta?: { companyName?: string } }>(`${BASE}?type=departments`);
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta,
  };
}

export async function fetchCutoffs(): Promise<{ data: CutoffHistoryRow[]; meta?: { companyName?: string } }> {
  const data = await getJson<{ data: CutoffHistoryRow[]; meta?: { companyName?: string } }>(`${BASE}?type=cutoffs`);
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta,
  };
}

export async function fetchTapSheet(args: {
  cutoffStart: string;
  cutoffEnd: string;
  departmentName: string;
}): Promise<{ data: PayrollRunEmployeeRow[]; meta?: { companyName?: string } }> {
  const qs = new URLSearchParams({
    type: "top-sheet",
    cutoff_start: args.cutoffStart,
    cutoff_end: args.cutoffEnd,
    department_name: args.departmentName,
  });

  const data = await getJson<{ data: PayrollRunEmployeeRow[]; meta?: { companyName?: string } }>(`${BASE}?${qs.toString()}`);
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    meta: data?.meta,
  };
}
