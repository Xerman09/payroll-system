import { RetroFormState } from "../types";

const API_ENDPOINT = "/api/retro";

export const retroApi = {
  fetchAll: async () => {
    const res = await fetch(API_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
  },

  create: async (data: RetroFormState, createdBy: number) => {
    const payload = {
      user_id: parseInt(data.user_id, 10),
      amount: parseFloat(data.amount).toFixed(2),
      description: data.description || null,
      cutoff_start: data.cutoff_start,
      cutoff_end: data.cutoff_end,
      created_by: createdBy,
    };

    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  update: async (id: number, data: RetroFormState, updatedBy: number) => {
    const payload = {
      user_id: parseInt(data.user_id, 10),
      amount: parseFloat(data.amount).toFixed(2),
      description: data.description || null,
      cutoff_start: data.cutoff_start,
      cutoff_end: data.cutoff_end,
      updated_by: updatedBy,
    };

    const res = await fetch(`${API_ENDPOINT}?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_ENDPOINT}?id=${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};
