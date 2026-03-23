// modules/payroll-run/providers/payslipPrintProvider.ts
export async function fetchPayrollRunEmployeesForPrint(payrollRunId: number) {
  const url =
    `/api/payroll-run?resource=payroll_run_employee` +
    `&filter[payroll_run_id][_eq]=${encodeURIComponent(String(payrollRunId))}` +
    `&limit=5000` +
    `&sort=employee_name`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = json?.error || json?.details || "Failed to load payroll_run_employee for print";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  return { rows, companyName: json?.meta?.companyName };
}

export function rowsHaveBreakdown(rows: unknown[]): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.some((r) => {
    const obj = r as Record<string, unknown>;
    return obj?.breakdown_json != null || obj?.breakdownJson != null;
  });
}
