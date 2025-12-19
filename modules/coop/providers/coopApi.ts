const INTERNAL_API_BASE = "/api/coop";

/**
 * Generic fetcher that appends the collection param.
 */
async function fetchProxy(collection: string, params: string = "") {
  const url = `${INTERNAL_API_BASE}?collection=${collection}&${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Generic poster/patcher
 */
async function sendProxy(
  method: "POST" | "PATCH" | "DELETE",
  collection: string,
  data?: any,
  id?: number
) {
  let url = `${INTERNAL_API_BASE}?collection=${collection}`;
  if (id) url += `&id=${id}`;

  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (data) options.body = JSON.stringify(data);

  const res = await fetch(url, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const coopApi = {
  // --- GET ---
  getLoans: (limit: number, offset: number) =>
    fetchProxy("employee_loan", `limit=${limit}&offset=${offset}&meta=filter_count`),

  getSavings: (limit: number, offset: number) =>
    fetchProxy("coop_savings_membership", `limit=${limit}&offset=${offset}&meta=filter_count`),

  getUsers: (ids: number[]) =>
    fetchProxy("user", `limit=${ids.length}&filter[user_id][_in]=${ids.join(",")}`),

  getPayments: (loanIds: number[]) =>
    fetchProxy("employee_loan_payment", `limit=-1&filter[loan_id][_in]=${loanIds.join(",")}`),

  // --- MUTATE LOANS ---
  createLoan: (data: any) => sendProxy("POST", "employee_loan", data),
  updateLoan: (id: number, data: any) => sendProxy("PATCH", "employee_loan", data, id),
  deleteLoan: (id: number) => sendProxy("DELETE", "employee_loan", undefined, id),

  // --- MUTATE SAVINGS ---
  createSavingsMember: (data: any) => sendProxy("POST", "coop_savings_membership", data),
  updateSavingsMember: (id: number, data: any) => sendProxy("PATCH", "coop_savings_membership", data, id),
  deleteSavingsMember: (id: number) => sendProxy("DELETE", "coop_savings_membership", undefined, id),
};