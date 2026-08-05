import type { AttendanceLog, AttendanceApproval, DepartmentSchedule } from "../types";
import { parseJsonSafe } from "@/lib/api-helper";

const BASE_API = "/api/attendance";

function extractDirectusErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;

  if (Array.isArray(j.errors) && j.errors.length > 0) {
    const e0 = j.errors[0] as Record<string, unknown> | null;
    return (e0?.message as string) || ((e0?.extensions as Record<string, unknown>)?.code as string) || "Directus error";
  }

  if (typeof j.error === "string") return j.error;

  return null;
}

async function apiFetch(baseUrl: string, path: string, options?: RequestInit) {
  const method = options?.method || "GET";
  
  if (method === "GET") {
    const res = await fetch(`${baseUrl}?path=${encodeURIComponent(path)}`, {
      cache: "no-store",
      ...options,
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = extractDirectusErrorMessage(json) || `HTTP ${res.status} ${path}`;
      throw new Error(msg);
    }
    const directusMsg = extractDirectusErrorMessage(json);
    if (directusMsg) throw new Error(directusMsg);
    
    return json;
  } else {
    // POST, PATCH, DELETE
    const payload = options?.body ? JSON.parse(options.body as string) : undefined;
    const reqBody = JSON.stringify({ path, payload });
    
    const res = await fetch(baseUrl, {
      method,
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: reqBody,
    });
    
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = extractDirectusErrorMessage(json) || `HTTP ${res.status} ${path}`;
      throw new Error(msg);
    }
    const directusMsg = extractDirectusErrorMessage(json);
    if (directusMsg) throw new Error(directusMsg);

    return json;
  }
}

export async function fetchPendingLogs(): Promise<AttendanceLog[]> {
  const filter = JSON.stringify({
    _or: [
      { approve_status: { _eq: "pending" } },
      { approve_status: { _null: true } },
    ]
  });
  // also fetch related user and department data
  const fields = "*,user_id.user_id,user_id.user_fname,user_id.user_lname,department_id.department_id,department_id.department_name";
  const url = `/items/attendance_log?filter=${filter}&fields=${fields}&sort=-log_date`;
  
  const json = await apiFetch(BASE_API, url);
  
  // map relations
  return (json.data || []).map((row: any) => ({
    ...row,
    user: row.user_id,
    user_id: row.user_id?.user_id,
    department: row.department_id,
    department_id: row.department_id?.department_id,
  }));
}

export async function fetchDepartmentSchedule(deptId: number): Promise<DepartmentSchedule | null> {
  const filter = JSON.stringify({ department_id: { _eq: deptId } });
  const url = `/items/department_schedule?filter=${filter}`;
  const json = await apiFetch(BASE_API, url);
  return json.data && json.data.length > 0 ? json.data[0] : null;
}

export async function fetchOvertimeRequest(userId: number, date: string): Promise<any | null> {
  const filter = JSON.stringify({
    _and: [
      { user_id: { _eq: userId } },
      { request_date: { _eq: date } }
    ]
  });
  const url = `/items/overtime_request?filter=${filter}&sort=-filed_at`;
  const json = await apiFetch(BASE_API, url);
  return json.data && json.data.length > 0 ? json.data[0] : null;
}

export async function submitApproval(
  logId: number, 
  payload: Partial<AttendanceApproval>
): Promise<void> {
  // 1. Create the attendance_approval record
  await apiFetch(BASE_API, "/items/attendance_approval", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // 2. Update the attendance_log status to approved (or rejected)
  await apiFetch(BASE_API, `/items/attendance_log/${logId}`, {
    method: "PATCH",
    body: JSON.stringify({ approve_status: payload.status }),
  });
}
