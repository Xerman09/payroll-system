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
  CoopSavingsMembershipRecord,
  CoopSavingsMembershipCreatePayload,
  CoopSavingsMembershipPatchPayload,
  BenefitLogRecord,
  BenefitLogCreatePayload,
  BenefitLogPatchPayload,
  SalarySchedule,
  SalarySchedulePayload,
} from "../types";

const BASE_API = "/api/wage";
const BATCH_SIZE = 100;

function extractDirectusErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;

  if (Array.isArray(j.errors) && j.errors.length > 0) {
    const e0 = j.errors[0] as Record<string, unknown> | null;
    return (e0?.message as string) || ((e0?.extensions as Record<string, unknown>)?.code as string) || "Directus error";
  }

  if (typeof j.error === "string") return j.error;

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
  const allUsers = await fetchAllInBatches<Employee>("/items/user?fields=user_id,user_fname,user_lname,user_department,is_deleted");
  return allUsers.filter((emp) => !emp.is_deleted || (emp.is_deleted as unknown as { data: number[] })?.data?.[0] === 0);
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
  type DirectusFilter = {
    _and: Array<Record<string, unknown>>;
  };
  const filterParams: DirectusFilter = {
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
    const orFilters: Record<string, unknown>[] = [
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
    fields: "user_id,user_fname,user_lname,user_department,is_deleted",
  };

  const query = new URLSearchParams(params).toString();
  const json = await apiFetch(`/items/user?${query}`);

  const data: Employee[] = json.data || [];
  const total: number = json?.meta?.filter_count ?? data.length;

  return { rows: data, total };
}

export async function fetchUserById(userId: number) {
  const json = await apiFetch(`/items/user/${userId}?fields=user_id,user_fname,user_lname,user_department,is_deleted`);
  return json.data;
}

export async function verifyPassword(userId: number, password: string) {
  const res = await fetch("/api/auth/verify-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message || "Password verification failed");
  }
  return json;
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
    console.error("logWageAccess failed - wageApi.ts:213", e);
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
// ----------------------------------------------------------------------
// COOP SAVINGS MEMBERSHIP (CRUD) - coop_savings_membership
// ----------------------------------------------------------------------

export async function fetchCoopSavingsMembershipByUser(
  userId: number
): Promise<CoopSavingsMembershipRecord[]> {
  const qs = new URLSearchParams({
    limit: "300",
    sort: "-start_date",
    [`filter[user_id][_eq]`]: String(userId),
  }).toString();

  const json = await apiFetch(`/items/coop_savings_membership?${qs}`);
  return (json?.data as CoopSavingsMembershipRecord[]) || [];
}

export async function createCoopSavingsMembership(
  payload: CoopSavingsMembershipCreatePayload
) {
  return apiFetch("/items/coop_savings_membership", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/coop_savings_membership",
      payload,
    }),
  });
}

export async function patchCoopSavingsMembership(
  id: number,
  payload: CoopSavingsMembershipPatchPayload
) {
  return apiFetch(`/items/coop_savings_membership/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/coop_savings_membership/${id}`,
      payload,
    }),
  });
}

export async function deleteCoopSavingsMembership(id: number) {
  return apiFetch(`/items/coop_savings_membership/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/coop_savings_membership/${id}`,
    }),
  });
}

// ----------------------------------------------------------------------
// BENEFIT LOGS (benefit_logs)
// ----------------------------------------------------------------------

export async function fetchBenefitLogsByUser(
  userId: number
): Promise<BenefitLogRecord[]> {
  const qs = new URLSearchParams({
    limit: "300",
    sort: "-created_date",
    [`filter[user_id][_eq]`]: String(userId),
  }).toString();

  // Assuming endpoint is /items/benefit_logs based on DDL
  const json = await apiFetch(`/items/benefit_logs?${qs}`);
  return (json?.data as BenefitLogRecord[]) || [];
}

export async function createBenefitLog(payload: BenefitLogCreatePayload) {
  return apiFetch("/items/benefit_logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/benefit_logs",
      payload,
    }),
  });
}

export async function patchBenefitLog(
  id: number,
  payload: BenefitLogPatchPayload
) {
  return apiFetch(`/items/benefit_logs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/benefit_logs/${id}`,
      payload,
    }),
  });
}

export async function deleteBenefitLog(id: number) {
  return apiFetch(`/items/benefit_logs/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/benefit_logs/${id}`,
    }),
  });
}

// ----------------------------------------------------------------------
// SALARY SCHEDULES (CRUD) - salary_schedules
// ----------------------------------------------------------------------

export async function fetchSalarySchedules(): Promise<SalarySchedule[]> {
  const json = await apiFetch("/items/salary_schedules?limit=-1&sort=-effectivity_date,salary_grade,step");
  return (json?.data as SalarySchedule[]) || [];
}

export async function createSalarySchedule(payload: SalarySchedulePayload) {
  return apiFetch("/items/salary_schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/items/salary_schedules",
      payload,
    }),
  });
}

export async function patchSalarySchedule(id: number, payload: Partial<SalarySchedulePayload>) {
  return apiFetch(`/items/salary_schedules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/salary_schedules/${id}`,
      payload,
    }),
  });
}

export async function deleteSalarySchedule(id: number) {
  return apiFetch(`/items/salary_schedules/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `/items/salary_schedules/${id}`,
    }),
  });
}
