// modules/payroll-run/utils/payslipPrint.ts
import { formatPHP } from "./compute";

function n(v: any): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function escapeHtml(input: any): string {
  const s = String(input ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseJsonMaybe(v: any): any | null {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

/** Always show Peso sign, no +/- (we show absolute value) */
function fmtMoney(v: any): string {
  const x = Math.abs(n(v));
  return formatPHP(x);
}

function safeStr(v: any): string {
  return String(v ?? "").trim();
}

function pickPeriodText(r: any, fallbackLabel: string) {
  const cutoffLabel = safeStr(r?.cutoff_label ?? r?.cutoffLabel ?? "");
  const cutoffStart = safeStr(r?.cutoff_start ?? r?.cutoffStart ?? "").slice(
    0,
    10,
  );
  const cutoffEnd = safeStr(r?.cutoff_end ?? r?.cutoffEnd ?? "").slice(0, 10);

  return (
    cutoffLabel ||
    (cutoffStart && cutoffEnd ? `${cutoffStart} to ${cutoffEnd}` : "") ||
    fallbackLabel ||
    "-"
  );
}

function listItems(items: Array<{ label: string; value: any }>) {
  return items
    .filter((x) => x.label && n(x.value) !== 0)
    .map(
      (x) => `
        <div class="li">
          <div class="li-label">${escapeHtml(x.label)}</div>
          <div class="li-val">${escapeHtml(fmtMoney(x.value))}</div>
        </div>
      `,
    )
    .join("");
}

/**
 * Extract itemized lines from breakdown_json in a resilient way.
 */
function extractItemLines(section: any, preferredKeys: string[] = []): string[] {
  const out: string[] = [];
  if (!section || typeof section !== "object") return out;

  const tryArrays: any[] = [];

  for (const k of preferredKeys) {
    const v = (section as any)[k];
    if (Array.isArray(v)) tryArrays.push(v);
  }

  const commonKeys = [
    "items",
    "itemized",
    "details",
    "breakdown",
    "rows",
    "lines",
    "entries",
    "allowance_items",
    "allowanceItems",
    "manual_additions_items",
    "manualAdditionsItems",
    "manual_items",
    "deduction_items",
    "deductionItems",
    "deductions_items",
    "deductionsItems",
    "manual_deductions_items",
    "manualDeductionsItems",
    "loan_items",
    "loanItems",
    "benefit_items",
    "benefitItems",
  ];

  for (const k of commonKeys) {
    const v = (section as any)[k];
    if (Array.isArray(v)) tryArrays.push(v);
  }

  if (Array.isArray(section)) tryArrays.push(section);

  for (const arr of tryArrays) {
    for (const x of arr) {
      if (!x) continue;

      const label =
        safeStr(x.description ?? x.name ?? x.label ?? x.title ?? x.code) ||
        "Item";

      const rawAmt =
        x.amount_this_cutoff ??
        x.amountThisCutoff ??
        x.amount ??
        x.value ??
        x.amt ??
        x.total ??
        x.deduction ??
        x.earning ??
        0;

      const amt = n(rawAmt);
      if (!label || amt === 0) continue;

      out.push(`${label}: ${fmtMoney(amt)}`);
    }
    if (out.length) break; // stop at first useful array to avoid duplicates
  }

  return out;
}

function smallLines(lines: string[], max = 12) {
  const safe = lines.filter(Boolean).slice(0, max);
  if (safe.length === 0) return "";
  return `
    <div class="sublist">
      ${safe.map((t) => `<div class="sub">${escapeHtml(t)}</div>`).join("")}
    </div>
  `;
}

function payslipKey(r: any): string | null {
  const preId =
    r?.id ??
    r?.payroll_run_employee_id ??
    r?.payrollRunEmployeeId ??
    r?.pre_id ??
    null;

  if (preId !== null && preId !== undefined && String(preId).trim() !== "") {
    return `pre:${String(preId)}`;
  }

  const run = r?.payroll_run_id ?? r?.payrollRunId ?? null;
  const user =
    r?.user_id ?? r?.userId ?? r?.employee_id ?? r?.employeeId ?? null;

  if (
    run !== null &&
    run !== undefined &&
    String(run).trim() !== "" &&
    user !== null &&
    user !== undefined &&
    String(user).trim() !== ""
  ) {
    return `ru:${String(run)}-${String(user)}`;
  }

  return null;
}

function dedupeRows(rows: any[]) {
  const out: any[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const k = payslipKey(r);

    if (!k) {
      out.push(r);
      continue;
    }

    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }

  return out;
}

export function buildPayslipPrintMarkup(args: {
  rows: any[];
  payrollPeriodLabel: string;
  payrollPeriodRange: string | null;
  pageSize?: "LEGAL" | "LONG";
}): string {
  let rows = Array.isArray(args.rows) ? args.rows : [];

  rows = dedupeRows(rows);

  const perPage = 4;

  const pageSize = args.pageSize ?? "LEGAL";
  const pageH = pageSize === "LEGAL" ? "14in" : "13in";

  const pages: any[][] = [];
  for (let i = 0; i < rows.length; i += perPage) {
    pages.push(rows.slice(i, i + perPage));
  }

  const pagesHtml = pages
    .map((chunk) => {
      const slips = chunk
        .map((r) => {
          const b = parseJsonMaybe(r?.breakdown_json ?? r?.breakdownJson) ?? {};

          const employeeName = safeStr(
            r?.employee_name ?? r?.employeeName ?? r?.full_name ?? r?.name ?? "",
          );
          const position = safeStr(
            r?.position_name ?? r?.position ?? r?.positionName ?? "",
          );
          const department = safeStr(
            r?.department_name_snapshot ??
            r?.department_name ??
            r?.departmentName ??
            "",
          );

          const employeeId = safeStr(
            r?.employee_no ??
            r?.employeeNo ??
            r?.id_no ??
            r?.idNo ??
            r?.user_id ??
            r?.userId ??
            r?.id ??
            "",
          );

          const periodText = pickPeriodText(r, args.payrollPeriodLabel);

          const dailyRate = n(r?.daily_rate ?? r?.basic_daily_rate ?? 0);
          const hourlyRate = n(r?.hourly_rate ?? 0);
          const monthlyRate = n(r?.monthly_rate ?? 0);

          const daysWorked = n(r?.total_days_worked ?? r?.days_worked ?? 0);
          const hoursWorked = n(r?.total_hours_worked ?? r?.hours_worked ?? 0);
          const lateMin = n(r?.late_minutes ?? 0);
          const undertimeMin = n(r?.undertime_minutes ?? 0);
          const otMin = n(r?.overtime_minutes ?? 0);
          const ndMin = n(r?.night_diff_minutes ?? 0);

          const basicPay = n(r?.basic_pay ?? 0);
          const otAmount = n(r?.ot_amount ?? 0);
          const holidayPay = n(r?.holiday_pay ?? r?.holiday ?? 0);
          const restDayAmount = n(r?.rest_day_amount ?? 0);
          const nightDiffAmount = n(r?.night_diff_amount ?? 0);
          const allowanceTotal = n(r?.allowance ?? 0);
          const manualAdditions = n(r?.manual_additions ?? 0);
          const retroPay = n(r?.retro_pay ?? 0);
          const leaveAmount = n(r?.leave_amount ?? 0);

          const lateDed = n(r?.late_deduction ?? 0);
          const undertimeDed = n(r?.undertime_deduction ?? 0);
          const shortageDed = n(r?.shortage_deduction ?? 0);
          const drDed = n(r?.dr_deduction ?? 0);

          const loanVale = n(r?.loan_vale ?? 0);
          const loanCar = n(r?.loan_car ?? 0);
          const loanCoop = n(r?.loan_coop ?? 0);
          const loanTotal = n(r?.loan_total ?? loanVale + loanCar + loanCoop);

          const coopSavings = n(r?.coop_savings ?? 0);
          const coopLoan = n(r?.coop_loan ?? 0);

          const benSSS = n(r?.benefit_sss ?? 0);
          const benPhil = n(r?.benefit_philhealth ?? 0);
          const benPag = n(r?.benefit_pagibig ?? 0);

          const benLoanSSS = n(
            r?.benefit_sss_loan ?? r?.benefit_loan_sss ?? 0,
          );
          const benLoanPag = n(
            r?.benefit_pagibig_loan ?? r?.benefit_loan_pagibig ?? 0,
          );

          const otherDed = n(r?.other_deductions ?? 0);
          const manualDed = n(r?.manual_deductions ?? 0);

          const grossPay = n(r?.gross_pay ?? 0);
          const totalDeductions = n(r?.total_deductions ?? 0);
          const netPay = n(r?.net_pay ?? 0);

          const earningsLines = [
            ...extractItemLines(b?.earnings, [
              "allowance_items",
              "manual_additions_items",
              "items",
              "details",
            ]),
          ];

          const deductionsLines = [
            ...extractItemLines(b?.deductions, [
              "deductions_items",
              "manual_deductions_items",
              "loan_items",
              "benefit_items",
              "items",
              "details",
            ]),
          ];

          if (loanVale) deductionsLines.push(`Vale: ${fmtMoney(loanVale)}`);
          if (loanCar) deductionsLines.push(`Car Loan: ${fmtMoney(loanCar)}`);
          if (loanCoop) deductionsLines.push(`Coop Loan: ${fmtMoney(loanCoop)}`);

          const earningsList = listItems([
            { label: "Basic Pay", value: basicPay },
            { label: "Overtime Pay", value: otAmount },
            { label: "Holiday Pay", value: holidayPay },
            { label: "Rest Day Pay", value: restDayAmount },
            { label: "Night Differential", value: nightDiffAmount },
            { label: "Allowances", value: allowanceTotal },
            { label: "Manual Additions", value: manualAdditions },
            { label: "Leave Amount", value: leaveAmount },
            { label: "Retro Pay", value: retroPay },
          ]);

          const deductionsList = listItems([
            { label: "Late Deduction", value: lateDed },
            { label: "Undertime Deduction", value: undertimeDed },
            { label: "Shortage Deduction", value: shortageDed },
            { label: "Stock Payments (DR)", value: drDed },
            { label: "Employee Loans", value: loanTotal },
            { label: "SSS Contribution", value: benSSS },
            { label: "PhilHealth Contribution", value: benPhil },
            { label: "Pag-IBIG Contribution", value: benPag },
            { label: "SSS Loan", value: benLoanSSS },
            { label: "Pag-IBIG Loan", value: benLoanPag },
            { label: "Coop Savings", value: coopSavings },
            { label: "Coop Loan", value: coopLoan },
            { label: "Other Deductions", value: otherDed },
            { label: "Manual Deductions", value: manualDed },
          ]);

          return `
            <section class="slip">
              <header class="head">
                <div class="h-left">
                  <div class="title">PAYSLIP</div>
                  <div class="muted clamp">Employee: <span class="strong">${escapeHtml(employeeName || "(no name)")}</span></div>
                </div>
                <div class="h-right">
                  <div class="muted">Period</div>
                  <div class="strong clamp">${escapeHtml(periodText)}</div>
                </div>
              </header>

              <div class="info">
                <div class="info-left">
                  <div class="clamp"><span class="muted">Department:</span> ${escapeHtml(department || "-")}</div>
                  <div class="clamp"><span class="muted">Designation:</span> ${escapeHtml(position || "-")}</div>
                </div>
                <div class="info-right">
                  <div class="clamp"><span class="muted">ID No.:</span> ${escapeHtml(employeeId || "-")}</div>
                  <div class="clamp"><span class="muted">Rates:</span>
                    ${escapeHtml(monthlyRate ? fmtMoney(monthlyRate) : "-")} /
                    ${escapeHtml(dailyRate ? fmtMoney(dailyRate) : "-")} /
                    ${escapeHtml(hourlyRate ? fmtMoney(hourlyRate) : "-")}
                  </div>
                </div>
              </div>

              <div class="bar">
                <div class="bar-left">
                  <div class="kv"><span>Days</span><span class="mono">${escapeHtml(daysWorked.toFixed(2))}</span></div>
                  <div class="kv"><span>Hours</span><span class="mono">${escapeHtml(hoursWorked.toFixed(2))}</span></div>
                  <div class="kv"><span>Late</span><span class="mono">${escapeHtml(String(Math.floor(Math.max(0, lateMin))))}</span></div>
                  <div class="kv"><span>UT</span><span class="mono">${escapeHtml(String(Math.floor(Math.max(0, undertimeMin))))}</span></div>
                  <div class="kv"><span>OT</span><span class="mono">${escapeHtml(String(Math.floor(Math.max(0, otMin))))}</span></div>
                  <div class="kv"><span>ND</span><span class="mono">${escapeHtml(String(Math.floor(Math.max(0, ndMin))))}</span></div>
                </div>
                <div class="bar-net">
                  <div class="muted">NET PAY</div>
                  <div class="net mono">${escapeHtml(fmtMoney(netPay))}</div>
                </div>
              </div>

              <div class="cols">
                <div class="col">
                  <div class="col-title">EARNINGS</div>
                  <div class="list">${earningsList || `<div class="empty">None</div>`}</div>
                  ${smallLines(earningsLines, 14)}
                </div>

                <div class="col">
                  <div class="col-title">DEDUCTIONS</div>
                  <div class="list">${deductionsList || `<div class="empty">None</div>`}</div>
                  ${smallLines(deductionsLines, 14)}
                </div>
              </div>

              <footer class="totals">
                <div class="tot"><span>Gross</span><span class="mono strong">${escapeHtml(fmtMoney(grossPay))}</span></div>
                <div class="tot"><span>Total Deductions</span><span class="mono strong">${escapeHtml(fmtMoney(totalDeductions))}</span></div>
                <div class="tot net"><span>Net</span><span class="mono strong">${escapeHtml(fmtMoney(netPay))}</span></div>
              </footer>
            </section>
          `;
        })
        .join("");

      return `<div class="page">${slips}</div>`;
    })
    .join("");

  return `
    <style>
      @page { size: 8.5in ${pageH}; margin: 0.22in; }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }

      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #000;
        font-size: 9px;
        line-height: 1.08;
      }

      .doc { margin: 0; padding: 0; }

      .page {
        width: 100%;
        height: calc(${pageH} - 0.44in);
        display: grid;
        grid-template-rows: repeat(4, 1fr);
        gap: 0.06in;
        overflow: hidden;
        align-items: stretch;
        justify-items: stretch;
      }
      .page:not(:last-child) { break-after: page; page-break-after: always; }

      .slip {
        border: 1px solid #000;
        padding: 4px 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow: hidden;

        /* ✅ critical: allow grid rows to shrink even when content is "a bit too much" */
        min-height: 0;
      }

      .head {
        display:flex;
        justify-content: space-between;
        gap: 10px;
        align-items: flex-start;
      }
      .h-left, .h-right { min-width: 0; }
      .h-right { text-align: right; }

      .title { font-weight: 800; font-size: 9px; letter-spacing: 0.2px; }
      .muted { opacity: 0.78; }
      .strong { font-weight: 700; }
      .mono { font-family: "Courier New", Courier, monospace; }

      .clamp {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .info {
        display:grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 8px;
        font-size: 8.5px;
        min-height: 0;
      }
      .info-left, .info-right { min-width: 0; }

      .bar {
        display:grid;
        grid-template-columns: 1.5fr 0.7fr;
        gap: 6px;
        align-items: stretch;
        min-height: 0;
      }
      .bar-left {
        border: 1px solid #000;
        padding: 3px 5px;
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 2px 8px;
        font-size: 8.25px;
        min-height: 0;
      }
      .kv { display:flex; justify-content: space-between; gap: 6px; min-width: 0; }
      .kv span { min-width: 0; }

      .bar-net {
        border: 1px solid #000;
        padding: 3px 5px;
        display:flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        min-height: 0;
      }
      .net { font-size: 10px; font-weight: 800; }

      .cols {
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        flex: 1;
        min-height: 0;
      }
      .col { min-height: 0; overflow: hidden; }

      .col-title {
        text-align: center;
        font-weight: 800;
        border-top: 1px solid #000;
        border-bottom: 1px solid #000;
        padding: 1px 0;
        margin-bottom: 3px;
        font-size: 8.5px;
      }

      .list { font-size: 8.25px; }
      .li {
        display:flex;
        justify-content: space-between;
        gap: 8px;
        padding: 1px 0;
      }
      .li-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 72%;
        min-width: 0;
      }
      .li-val { white-space: nowrap; }

      .empty { opacity: 0.7; padding: 1px 0; }

      .sublist {
        margin-top: 3px;
        border-top: 1px dotted #000;
        padding-top: 2px;
      }
      .sub {
        font-size: 8px;
        line-height: 1.06;
        white-space: normal;
        word-break: break-word;
      }

      .totals {
        border-top: 1px solid #000;
        padding-top: 3px;
        font-size: 8.5px;
      }
      .tot { display:flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
      .tot.net { font-weight: 800; }

      @media print {
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>

    <div class="doc">
      ${pagesHtml || `<div style="padding:12px;">No payslip rows to print.</div>`}
    </div>
  `;
}
