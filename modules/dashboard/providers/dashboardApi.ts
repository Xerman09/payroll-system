// @modules/dashboard/providers/dashboardApi.ts

const BASE_API = "/api/dashboard";
const BATCH_SIZE = 1000;

async function apiFetch(path: string, params: Record<string, string> = {}, options?: RequestInit) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_API}?path=${encodeURIComponent(path)}${qs ? "&" : ""}${qs}`;
  console.log(`[dashboardApi] Requesting: ${url}`);

  const res = await fetch(url, {
    cache: "no-store",
    ...options,
  });

  const json = await res.json().catch(() => null);
  console.log(`[dashboardApi] Response status: ${res.status}, data length: ${json?.data?.length ?? 0}`);

  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status} ${path}`);
  }

  return json;
}

async function fetchAllInBatches<T>(endpoint: string, baseParams: Record<string, string> = {}): Promise<T[]> {
  let allItems: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = {
      ...baseParams,
      limit: String(BATCH_SIZE),
      page: String(page),
    };

    const json = await apiFetch(endpoint, params);
    const rows = json.data || [];

    allItems = [...allItems, ...rows];
    console.log(`[dashboardApi] Batch ${page} fetched ${rows.length} items. Total so far: ${allItems.length}`);

    if (rows.length < BATCH_SIZE) {
      console.log(`[dashboardApi] Stopping batching: rows.length (${rows.length}) < BATCH_SIZE (${BATCH_SIZE})`);
      hasMore = false;
    } else {
      page++;
    }
  }

  return allItems;
}

export async function fetchUsers(params: Record<string, string> = {}): Promise<Record<string, unknown>[]> {
  // Always fetch in batches to ensure we get everything regardless of system limits
  return fetchAllInBatches<Record<string, unknown>>("/items/user", params);
}

export async function fetchDepartments(): Promise<Record<string, unknown>[]> {
  return fetchAllInBatches<Record<string, unknown>>("/items/department");
}

export async function fetchPostedPayrollRuns(): Promise<Record<string, unknown>[]> {
  const params = {
    "filter[status][_eq]": "POSTED",
    sort: "cutoff_end",
    fields: "cutoff_end,total_net"
  };

  return fetchAllInBatches<Record<string, unknown>>("/items/payroll_run", params);
}

export async function fetchPendingApprovals(): Promise<Record<string, unknown>[]> {
  const params = {
    "filter[status][_eq]": "pending",
    fields: "approval_id"
  };

  return fetchAllInBatches<Record<string, unknown>>("/items/attendance_approval", params);
}
