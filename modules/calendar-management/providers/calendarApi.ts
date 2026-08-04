// modules/calendar-management/providers/calendarApi.ts
import type { Holiday, CalendarUser } from "../types";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const qs = new URLSearchParams();
  qs.set("resource", "holidays");

  const res = await fetch(`/api/calendar-management?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || "Failed to load holidays.");
  }

  const json = await safeJson(res);
  return (json?.data ?? []) as Holiday[];
}

export async function fetchUsers(): Promise<CalendarUser[]> {
  const qs = new URLSearchParams();
  qs.set("resource", "users");

  const res = await fetch(`/api/calendar-management?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || "Failed to load users.");
  }

  const json = await safeJson(res);
  return (json?.data ?? []) as CalendarUser[];
}

export async function createHoliday(data: Partial<Holiday>): Promise<Holiday> {
  const res = await fetch(`/api/calendar-management`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resource: "holidays",
      data,
    }),
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || "Failed to create holiday.");
  }

  const json = await safeJson(res);
  return json?.data;
}

export async function createHolidayToAll(data: Partial<Holiday>): Promise<any> {
  const res = await fetch("/api/wage/apply-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/holiday_calendar",
      payload: data,
    }),
  });

  const json = await res.json().catch(() => null);
  
  if (process.env.NODE_ENV !== "production") {
    console.log("[calendarApi.ts] createHolidayToAll response:", res.status, json);
  }

  if (!res.ok && res.status !== 207) {
    throw new Error(json?.message || "Failed to apply to all companies");
  }

  return json;
}

export async function updateHoliday(id: number, data: Partial<Holiday>): Promise<Holiday> {
  const res = await fetch(`/api/calendar-management`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resource: "holidays",
      id,
      data,
    }),
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || "Failed to update holiday.");
  }

  const json = await safeJson(res);
  return json?.data;
}

export async function deleteHoliday(id: number): Promise<void> {
  const qs = new URLSearchParams();
  qs.set("resource", "holidays");
  qs.set("id", String(id));

  const res = await fetch(`/api/calendar-management?${qs.toString()}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || "Failed to delete holiday.");
  }
}

export async function deleteHolidayToAll(holidayDate: string, holidayType: string): Promise<any> {
  const res = await fetch("/api/wage/delete-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/holiday_calendar",
      query: {
        holiday_date: holidayDate,
        holiday_type: holidayType
      }
    }),
  });

  const json = await res.json().catch(() => null);
  
  if (process.env.NODE_ENV !== "production") {
    console.log("[calendarApi.ts] deleteHolidayToAll response:", res.status, json);
  }

  if (!res.ok && res.status !== 207) {
    throw new Error(json?.message || "Failed to delete from all companies");
  }

  return json;
}
