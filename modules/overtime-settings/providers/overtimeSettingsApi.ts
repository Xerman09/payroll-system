import type { GeneralSettingRow, OvertimeRateFormState } from "../types";

const BASE_API = "/api/general-settings";

export async function fetchGeneralSettings(): Promise<GeneralSettingRow[]> {
  const res = await fetch(BASE_API, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || "Failed to fetch settings");
  }
  const json = await res.json();
  return json?.data || [];
}

export async function saveOvertimeSettings(
  values: OvertimeRateFormState
): Promise<void> {
  const items = Object.entries(values).map(([setting_key, setting_value]) => ({
    setting_key,
    setting_value: String(setting_value).trim(),
  }));

  const res = await fetch(BASE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || "Failed to save settings");
  }
}

