// modules/payroll-run/providers/directusMasterData.ts

type DirectusListResponse<T> = {
  data: T[];
  meta?: unknown;
};

type DepartmentRow = {
  department_id: number;
  department_name: string;
};

type UserRow = {
  user_id: number;
  user_department: number | null; // department_id
};

function toQuery(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * ✅ IMPORTANT
 * Use the Next.js same-origin proxy endpoint to avoid CORS:
 * /api/payroll-run?resource=<collection>&fields=...&limit=...&page=...
 *
 * This relies on app/api/payroll-run/route.ts which forwards to Directus
 * using API_BASE / NEXT_PUBLIC_API_BASE on the server.
 */
async function apiGet<T>(resource: "department" | "user", params: Record<string, unknown> = {}): Promise<T> {
  const url = `/api/payroll-run${toQuery({ resource, ...params })}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    let details = "";
    try {
      details = await res.text();
    } catch {
      // ignore
    }
    throw new Error(
      `API proxy request failed (${res.status}) ${url}${details ? `: ${details}` : ""}`,
    );
  }

  return (await res.json()) as T;
}

/**
 * Fetch all items from a Directus collection using paging via the proxy.
 * Uses limit=1000 to reduce round-trips and stops when returned rows < limit.
 */
async function fetchAllItems<T>(
  resource: "department" | "user",
  fields: string,
  extraParams: Record<string, unknown> = {},
): Promise<T[]> {
  const limit = 1000;
  let page = 1;
  const out: T[] = [];

  while (true) {
    const json = await apiGet<DirectusListResponse<T>>(resource, {
      fields,
      limit,
      page,
      ...extraParams,
    });

    const rows = Array.isArray(json?.data) ? json.data : [];
    out.push(...rows);

    if (rows.length < limit) break;
    page += 1;

    // hard guard (prevents infinite loops on misconfigured APIs)
    if (page > 200) break;
  }

  return out;
}

export async function fetchDepartments(): Promise<DepartmentRow[]> {
  return fetchAllItems<DepartmentRow>("department", "department_id,department_name");
}

export async function fetchUsersForDeptJoin(): Promise<UserRow[]> {
  return fetchAllItems<UserRow>("user", "user_id,user_department");
}

/**
 * Returns lookups used to hydrate UI:
 * - deptNameByDeptId: { [department_id]: department_name }
 * - deptNameByUserId: { [user_id]: department_name }
 */
export async function getDepartmentLookups(): Promise<{
  deptNameByDeptId: Record<string, string>;
  deptNameByUserId: Record<string, string>;
}> {
  const [departments, users] = await Promise.all([fetchDepartments(), fetchUsersForDeptJoin()]);

  const deptNameByDeptId: Record<string, string> = {};
  for (const d of departments) {
    if (d?.department_id != null) {
      deptNameByDeptId[String(d.department_id)] = d.department_name ?? "";
    }
  }

  const deptNameByUserId: Record<string, string> = {};
  for (const u of users) {
    const deptId = u?.user_department;
    if (u?.user_id != null && deptId != null) {
      const deptName = deptNameByDeptId[String(deptId)];
      if (deptName) {
        deptNameByUserId[String(u.user_id)] = deptName;
      }
    }
  }

  return { deptNameByDeptId, deptNameByUserId };
}
