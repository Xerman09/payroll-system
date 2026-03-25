// modules/cutoff-settings/providers/cutoffSettingsApi.ts
import { getLoggedUser } from "@/lib/auth";
import type {
  CutoffSettingRow,
  CutoffType,
  DefaultCutoffDates,
  PeriodKey,
} from "../types";

/** Pads 1..9 => "01" */
export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Builds YYYY-MM-DD */
export function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Current payroll period (based on your cutoffs):
 * - If today is 1..25 => payroll month is current calendar month
 * - If today is 26..31 => payroll month is next calendar month
 */
export function computeCurrentPayrollPeriod(date: Date): PeriodKey {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1..12
  const d = date.getDate();

  if (d >= 26) {
    if (m === 12) return { month: 1, year: y + 1 };
    return { month: m + 1, year: y };
  }

  return { month: m, year: y };
}

export function prevMonth(period: PeriodKey): PeriodKey {
  if (period.month === 1) return { month: 12, year: period.year - 1 };
  return { month: period.month - 1, year: period.year };
}

/**
 * Default payroll cutoffs for a given payroll month/year:
 * FIRST:  previous month 26 -> current payroll month 10
 * SECOND: current payroll month 11 -> 25
 */
export function computeDefaultCutoffsForPeriod(
  period: PeriodKey
): DefaultCutoffDates {
  const pm = prevMonth(period);

  return {
    FIRST: {
      start_date: ymd(pm.year, pm.month, 26),
      end_date: ymd(period.year, period.month, 10),
    },
    SECOND: {
      start_date: ymd(period.year, period.month, 11),
      end_date: ymd(period.year, period.month, 25),
    },
  };
}

/* =========================================================
   Session helpers (sessionStorage-based)
========================================================= */

export type SessionUser = Record<string, unknown>;

/** Reads the current user object from the signed JWT. */
export function getSessionUser(): SessionUser | null {
  return getLoggedUser() as SessionUser | null;
}

/**
 * Extracts a stable user identifier from sessionStorage user.
 * Supports common variants (id/user_id/etc).
 */
export function getSessionUserId(): string | null {
  const user = getSessionUser();
  if (!user) return null;

  const candidates = [
    user.id,
    user.user_id,
    user.userId,
    user.employee_id,
    user.employeeId,
  ].filter((v) => v !== undefined && v !== null);

  if (!candidates.length) return null;

  return String(candidates[0]);
}

/* =========================================================
   Users lookup (for displaying Updated By name)
========================================================= */

export type UserRow = {
  id?: number; // Directus item id (often exists)
  user_id?: number; // your business employee id
  user_fname?: string;
  user_mname?: string | null;
  user_lname?: string;
  user_email?: string;
};



export function formatUserFullName(u: UserRow): string {
  const parts = [
    (u.user_fname || "").trim(),
    (u.user_mname || "").trim(),
    (u.user_lname || "").trim(),
  ].filter(Boolean);

  const full = parts.join(" ").replace(/\s+/g, " ").trim();
  if (full) return full;

  // fallback
  if (u.user_email) return u.user_email;
  if (u.user_id != null) return `User ${u.user_id}`;
  if (u.id != null) return `User ${u.id}`;
  return "Unknown";
}

/**
 * Creates a map that can resolve names by BOTH:
 * - user.id (Directus item id)
 * - user.user_id (employee id)
 *
 * This covers cases where cutoff_settings.updated_by stores "24"
 * while user record might expose either `id=24` or `user_id=24`.
 */
export function makeUserNameMap(users: UserRow[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const u of users || []) {
    const name = formatUserFullName(u);

    if (u.id != null) map.set(String(u.id), name);
    if (u.user_id != null) map.set(String(u.user_id), name);
  }

  return map;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listUsers(_ids?: Array<string | number>): Promise<UserRow[]> {
  const qs = new URLSearchParams();
  qs.set("resource", "users");

  const res = await fetch(`/api/cutoff-settings?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || "Failed to load users.");
  }

  const json = await res.json();
  const data = (json?.data ?? []) as UserRow[];

  // Note: filtering is now done server-side if ids provided

  return data;
}


/** Resolve name from map; fallback to showing the id if not found. */
export function getUserDisplayName(
  userNameMap: Map<string, string>,
  id: string | number | null | undefined
): string {
  if (id === null || id === undefined || id === "") return "—";
  const key = String(id);
  return userNameMap.get(key) ?? key; // fallback is the original id
}

/* =========================================================
   Cutoff settings API helpers (Next API proxy)
========================================================= */

function buildListUrl(period: PeriodKey) {
  const qs = new URLSearchParams();
  qs.set("month", String(period.month));
  qs.set("year", String(period.year));
  return `/api/cutoff-settings?${qs.toString()}`;
}

async function safeJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function listCutoffSettings(
  period: PeriodKey
): Promise<CutoffSettingRow[]> {
  const res = await fetch(buildListUrl(period), { cache: "no-store" });
  if (!res.ok) {
    const err = await safeJson(res).catch(() => null);
    throw new Error(err?.error || "Failed to load cutoff settings.");
  }

  const json = await safeJson(res);
  return (json?.data ?? []) as CutoffSettingRow[];
}

export async function listAllCutoffSettings(): Promise<CutoffSettingRow[]> {
  const res = await fetch(`/api/cutoff-settings`, { cache: "no-store" });
  if (!res.ok) {
    const err = await safeJson(res).catch(() => null);
    throw new Error(err?.error || "Failed to load cutoff settings.");
  }

  const json = await safeJson(res);
  return (json?.data ?? []) as CutoffSettingRow[];
}

export async function upsertCutoffSettings(
  rows: CutoffSettingRow[] | CutoffSettingRow
): Promise<void> {
  const res = await fetch(`/api/cutoff-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const err = await safeJson(res).catch(() => null);
    throw new Error(err?.error || "Failed to save cutoff settings.");
  }
}

/** Only send fields you want to update. */
export function toEditablePayload(row: CutoffSettingRow): CutoffSettingRow {
  return {
    id: row.id,
    month: row.month,
    year: row.year,
    cutoff_type: row.cutoff_type,
    start_date: row.start_date,
    end_date: row.end_date,
    payout_date: row.payout_date ?? null,
    period_status: row.period_status,
    status: row.status ?? "published",
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
  };
}

function pickBestReusableRow(
  all: CutoffSettingRow[],
  type: CutoffType,
  excludeIds: Set<number>
) {
  const candidates = all
    .filter((r) => r.cutoff_type === type)
    .filter((r) => (r.id ? !excludeIds.has(r.id) : true))
    .slice();

  candidates.sort((a, b) => {
    const ad = a.date_updated ? new Date(a.date_updated).getTime() : 0;
    const bd = b.date_updated ? new Date(b.date_updated).getTime() : 0;
    if (bd !== ad) return bd - ad;

    const ai = a.id ?? 0;
    const bi = b.id ?? 0;
    return bi - ai;
  });

  return candidates[0] ?? null;
}

function selectCurrentRowByType(
  current: CutoffSettingRow[],
  type: CutoffType
): CutoffSettingRow | null {
  const matches = current.filter((r) => r.cutoff_type === type);
  if (!matches.length) return null;

  matches.sort((a, b) => {
    const ad = a.date_updated ? new Date(a.date_updated).getTime() : 0;
    const bd = b.date_updated ? new Date(b.date_updated).getTime() : 0;
    if (bd !== ad) return bd - ad;

    const ai = a.id ?? 0;
    const bi = b.id ?? 0;
    return bi - ai;
  });

  return matches[0];
}

async function bestEffortArchiveExtras(keepIds: Set<number>) {
  try {
    const all = await listAllCutoffSettings();
    const extras = all
      .filter((r) => r.id && !keepIds.has(r.id))
      .map((r) => ({ id: r.id, status: "archived" }));

    if (!extras.length) return;
    await upsertCutoffSettings(extras as CutoffSettingRow[]);
  } catch {
    // ignore
  }
}

/**
 * Ensures EXACTLY TWO rows for current period.
 * If rows exist in current period, DO NOT overwrite their dates.
 */
export async function ensureTwoRowsForCurrentPayrollPeriod(
  period: PeriodKey
): Promise<CutoffSettingRow[]> {
  const defaults = computeDefaultCutoffsForPeriod(period);

  const current = await listCutoffSettings(period);
  const currentFirst = selectCurrentRowByType(current, "FIRST");
  const currentSecond = selectCurrentRowByType(current, "SECOND");

  const updatesOrCreates: CutoffSettingRow[] = [];
  const keepIds = new Set<number>();

  if (currentFirst?.id) keepIds.add(currentFirst.id);
  if (currentSecond?.id) keepIds.add(currentSecond.id);

  const needsAll = !currentFirst || !currentSecond;
  const all = needsAll ? await listAllCutoffSettings() : [];

  if (!currentFirst) {
    const reusable = pickBestReusableRow(all, "FIRST", keepIds);
    if (reusable?.id) {
      keepIds.add(reusable.id);
      updatesOrCreates.push(
        toEditablePayload({
          ...reusable,
          month: period.month,
          year: period.year,
          start_date: defaults.FIRST.start_date,
          end_date: defaults.FIRST.end_date,
          status: "published",
        })
      );
    } else {
      updatesOrCreates.push(
        toEditablePayload({
          month: period.month,
          year: period.year,
          cutoff_type: "FIRST",
          start_date: defaults.FIRST.start_date,
          end_date: defaults.FIRST.end_date,
          payout_date: null,
          period_status: "OPEN",
          created_by: null,
          updated_by: null,
          status: "published",
        } as CutoffSettingRow)
      );
    }
  }

  if (!currentSecond) {
    const reusable = pickBestReusableRow(all, "SECOND", keepIds);
    if (reusable?.id) {
      keepIds.add(reusable.id);
      updatesOrCreates.push(
        toEditablePayload({
          ...reusable,
          month: period.month,
          year: period.year,
          start_date: defaults.SECOND.start_date,
          end_date: defaults.SECOND.end_date,
          status: "published",
        })
      );
    } else {
      updatesOrCreates.push(
        toEditablePayload({
          month: period.month,
          year: period.year,
          cutoff_type: "SECOND",
          start_date: defaults.SECOND.start_date,
          end_date: defaults.SECOND.end_date,
          payout_date: null,
          period_status: "OPEN",
          created_by: null,
          updated_by: null,
          status: "published",
        } as CutoffSettingRow)
      );
    }
  }

  if (updatesOrCreates.length) {
    await upsertCutoffSettings(updatesOrCreates);
  }

  const refreshed = await listCutoffSettings(period);
  const first = selectCurrentRowByType(refreshed, "FIRST");
  const second = selectCurrentRowByType(refreshed, "SECOND");

  const finalKeepIds = new Set<number>();
  if (first?.id) finalKeepIds.add(first.id);
  if (second?.id) finalKeepIds.add(second.id);

  await bestEffortArchiveExtras(finalKeepIds);

  return [first, second].filter(Boolean) as CutoffSettingRow[];
}

export function periodLabel(period: PeriodKey) {
  return `${pad2(period.month)}/${period.year}`;
}
