// @modules/wage/providers/wageApi.ts
import type { Department, Employee, WagePayload, WageRecord } from "../types";

const BASE_API = "/api/wage";
const BATCH_SIZE = 100; // Chunk size for fetching "all" records

// Generic server-side fetch through Next.js API route
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(
    `${BASE_API}?path=${encodeURIComponent(path)}`,
    options
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.json();
}

/**
 * HELPER: Fetches all data by looping through pages
 * This replaces limit=-1 to prevent server/browser crashes on large datasets.
 */
async function fetchAllInBatches<T>(endpoint: string): Promise<T[]> {
  let allItems: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    // Determine delimiter (? or &) based on if endpoint already has params
    const delimiter = endpoint.includes("?") ? "&" : "?";

    // Directus uses 'page' and 'limit' for offset-based pagination
    const url = `${endpoint}${delimiter}limit=${BATCH_SIZE}&page=${page}`;

    const json = await apiFetch(url);
    const rows = json.data || [];

    allItems = [...allItems, ...rows];

    // If we got fewer rows than the batch size, we are on the last page
    if (rows.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allItems;
}

// ----------------------------------------------------------------------
// PUBLIC METHODS
// ----------------------------------------------------------------------

export async function fetchDepartments(): Promise<Department[]> {
  // Uses batching to safely get all departments
  return fetchAllInBatches<Department>("/items/department");
}

export async function fetchEmployees(): Promise<Employee[]> {
  // 1. Fetch ALL users in batches
  const allUsers = await fetchAllInBatches<Employee>("/items/user");

  // 2. Filter locally (for when you need a raw list of all active users)
  return allUsers.filter(
    (emp) => !emp.is_deleted || emp.is_deleted.data?.[0] === 0
  );
}

// Server-side pagination + search + filters for employees
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

  // 1. Build complex Server-Side Filter (Directus JSON Syntax)
  const filterParams: any = {
    _and: [
      // Condition 1: Must not be deleted (is_deleted IS NULL OR is_deleted = 0)
      {
        _or: [
          { is_deleted: { _null: true } },
          { is_deleted: { _eq: 0 } },
        ],
      },
    ],
  };

  // Condition 2: Search term (if exists)
  if (search) {
    filterParams._and.push({
      _or: [
        { user_fname: { _icontains: search } },
        { user_lname: { _icontains: search } },
        // Allow searching by string ID if needed
        { user_id: { _eq: search } },
      ],
    });
  }

  // Condition 3: Department (if selected)
  if (deptId) {
    filterParams._and.push({ user_department: { _eq: deptId } });
  }

  // 2. Prepare Query Parameters
  const params: Record<string, string | number> = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sort: sortOrder === "desc" ? `-${sortField}` : sortField,
    meta: "filter_count", // Ask server for total count after filtering
    filter: JSON.stringify(filterParams), // Pass complex filter
  };

  const query = new URLSearchParams(params as any).toString();
  const json = await apiFetch(`/items/user?${query}`);

  // Data is already filtered by server, but we keep safety check
  const data: Employee[] = (json.data || []);

  // 'filter_count' is the total matching records (e.g., 50), 
  // while data.length is just the current page (e.g., 5)
  const total: number = json?.meta?.filter_count ?? data.length;

  return { rows: data, total };
}

export async function fetchUserById(userId: number) {
  const json = await apiFetch(`/items/user/${userId}`);
  return json.data;
}

export async function fetchWageByUser(userId: number): Promise<WageRecord | null> {
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
    console.error("logWageAccess failed - wageApi.ts:185", e);
  }
}   