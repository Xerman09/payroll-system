import type { UserRow } from "../types";

type DirectusList<T> = { data: T[]; meta?: unknown };
type DirectusSingle<T> = { data: T; meta?: unknown };

const BASE = "/api/payroll-run";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = json?.error || json?.details || "Request failed";
    console.error(`apiFetch failed: ${res.status} ${res.statusText}`, {
      url,
      status: res.status,
      json,
    });
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return json as T;
}

function qs(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || String(v) === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

export async function listItems<T>(
  resource: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const res = await listItemsWithMeta<T>(resource, params);
  return res.data;
}

export async function listItemsWithMeta<T>(
  resource: string,
  params: Record<string, unknown>,
): Promise<DirectusList<T>> {
  const query = qs({ resource, ...params });
  const json = await apiFetch<DirectusList<T>>(`${BASE}?${query}`, {
    method: "GET",
  });
  return {
    data: json?.data ?? [],
    meta: json?.meta,
  } as DirectusList<T>;
}

export async function getItem<T>(
  resource: string,
  id: number | string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await getItemWithMeta<T>(resource, id, params);
  return res.data;
}

export async function getItemWithMeta<T>(
  resource: string,
  id: number | string,
  params: Record<string, unknown>,
): Promise<DirectusSingle<T>> {
  const query = qs({ resource, id, ...params });
  const json = await apiFetch<DirectusSingle<T>>(`${BASE}?${query}`, {
    method: "GET",
  });
  return json;
}

export async function createItem<T>(resource: string, payload: unknown): Promise<T> {
  const query = qs({ resource });
  const json = await apiFetch<DirectusSingle<T>>(`${BASE}?${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  return json.data as T;
}

export async function patchItem<T>(
  resource: string,
  id: number | string,
  payload: unknown,
): Promise<T> {
  const query = qs({ resource, id });
  const json = await apiFetch<DirectusSingle<T>>(`${BASE}?${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  return json.data as T;
}

export async function deleteItem(resource: string, id: number | string): Promise<void> {
  const query = qs({ resource, id });
  await apiFetch(`${BASE}?${query}`, { method: "DELETE" });
}

// ----------------------------------------------------------------------
// USER AUTHENTICATION & ACCESS LOGGING
// ----------------------------------------------------------------------

export async function fetchUserById(userId: number): Promise<UserRow> {
  const query = qs({ resource: "user", id: userId });
  const json = await apiFetch<DirectusSingle<UserRow>>(`${BASE}?${query}`, {
    method: "GET",
  });
  return json.data;
}

export async function verifyPassword(userId: number, password: string) {
  const res = await fetch("/api/auth/verify-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message || "Password verification failed");
  }
  return json;
}

export async function logPayrollRunAccess(
  openedById: number,
  cutoffId: number,
  departmentId: number | null,
  remarks: string
) {
  try {
    const query = qs({ resource: "payroll_run_access_log" });
    return await apiFetch(`${BASE}?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          opened_by: openedById,
          cutoff_id: cutoffId,
          department_id: departmentId,
          remarks,
        },
      }),
    });
  } catch (e: unknown) {
    console.error("logPayrollRunAccess failed - payrollApi.ts", e);
    const err = e as Record<string, unknown>;
    console.error("Error details:", {
      message: err?.message,
      stack: err?.stack,
      openedById,
      cutoffId,
      departmentId,
    });
  }
}

export async function toggleEmployeeHold(
  payrollRunEmployeeId: number,
  currentHoldStatus: boolean,
  userId: number,
  userName: string,
  role: string,
  breakdownJson: any,
  reason?: string
) {
  const newHoldStatus = !currentHoldStatus;
  
  // Update flags in breakdown JSON
  const updatedBreakdown = { ...breakdownJson };
  if (!updatedBreakdown.flags) {
    updatedBreakdown.flags = {};
  }
  
  if (newHoldStatus) {
    updatedBreakdown.flags.hold_by_user_id = userId;
    updatedBreakdown.flags.hold_by_user_name = userName;
    updatedBreakdown.flags.hold_by_role = role;
    updatedBreakdown.flags.hold_at = new Date().toISOString();
    if (reason) {
      updatedBreakdown.flags.hold_reason = reason;
    }
  } else {
    // If unholding, we might want to keep history, but for now just clear it or record unhold
    updatedBreakdown.flags.unhold_by_user_id = userId;
    updatedBreakdown.flags.unhold_by_user_name = userName;
    updatedBreakdown.flags.unhold_by_role = role;
    updatedBreakdown.flags.unhold_at = new Date().toISOString();
    
    // Clear the active hold flags
    delete updatedBreakdown.flags.hold_by_user_id;
    delete updatedBreakdown.flags.hold_by_user_name;
    delete updatedBreakdown.flags.hold_by_role;
    delete updatedBreakdown.flags.hold_at;
    delete updatedBreakdown.flags.hold_reason;
  }

  const payload = {
    on_hold: newHoldStatus ? 1 : 0,
    breakdown_json: updatedBreakdown,
  };

  return patchItem("payroll_run_employee", payrollRunEmployeeId, payload);
}

export async function toggleEmployeeReject(
  payrollRunEmployeeId: number,
  currentRejectStatus: boolean,
  userId: number,
  userName: string,
  role: string,
  breakdownJson: any,
  reason?: string
) {
  const newRejectStatus = !currentRejectStatus;
  
  // Update flags in breakdown JSON
  const updatedBreakdown = { ...breakdownJson };
  if (!updatedBreakdown.flags) {
    updatedBreakdown.flags = {};
  }
  
  if (newRejectStatus) {
    updatedBreakdown.flags.is_rejected = true;
    updatedBreakdown.flags.rejected_by_user_id = userId;
    updatedBreakdown.flags.rejected_by_user_name = userName;
    updatedBreakdown.flags.rejected_by_role = role;
    updatedBreakdown.flags.rejected_at = new Date().toISOString();
    if (reason) {
      updatedBreakdown.flags.reject_reason = reason;
    }
  } else {
    // Keep history if needed, but for now clear
    updatedBreakdown.flags.unrejected_by_user_id = userId;
    updatedBreakdown.flags.unrejected_by_user_name = userName;
    updatedBreakdown.flags.unrejected_by_role = role;
    updatedBreakdown.flags.unrejected_at = new Date().toISOString();
    
    // Clear the active reject flags
    delete updatedBreakdown.flags.is_rejected;
    delete updatedBreakdown.flags.rejected_by_user_id;
    delete updatedBreakdown.flags.rejected_by_user_name;
    delete updatedBreakdown.flags.rejected_by_role;
    delete updatedBreakdown.flags.rejected_at;
    delete updatedBreakdown.flags.reject_reason;
  }

  const payload = {
    breakdown_json: updatedBreakdown,
  };

  return patchItem("payroll_run_employee", payrollRunEmployeeId, payload);
}
