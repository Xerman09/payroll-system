import type { Employee, Department, EmploymentStatus } from "../types";

const BASE_API = "/api/employees";
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

async function apiFetch(path: string, options?: RequestInit) {
  const method = options?.method || "GET";
  
  if (method === "GET") {
    const res = await fetch(`${BASE_API}?path=${encodeURIComponent(path)}`, {
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
    
    const res = await fetch(BASE_API, {
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

async function fetchAllInBatches<T>(endpoint: string): Promise<T[]> {
  let allItems: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const delimiter = endpoint.includes("?") ? "&" : "?";
    const url = `${endpoint}${delimiter}limit=${BATCH_SIZE}&page=${page}`;

    const json = await apiFetch(url);
    const rows = json.data || [];

    allItems = [...allItems, ...rows];

    if (rows.length < BATCH_SIZE) hasMore = false;
    else page++;
  }

  return allItems;
}

export async function fetchDepartments(): Promise<Department[]> {
  return fetchAllInBatches<Department>("/items/department");
}

export async function fetchEmploymentStatuses(): Promise<EmploymentStatus[]> {
  return fetchAllInBatches<EmploymentStatus>("/items/employment_status");
}

export type EmployeeListParams = {
  page: number;
  pageSize: number;
  search?: string;
  deptId?: number | null;
  statusId?: number | null;
  sortField?: keyof Employee;
  sortOrder?: "asc" | "desc";
  showInactive?: boolean;
};

export async function fetchEmployeesPaged({
  page,
  pageSize,
  search,
  deptId,
  statusId,
  sortField = "user_id",
  sortOrder = "asc",
  showInactive = false,
}: EmployeeListParams): Promise<{ rows: Employee[]; total: number }> {
  type DirectusFilter = {
    _and: Array<Record<string, unknown>>;
  };
  const filterParams: DirectusFilter = {
    _and: [
      { is_employee: { _eq: 1 } },
    ],
  };

  if (!showInactive) {
    filterParams._and.push({
      _or: [{ is_deleted: { _null: true } }, { is_deleted: { _eq: 0 } }],
    });
  }

  const q = (search ?? "").trim();
  const isNumericId = q.length > 0 && /^[0-9]+$/.test(q);
  const numericId = isNumericId ? Number(q) : null;

  if (q) {
    const orFilters: Record<string, unknown>[] = [
      { user_fname: { _icontains: q } },
      { user_lname: { _icontains: q } },
      { user_email: { _icontains: q } },
    ];
    if (numericId !== null && Number.isFinite(numericId)) {
      orFilters.push({ user_id: { _eq: numericId } });
    }
    filterParams._and.push({ _or: orFilters });
  }

  if (typeof deptId === "number" && Number.isFinite(deptId)) {
    filterParams._and.push({ user_department: { _eq: deptId } });
  }
  
  if (typeof statusId === "number" && Number.isFinite(statusId)) {
    filterParams._and.push({ employment_status_id: { _eq: statusId } });
  }

  const params: Record<string, string> = {
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
    sort: sortOrder === "desc" ? `-${String(sortField)}` : String(sortField),
    meta: "filter_count",
    filter: JSON.stringify(filterParams),
  };

  const query = new URLSearchParams(params).toString();
  const url = `/items/user?${query}`;

  const json = await apiFetch(url);
  const rows = (json.data || []) as Employee[];
  const total = Number(json.meta?.filter_count) || 0;
  return { rows, total };
}

export async function fetchEmployeeById(userId: number): Promise<Employee | null> {
  const json = await apiFetch(`/items/user/${userId}`);
  return json.data || null;
}

export async function createEmployee(payload: Partial<Employee>): Promise<Employee> {
  const json = await apiFetch("/items/user", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return json.data;
}

export async function updateEmployee(userId: number, payload: Partial<Employee>): Promise<Employee> {
  const json = await apiFetch(`/items/user/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return json.data;
}

export async function deleteEmployee(userId: number): Promise<void> {
  await apiFetch(`/items/user/${userId}`, {
    method: "DELETE",
  });
}
