import type { Department, UserLookup } from "../types";

const BASE_API = "/api/departments";
const USERS_API = "/api/employees"; // we can reuse employees endpoint for users
const BATCH_SIZE = 100;

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

async function fetchAllInBatches<T>(baseUrl: string, endpoint: string): Promise<T[]> {
  let allItems: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const delimiter = endpoint.includes("?") ? "&" : "?";
    const url = `${endpoint}${delimiter}limit=${BATCH_SIZE}&page=${page}`;

    const json = await apiFetch(baseUrl, url);
    const rows = json.data || [];

    allItems = [...allItems, ...rows];

    if (rows.length < BATCH_SIZE) hasMore = false;
    else page++;
  }

  return allItems;
}

export type DepartmentListParams = {
  page: number;
  pageSize: number;
  search?: string;
  sortField?: keyof Department;
  sortOrder?: "asc" | "desc";
};

export async function fetchDepartmentsPaged({
  page,
  pageSize,
  search,
  sortField = "department_id",
  sortOrder = "asc",
}: DepartmentListParams): Promise<{ rows: Department[]; total: number }> {
  type DirectusFilter = {
    _and?: Array<Record<string, unknown>>;
  };
  const filterParams: DirectusFilter = {};
  const _and: Array<Record<string, unknown>> = [];

  const q = (search ?? "").trim();
  const isNumericId = q.length > 0 && /^[0-9]+$/.test(q);
  const numericId = isNumericId ? Number(q) : null;

  if (q) {
    const orFilters: Record<string, unknown>[] = [
      { department_name: { _icontains: q } },
      { department_head: { _icontains: q } },
    ];
    if (numericId !== null && Number.isFinite(numericId)) {
      orFilters.push({ department_id: { _eq: numericId } });
    }
    _and.push({ _or: orFilters });
  }

  if (_and.length > 0) {
    filterParams._and = _and;
  }

  const params: Record<string, string> = {
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
    sort: sortOrder === "desc" ? `-${String(sortField)}` : String(sortField),
    meta: "filter_count",
  };
  
  if (Object.keys(filterParams).length > 0) {
    params.filter = JSON.stringify(filterParams);
  }

  const query = new URLSearchParams(params).toString();
  const url = `/items/department?${query}`;

  const json = await apiFetch(BASE_API, url);
  const rows = (json.data || []) as Department[];
  const total = Number(json.meta?.filter_count) || 0;
  return { rows, total };
}

export async function fetchAllDepartments(): Promise<Department[]> {
  return fetchAllInBatches<Department>(BASE_API, "/items/department?sort=department_name");
}

export async function fetchAllUsers(): Promise<UserLookup[]> {
  // Assuming all employees can be heads.
  const filter = JSON.stringify({ _and: [{ is_employee: { _eq: 1 } }, { _or: [{ is_deleted: { _null: true } }, { is_deleted: { _eq: 0 } }] }] });
  return fetchAllInBatches<UserLookup>(USERS_API, `/items/user?filter=${filter}&sort=user_lname`);
}

export async function fetchDepartmentById(id: number): Promise<Department | null> {
  const json = await apiFetch(BASE_API, `/items/department/${id}`);
  return json.data || null;
}

export async function fetchGeneralSetting(key: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      "filter[setting_key][_eq]": key,
    });
    const json = await apiFetch(BASE_API, `/items/general_setting?${params.toString()}`);
    const data = json.data || [];
    if (data.length > 0 && data[0].setting_value != null) {
      return String(data[0].setting_value).trim();
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch general setting:", error);
    return null;
  }
}

export async function createDepartment(payload: Partial<Department>): Promise<Department> {
  const readOnly = await fetchGeneralSetting("payroll_department_management_read_only");
  if (readOnly === "1" || readOnly === "true") {
    throw new Error("Department Management is read-only. Adding departments is disabled.");
  }
  const json = await apiFetch(BASE_API, "/items/department", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return json.data;
}

export async function updateDepartment(id: number, payload: Partial<Department>): Promise<Department> {
  const readOnly = await fetchGeneralSetting("payroll_department_management_read_only");
  if (readOnly === "1" || readOnly === "true") {
    throw new Error("Department Management is read-only. Editing departments is disabled.");
  }
  const json = await apiFetch(BASE_API, `/items/department/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return json.data;
}

export async function deleteDepartment(id: number): Promise<void> {
  const readOnly = await fetchGeneralSetting("payroll_department_management_read_only");
  if (readOnly === "1" || readOnly === "true") {
    throw new Error("Department Management is read-only. Deleting departments is disabled.");
  }
  await apiFetch(BASE_API, `/items/department/${id}`, {
    method: "DELETE",
  });
}
