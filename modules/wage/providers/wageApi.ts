// @modules/wage/providers/wageApi.ts
import type {
  Department,
  Employee,
  WagePayload,
  WageRecord,
  WageProrationLogPayload,
  CutoffSetting,
  EmployeeLoanRecord,
  EmployeeLoanCreatePayload,
  EmployeeLoanPatchPayload,
  RetroPayRecord,
  RetroPayCreatePayload,
  RetroPayPatchPayload,
  PayrollOtherAdditionRecord,
  PayrollOtherDeductionRecord,
  PayrollOtherAdditionCreatePayload,
  PayrollOtherAdditionPatchPayload,
  PayrollOtherDeductionCreatePayload,
  PayrollOtherDeductionPatchPayload,
  EmployeeAllowanceRecord,
  EmployeeAllowanceCreatePayload,
  EmployeeAllowancePatchPayload,
  BenefitLoanRecord,
  BenefitLoanCreatePayload,
  BenefitLoanPatchPayload,
  DRPaymentRecord,
  DRPaymentCreatePayload,
  DRPaymentPatchPayload,

} from "../types";

const BASE_API = "/api/wage";
const BATCH_SIZE = 100;

function extractDirectusErrorMessage(json: any): string | null {
  if (!json) return null;

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const e0 = json.errors[0];
    return e0?.message || e0?.extensions?.code || "Directus error";
  }

  if (typeof json.error === "string") return json.error;

  return null;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_API}?path=${encodeURIComponent(path)}`, {
    cache: "no-store",
    ...options,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = extractDirectusErrorMessage(json) || `HTTP ${res.status} ${path}`;
    throw new Error(msg);
  }

  const directusMsg = extractDirectusErrorMessage(json);
  if (directusMsg) throw new Error(directusMsg);

  return json;
}

async function fetchAllInBatches<T>(endpoint: string): Promise<T[]> {
  let allItems: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const delimiter = endpoint.includes("?") ? "&" : "?";
    const url = `${endpoint}${delimiter}limit=${BATCH_SIZE}&page=${page}`;

    const json = await apiFetch(url);
    const rows = json.data || [];

    allItems = [...allItems, ...rows];

    if (rows.length < BATCH_SIZE) hasMore = false;
    else page++;
  }

  return allItems;
}

// ----------------------------------------------------------------------
// PUBLIC METHODS
// ----------------------------------------------------------------------

export async function fetchDepartments(): Promise<Department[]> {
  return fetchAllInBatches<Department>("/items/department");
}

export async function fetchEmployees(): Promise<Employee[]> {
  const allUsers = await fetchAllInBatches<Employee>("/items/user");
  return allUsers.filter((emp) => !emp.is_deleted || emp.is_deleted.data?.[0] === 0);
}

export type EmployeeListParams = {
  page: number;
  pageSize: number;
  search?: string;
  deptId?: number | null;
  sortField?: keyof Employee;
  sortOrder?: "asc" | "desc";
};

export async function fetchEmployeesPaged({
  page,
  pageSize,
  search,
  deptId,
  sortField = "user_id",
  sortOrder = "asc",
}: EmployeeListParams): Promise<{ rows: Employee[]; total: number }> {
  const filterParams: any = {
    _and: [
      {
        _or: [{ is_deleted: { _null: true } }, { is_deleted: { _eq: 0 } }],
      },
    ],
  };

  const q = (search ?? "").trim();

  // ✅ Only treat q as user_id when it is purely numeric
  const isNumericId = q.length > 0 && /^[0-9]+$/.test(q);
  const numericId = isNumericId ? Number(q) : null;

  if (q) {
    const orFilters: any[] = [
      { user_fname: { _icontains: q } },
      { user_lname: { _icontains: q } },
    ];

    if (numericId !== null && Number.isFinite(numericId)) {
      orFilters.push({ user_id: { _eq: numericId } });
    }

    filterParams._and.push({ _or: orFilters });
  }

  if (typeof deptId === "number" && Number.isFinite(deptId)) {
    filterParams._and.push({ user_department: { _eq: deptId } });
  }

  const params: Record<string, string> = {
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
    sort: sortOrder === "desc" ? `-${String(sortField)}` : String(sortField),
    meta: "filter_count",
    filter: JSON.stringify(filterParams),
  };

  const query = new URLSearchParams(params).toString();
  const json = await apiFetch(`/items/user?${query}`);

  const data: Employee[] = json.data || [];
  const total: number = json?.meta?.filter_count ?? data.length;

  return { rows: data, total };
}

export async function fetchUserById(userId: number) {
  const json = await apiFetch(`/items/user/${userId}`);
  return json.data;
}

export async function fetchWageByUser(userId: number): Promise<WageRecord | null> {
  const json = await apiFetch(`/items/user_wage_management?filter[user_id][_eq]=${userId}`);
  return (json.data && json.data[0]) || null;
}

export async function createWage(payload: WagePayload) {
  return apiFetch("/items/user_wage_management", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/user_wage_management",
      payload,
    }),
  });
}

export async function patchWage(id: number, payload: WagePayload) {
  return apiFetch(`/items/user_wage_management/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/user_wage_management/${id}`,
      payload,
    }),
  });
}

export async function logWageAccess(openedById: number, userId: number, remarks: string) {
  try {
    return apiFetch("/items/user_wage_access_log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/items/user_wage_access_log",
        payload: { user_id: userId, opened_by: openedById, remarks },
      }),
    });
  } catch (e) {
    console.error("logWageAccess failed - wageApi.ts:206", e);
  }
}

// ----------------------------------------------------------------------
// CUTOFF SETTINGS
// ----------------------------------------------------------------------

export async function findCutoffSettingByDate(dateYmd: string): Promise<CutoffSetting | null> {
  const qs = new URLSearchParams({
    limit: "1",
    sort: "-start_date",
    [`filter[start_date][_lte]`]: dateYmd,
    [`filter[end_date][_gte]`]: dateYmd,
  }).toString();

  const json = await apiFetch(`/items/cutoff_settings?${qs}`);
  return (json?.data?.[0] as CutoffSetting) || null;
}

export async function fetchCutoffSettingsOpen(): Promise<CutoffSetting[]> {
  const qs = new URLSearchParams({
    limit: "200",
    sort: "-start_date",
    [`filter[period_status][_eq]`]: "OPEN",
  }).toString();

  const json = await apiFetch(`/items/cutoff_settings?${qs}`);
  return (json?.data as CutoffSetting[]) || [];
}

// ----------------------------------------------------------------------
// PRORATION LOG
// ----------------------------------------------------------------------

export async function createWageProrationLog(payload: WageProrationLogPayload) {
  return apiFetch("/items/user_wage_proration_log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/user_wage_proration_log",
      payload,
    }),
  });
}

// ----------------------------------------------------------------------
// EMPLOYEE LOANS (CRUD)
// ----------------------------------------------------------------------

export async function fetchEmployeeLoansByUser(userId: number): Promise<EmployeeLoanRecord[]> {
  const qs = new URLSearchParams({
    limit: "200",
    sort: "-start_date",
    [`filter[user_id][_eq]`]: String(userId),
  }).toString();

  const json = await apiFetch(`/items/employee_loan?${qs}`);
  return (json?.data as EmployeeLoanRecord[]) || [];
}

export async function createEmployeeLoan(payload: EmployeeLoanCreatePayload) {
  return apiFetch("/items/employee_loan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/employee_loan",
      payload,
    }),
  });
}

export async function patchEmployeeLoan(loanId: number, payload: EmployeeLoanPatchPayload) {
  return apiFetch(`/items/employee_loan/${loanId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/employee_loan/${loanId}`,
      payload,
    }),
  });
}

export async function deleteEmployeeLoan(loanId: number) {
  return apiFetch(`/items/employee_loan/${loanId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/employee_loan/${loanId}`,
    }),
  });
}

// ----------------------------------------------------------------------
// RETRO PAY (CRUD)
// ----------------------------------------------------------------------

export async function fetchRetroPayByUser(userId: number): Promise<RetroPayRecord[]> {
  const qs = new URLSearchParams({
    limit: "200",
    sort: "-created_date",
    [`filter[user_id][_eq]`]: String(userId),
  }).toString();

  const json = await apiFetch(`/items/retro_pay?${qs}`);
  return (json?.data as RetroPayRecord[]) || [];
}

export async function createRetroPay(payload: RetroPayCreatePayload) {
  return apiFetch("/items/retro_pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/retro_pay",
      payload,
    }),
  });
}

export async function patchRetroPay(retroId: number, payload: RetroPayPatchPayload) {
  return apiFetch(`/items/retro_pay/${retroId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/retro_pay/${retroId}`,
      payload,
    }),
  });
}

export async function deleteRetroPay(retroId: number) {
  return apiFetch(`/items/retro_pay/${retroId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/retro_pay/${retroId}`,
    }),
  });
}

// ----------------------------------------------------------------------
// PAYROLL OTHER ADDITIONS (CRUD)
// ----------------------------------------------------------------------

export async function fetchPayrollOtherAdditionsByUser(
  userId: number
): Promise<PayrollOtherAdditionRecord[]> {
  const qs = new URLSearchParams({
    limit: "200",
    sort: "-created_date",
    [`filter[user_id][_eq]`]: String(userId),
  }).toString();

  const json = await apiFetch(`/items/payroll_other_additions?${qs}`);
  return (json?.data as PayrollOtherAdditionRecord[]) || [];
}

export async function createPayrollOtherAddition(payload: PayrollOtherAdditionCreatePayload) {
  return apiFetch("/items/payroll_other_additions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/payroll_other_additions",
      payload,
    }),
  });
}

export async function patchPayrollOtherAddition(
  id: number,
  payload: PayrollOtherAdditionPatchPayload
) {
  return apiFetch(`/items/payroll_other_additions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/payroll_other_additions/${id}`,
      payload,
    }),
  });
}

export async function deletePayrollOtherAddition(id: number) {
  return apiFetch(`/items/payroll_other_additions/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/payroll_other_additions/${id}`,
    }),
  });
}

// ----------------------------------------------------------------------
// PAYROLL OTHER DEDUCTIONS (CRUD)
// ----------------------------------------------------------------------

export async function fetchPayrollOtherDeductionsByUser(
  userId: number
): Promise<PayrollOtherDeductionRecord[]> {
  const qs = new URLSearchParams({
    limit: "200",
    sort: "-created_date",
    [`filter[user_id][_eq]`]: String(userId),
  }).toString();

  const json = await apiFetch(`/items/payroll_other_deductions?${qs}`);
  return (json?.data as PayrollOtherDeductionRecord[]) || [];
}

export async function createPayrollOtherDeduction(payload: PayrollOtherDeductionCreatePayload) {
  return apiFetch("/items/payroll_other_deductions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/payroll_other_deductions",
      payload,
    }),
  });
}

export async function patchPayrollOtherDeduction(
  id: number,
  payload: PayrollOtherDeductionPatchPayload
) {
  return apiFetch(`/items/payroll_other_deductions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/payroll_other_deductions/${id}`,
      payload,
    }),
  });
}

export async function deletePayrollOtherDeduction(id: number) {
  return apiFetch(`/items/payroll_other_deductions/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/payroll_other_deductions/${id}`,
    }),
  });
}

// ----------------------------------------------------------------------
// EMPLOYEE ALLOWANCE (CRUD) - employee_allowance
// ----------------------------------------------------------------------

export async function fetchEmployeeAllowancesByUser(
  userId: number
): Promise<EmployeeAllowanceRecord[]> {
  const qs = new URLSearchParams({
    limit: "300",
    sort: "-created_date",
    [`filter[user_id][_eq]`]: String(userId),
  }).toString();

  const json = await apiFetch(`/items/employee_allowance?${qs}`);
  return (json?.data as EmployeeAllowanceRecord[]) || [];
}

export async function createEmployeeAllowance(payload: EmployeeAllowanceCreatePayload) {
  return apiFetch("/items/employee_allowance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/employee_allowance",
      payload,
    }),
  });
}

export async function patchEmployeeAllowance(
  allowanceId: number,
  payload: EmployeeAllowancePatchPayload
) {
  return apiFetch(`/items/employee_allowance/${allowanceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/employee_allowance/${allowanceId}`,
      payload,
    }),
  });
}

export async function deleteEmployeeAllowance(allowanceId: number) {
  return apiFetch(`/items/employee_allowance/${allowanceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/employee_allowance/${allowanceId}`,
    }),
  });
}

// ----------------------------------------------------------------------
// BENEFIT LOANS (CRUD) - benefit_loans
// ----------------------------------------------------------------------

export async function fetchBenefitLoansByUser(userId: number): Promise<BenefitLoanRecord[]> {
  const qs = new URLSearchParams({
    limit: "300",
    sort: "-created_date",
    [`filter[user_id][_eq]`]: String(userId),
  }).toString();

  const json = await apiFetch(`/items/benefit_loans?${qs}`);
  return (json?.data as BenefitLoanRecord[]) || [];
}

export async function createBenefitLoan(payload: BenefitLoanCreatePayload) {
  return apiFetch("/items/benefit_loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/benefit_loans",
      payload,
    }),
  });
}

export async function patchBenefitLoan(loanId: number, payload: BenefitLoanPatchPayload) {
  return apiFetch(`/items/benefit_loans/${loanId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/benefit_loans/${loanId}`,
      payload,
    }),
  });
}

export async function deleteBenefitLoan(loanId: number) {
  return apiFetch(`/items/benefit_loans/${loanId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/benefit_loans/${loanId}`,
    }),
  });
}
// ----------------------------------------------------------------------
// DR PAYMENT (CRUD) - dr_payment
// ----------------------------------------------------------------------

export async function fetchDRPaymentsByEmployee(
  employeeId: number
): Promise<DRPaymentRecord[]> {
  const qs = new URLSearchParams({
    limit: "300",
    sort: "-payment_date",
    ["filter[employee_id][_eq]"]: String(employeeId),
  }).toString();

  const json = await apiFetch(`/items/dr_payment?${qs}`);
  return (json?.data as DRPaymentRecord[]) || [];
}

export async function createDRPayment(payload: DRPaymentCreatePayload) {
  return apiFetch("/items/dr_payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/dr_payment",
      payload,
    }),
  });
}

export async function patchDRPayment(
  drPaymentId: number,
  payload: DRPaymentPatchPayload
) {
  return apiFetch(`/items/dr_payment/${drPaymentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/dr_payment/${drPaymentId}`,
      payload,
    }),
  });
}

export async function deleteDRPayment(drPaymentId: number) {
  return apiFetch(`/items/dr_payment/${drPaymentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/dr_payment/${drPaymentId}`,
    }),
  });
}
