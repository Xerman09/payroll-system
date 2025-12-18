// modules/benefit-settings/providers/benefitApi.ts
import type { BenefitSetting } from "../types";

const BASE_API = "/api/benefit";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_API}?path=${encodeURIComponent(path)}`, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.json();
}

export async function fetchBenefitSettings(): Promise<BenefitSetting[]> {
  const json = await apiFetch("/items/benefit_cutoff_settings");
  return json.data || [];
}

export async function fetchUsers(): Promise<{ user_id: number; user_fname: string; user_lname: string }[]> {
  const json = await apiFetch("/items/user");
  return json.data || [];
}

export async function saveBenefitSetting(setting: BenefitSetting) {
  const payload = {
    benefit_code: setting.benefit_code,
    benefit_name: setting.benefit_name,
    cutoff: setting.cutoff,
    is_active: 1,
    effective_from: setting.effective_from,
    effective_to: setting.effective_to,
    updated_by: 176,
  };

  const method = setting.id ? "PATCH" : "POST";
  const path = setting.id ? `/items/benefit_cutoff_settings/${setting.id}` : "/items/benefit_cutoff_settings";

  return apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, payload }),
  });
}
