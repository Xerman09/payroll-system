import { NextRequest, NextResponse } from "next/server";
import type { User, Allowance } from "@/modules/allowance/types";

const API_BASE = process.env.API_BASE || "";

/* ============================
   Server-side user cache
   ============================ */
let cachedUsers: User[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function fetchUsers(): Promise<User[]> {
  const now = Date.now();
  if (cachedUsers && now - cacheTimestamp < CACHE_TTL) return cachedUsers;

  const res = await fetch(`${API_BASE}/items/user?limit=-1`);
  if (!res.ok) throw new Error(`Failed fetching users: ${res.statusText}`);
  const json = await res.json();
  cachedUsers = json?.data ?? [];
  cacheTimestamp = now;
  return cachedUsers;
}

/* ============================
   GET Handler
   ============================ */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    // --- GET /api/allowance/users?search=... ---
    if (path === "users") {
      const search = url.searchParams.get("search") ?? "";
      const users = await fetchUsers();

      const filtered = search
        ? users.filter((u) => {
          const fullName = `${u.user_fname} ${u.user_mname ?? ""} ${u.user_lname}`;
          return fullName.toLowerCase().includes(search.toLowerCase());
        })
        : users;

      return NextResponse.json(filtered);
    }

    // --- GET /api/allowance ---
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
    const searchDescription = url.searchParams.get("searchDescription") ?? "";
    const processed = url.searchParams.get("processed") ?? "all";

    const baseParams: Record<string, string | number> = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: "-created_date",
      meta: "filter_count",
    };

    if (processed === "processed") baseParams["filter[is_processed][_eq]"] = 1;
    if (processed === "unprocessed") baseParams["filter[is_processed][_eq]"] = 0;
    if (searchDescription)
      baseParams["filter[description][_contains]"] = searchDescription.trim();

    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(baseParams).map(([k, v]) => [k, String(v)])
      )
    ).toString();

    const res = await fetch(`${API_BASE}/items/employee_allowance?${qs}`);
    if (!res.ok) throw new Error(`Failed fetching allowances: ${res.statusText}`);
    const json = await res.json();

    const rows: Allowance[] = json?.data ?? [];
    const total: number = json?.meta?.filter_count ?? json?.meta?.total ?? rows.length;

    // Populate user_full_name using cached users
    const users = await fetchUsers();
    const rowsWithUser = rows.map((r) => {
      const user = users.find((u) => u.user_id === r.user_id);
      return {
        ...r,
        user_full_name: user
          ? `${user.user_fname} ${user.user_mname ?? ""} ${user.user_lname}`.trim()
          : r.user_full_name,
      };
    });

    return NextResponse.json({ rows: rowsWithUser, total });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/* ============================
   POST Handler
   ============================ */
export async function POST(req: NextRequest) {
  try {
    const payload: Partial<Allowance> = await req.json();
    const res = await fetch(`${API_BASE}/items/employee_allowance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/* ============================
   PATCH Handler
   ============================ */
export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new Error("Missing allowance ID");

    const payload: Partial<Allowance> = await req.json();
    const res = await fetch(`${API_BASE}/items/employee_allowance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/* ============================
   DELETE Handler
   ============================ */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new Error("Missing allowance ID");

    const res = await fetch(`${API_BASE}/items/employee_allowance/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
