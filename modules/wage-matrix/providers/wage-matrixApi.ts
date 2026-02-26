import { WageMatrixData, SalaryMatrix } from "../types";

const BASE_API = "/api/wage-matrix";

export async function fetchWageMatrixData(): Promise<WageMatrixData> {
  const res = await fetch(BASE_API);
  if (!res.ok) throw new Error("Failed to fetch wage matrix data");
  return res.json();
}

export async function upsertWageMatrix(payload: SalaryMatrix[]) {
  // If items have IDs, use PATCH for bulk update, otherwise use POST for bulk create
  // Actually, we can split them or if the backend supports mixed, use that.
  // For safety, let's assume we might need to separate them or handle upsert on backend.
  // My backend POST just forwards to Directus which handles arrays.

  const res = await fetch(BASE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to save wage matrix");
  }

  return res.json();
}

export async function patchWageMatrixBulk(payload: SalaryMatrix[]) {
  const res = await fetch(BASE_API, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update wage matrix");
  }

  return res.json();
}
