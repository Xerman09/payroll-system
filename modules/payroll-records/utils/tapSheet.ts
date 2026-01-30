// modules/payroll-records/utils/tapSheet.ts
import type { EmployeeMaster, PayrollRunEmployeeRow, TapSheetRow } from "../types";
import { toNumberSafe } from "./money";

/** Handles 1/0, true/false, "1"/"0", and Directus buffer-ish { data: [1] } */
function isTruthyFlag(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  if (typeof v === "object") {
    const anyV = v as any;
    const d0 = anyV?.data?.[0];
    if (d0 === 1 || d0 === "1" || d0 === true) return true;
    if (d0 === 0 || d0 === "0" || d0 === false || d0 == null) return false;
  }

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v.trim() === "1" || v.trim().toLowerCase() === "true";

  return false;
}

function isOnHoldRow(r: PayrollRunEmployeeRow): boolean {
  return isTruthyFlag((r as any)?.on_hold);
}

export function formatEmployeeNameLFM(emp: EmployeeMaster): string {
  const last = (emp.user_lname ?? "").trim();
  const first = (emp.user_fname ?? "").trim();
  const middle = (emp.user_mname ?? "").trim();
  return middle ? `${last}, ${first} ${middle}` : `${last}, ${first}`;
}

export function buildNameSortKey(emp: EmployeeMaster): string {
  const last = (emp.user_lname ?? "").trim().toLowerCase();
  const first = (emp.user_fname ?? "").trim().toLowerCase();
  const middle = (emp.user_mname ?? "").trim().toLowerCase();
  return `${last}|${first}|${middle}`;
}

/**
 * ✅ Keep the latest payroll_run_id per user_id
 * ✅ Then EXCLUDE users whose latest row is on-hold (on_hold=1)
 */
export function dedupeByUserKeepLatestRun(rows: PayrollRunEmployeeRow[]): PayrollRunEmployeeRow[] {
  const map = new Map<number, PayrollRunEmployeeRow>();

  for (const r of rows) {
    const prev = map.get(r.user_id);
    if (!prev) {
      map.set(r.user_id, r);
      continue;
    }
    if ((r.payroll_run_id ?? 0) >= (prev.payroll_run_id ?? 0)) {
      map.set(r.user_id, r);
    }
  }

  return Array.from(map.values()).filter((r) => !isOnHoldRow(r));
}

export function buildTapSheetRows(
  payrollRows: PayrollRunEmployeeRow[],
  employees: EmployeeMaster[],
): TapSheetRow[] {
  const empMap = new Map<number, EmployeeMaster>();
  for (const e of employees) empMap.set(e.user_id, e);

  const safeRows = payrollRows.filter((r) => !isOnHoldRow(r));

  return safeRows.map((pr) => {
    const emp = empMap.get(pr.user_id);

    const name_display = emp ? formatEmployeeNameLFM(emp) : (pr.employee_name ?? `User #${pr.user_id}`);

    const name_sort_key = emp
      ? buildNameSortKey(emp)
      : (pr.employee_name ?? `user #${pr.user_id}`).trim().toLowerCase();

    return {
      user_id: pr.user_id,
      name_display,
      name_sort_key,
      gross_pay: toNumberSafe(pr.gross_pay),
      total_additions: toNumberSafe(pr.total_additions),
      total_deductions: toNumberSafe(pr.total_deductions),
      net_pay: toNumberSafe(pr.net_pay),
    };
  });
}
