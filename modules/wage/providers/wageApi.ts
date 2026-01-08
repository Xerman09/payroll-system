// @modules/wage/providers/wageApi.ts
import type {
  Department,
  Employee,
  WagePayload,
  WageRecord,
  WageProrationLogPayload,
  CutoffSetting,
} from "../types";

const BASE_API = "/api/wage";
const BATCH_SIZE = 100;

function extractDirectusErrorMessage(json: any): string | null {
  if (!json) return null;

  // Directus common pattern
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const e0 = json.errors[0];
    return e0?.message || e0?.extensions?.code || "Directus error";
  }

  // Your proxy error pattern
  if (typeof json.error === "string") return json.error;

  return null;
}

// Generic server-side fetch through Next.js API route
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_API}?path=${encodeURIComponent(path)}`, {
    cache: "no-store",
    ...options,
  });

  const json = await res.json().catch(() => null);

  // ✅ if proxy forwarded 4xx/5xx, throw
  if (!res.ok) {
    const msg = extractDirectusErrorMessage(json) || `HTTP ${res.status} ${path}`;
    throw new Error(msg);
  }

  // ✅ even if HTTP 200, Directus may still return { errors: [...] }
  const directusMsg = extractDirectusErrorMessage(json);
  if (directusMsg) throw new Error(directusMsg);

  return json;
}

/**
 * HELPER: Fetches all data by looping through pages
 */
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

// ----------------------------------------------------------------------
// PUBLIC METHODS
// ----------------------------------------------------------------------

export async function fetchDepartments(): Promise<Department[]> {
  return fetchAllInBatches<Department>("/items/department");
}

export async function fetchEmployees(): Promise<Employee[]> {
  const allUsers = await fetchAllInBatches<Employee>("/items/user");
  return allUsers.filter(
    (emp) => !emp.is_deleted || emp.is_deleted.data?.[0] === 0
  );
}

export type EmployeeListParams = {
  page: number;
  pageSize: number;
  search?: string;
  deptId?: number | null;
  sortField?: keyof Employee;
  sortOrder?: "asc" | "desc";
};

export async function fetchEmployeesPaged({
  page,
  pageSize,
  search,
  deptId,
  sortField = "user_id",
  sortOrder = "asc",
}: EmployeeListParams): Promise<{ rows: Employee[]; total: number }> {
  const filterParams: any = {
    _and: [
      {
        _or: [{ is_deleted: { _null: true } }, { is_deleted: { _eq: 0 } }],
      },
    ],
  };

  if (search) {
    filterParams._and.push({
      _or: [
        { user_fname: { _icontains: search } },
        { user_lname: { _icontains: search } },
        { user_id: { _eq: search } },
      ],
    });
  }

  if (deptId) {
    filterParams._and.push({ user_department: { _eq: deptId } });
  }

  const params: Record<string, string | number> = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sort: sortOrder === "desc" ? `-${String(sortField)}` : String(sortField),
    meta: "filter_count",
    filter: JSON.stringify(filterParams),
  };

  const query = new URLSearchParams(params as any).toString();
  const json = await apiFetch(`/items/user?${query}`);

  const data: Employee[] = json.data || [];
  const total: number = json?.meta?.filter_count ?? data.length;

  return { rows: data, total };
}

export async function fetchUserById(userId: number) {
  const json = await apiFetch(`/items/user/${userId}`);
  return json.data;
}

export async function fetchWageByUser(
  userId: number
): Promise<WageRecord | null> {
  const json = await apiFetch(
    `/items/user_wage_management?filter[user_id][_eq]=${userId}`
  );
  return (json.data && json.data[0]) || null;
}

export async function createWage(payload: WagePayload) {
  return apiFetch("/items/user_wage_management", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/items/user_wage_management", payload }),
  });
}

export async function patchWage(id: number, payload: WagePayload) {
  return apiFetch(`/items/user_wage_management/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/user_wage_management/${id}`,
      payload,
    }),
  });
}

export async function logWageAccess(
  openedById: number,
  userId: number,
  remarks: string
) {
  try {
    return apiFetch("/items/user_wage_access_log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/items/user_wage_access_log",
        payload: { user_id: userId, opened_by: openedById, remarks },
      }),
    });
  } catch (e) {
    console.error("logWageAccess failed - wageApi.ts:194", e);
  }
}

// ----------------------------------------------------------------------
// CUTOFF SETTINGS
// ----------------------------------------------------------------------

export async function findCutoffSettingByDate(
  dateYmd: string
): Promise<CutoffSetting | null> {
  const qs = new URLSearchParams({
    limit: "1",
    sort: "-start_date",
    [`filter[start_date][_lte]`]: dateYmd,
    [`filter[end_date][_gte]`]: dateYmd,
  }).toString();

  const json = await apiFetch(`/items/cutoff_settings?${qs}`);
  return (json?.data?.[0] as CutoffSetting) || null;
}

// ----------------------------------------------------------------------
// PRORATION LOG
// ----------------------------------------------------------------------

export async function createWageProrationLog(
  payload: WageProrationLogPayload
) {
  return apiFetch("/items/user_wage_proration_log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/user_wage_proration_log",
      payload,
    }),
  });
}
