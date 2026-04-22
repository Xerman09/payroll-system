// modules/payroll-records/utils/tapSheet.ts
import type { EmployeeMaster, PayrollRunEmployeeRow, TapSheetRow } from "../types";
import { toNumberSafe } from "./money";

/** Handles 1/0, true/false, "1"/"0", and Directus buffer-ish { data: [1] } */
function isTruthyFlag(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  if (typeof v === "object") {
    const anyV = v as { data?: (number | boolean | string | null)[] };
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
  return isTruthyFlag(r.on_hold);
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

    // Robust extraction of the numeric payroll_run_id
    const rVal = r.payroll_run_id;
    let rId: number = 0;
    if (typeof rVal === "number") {
      rId = rVal;
    } else if (rVal && typeof rVal === "object") {
      // Directus sometimes nests the ID as 'id' or 'payroll_run_id' depending on the query
      const rObj = rVal as Record<string, unknown>;
      rId = Number(rObj.id || rObj.payroll_run_id) || 0;
    }

    const prevVal = prev?.payroll_run_id;
    let prevId: number = 0;
    if (typeof prevVal === "number") {
      prevId = prevVal;
    } else if (prevVal && typeof prevVal === "object") {
      const pObj = prevVal as Record<string, unknown>;
      prevId = Number(pObj.id || pObj.payroll_run_id) || 0;
    }

    if (!prev || rId >= prevId) {
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

    const isCard = isTruthyFlag(pr.is_card);

    // Robust extraction of nested metadata
    let ref = pr.payroll_ref_no;
    let posted = pr.posted_at;

    if (pr.payroll_run_id && typeof pr.payroll_run_id === "object") {
      const runObj = pr.payroll_run_id as Record<string, unknown>;
      if (!ref) ref = String(runObj.payroll_ref_no || "");
      if (!posted) posted = String(runObj.posted_at || "");
    }

    const addsOrig = toNumberSafe(pr.total_additions);

    const basic = toNumberSafe(pr.basic_pay);
    const ot = toNumberSafe(pr.ot_amount);
    const hol = toNumberSafe(pr.holiday_pay);
    const rest = toNumberSafe(pr.rest_day_amount);
    const nd = toNumberSafe(pr.night_diff_amount);

    // New Logic: 
    // Gross = Basic + OT + Holiday + Rest Day + Night Diff
    // Additions = Original Additions - BASIC - (OT + Holiday + Rest Day + Night Diff)
    const adjustedGross = basic + ot + hol + rest + nd;
    const adjustedAdds = addsOrig - basic - (ot + hol + rest + nd);

    return {
      user_id: pr.user_id,
      name_display,
      name_sort_key,
      payment_type: isCard ? "BANK" : "CASH",
      gross_pay: adjustedGross,
      total_additions: adjustedAdds,
      total_deductions: toNumberSafe(pr.total_deductions),
      net_pay: toNumberSafe(pr.net_pay),

      // ✅ New fields
      employee_no: pr.user_id.toString().padStart(4, "0"),
      days_worked: toNumberSafe(pr.total_days_worked),
      work_hours: toNumberSafe(pr.total_work_minutes) / 60,

      payroll_ref_no: ref,
      posted_at: posted,
    };
  });
}
