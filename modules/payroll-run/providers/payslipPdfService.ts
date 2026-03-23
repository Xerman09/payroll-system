// modules/payroll-run/providers/payslipPdfService.ts
import jsPDF from "jspdf";
import { formatPHP } from "../utils/compute";

type PageSize = "LEGAL" | "LONG";

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function parseJsonMaybe(v: unknown): Record<string, unknown> | null {
  if (!v) return null;
  if (typeof v === "object") return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * NO-FONT MODE:
 * Built-in jsPDF fonts are WinAnsi; `₱` is not safe.
 * Convert "₱1,234.00" -> "PHP 1,234.00"
 */
function fmtMoney(v: unknown): string {
  const x = Math.abs(n(v));
  const s = formatPHP(x); // typically "₱1,234.00"
  if (!s) return "PHP 0.00";
  return s.startsWith("₱") ? `PHP ${s.slice(1).trim()}` : s;
}

function normalizeRow(r: unknown): Record<string, unknown> {
  const obj = r as Record<string, unknown>;
  // ✅ critical for your payloads (you showed { data: { ... } })
  return obj?.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : obj;
}

function pickPeriodText(rIn: unknown, fallbackLabel: string) {
  const r = normalizeRow(rIn);
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

function payslipKey(rIn: unknown): string | null {
  const r = normalizeRow(rIn);

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

  // fallback (rare): use employee + cutoff
  const emp = safeStr(
    r?.employee_no ??
    r?.employeeNo ??
    r?.id_no ??
    r?.idNo ??
    r?.rf_id ??
    r?.rfId ??
    r?.user_id ??
    r?.userId ??
    "",
  );

  const cutoffId = safeStr(r?.cutoff_id ?? r?.cutoffId ?? "");
  const cutoffStart = safeStr(r?.cutoff_start ?? r?.cutoffStart ?? "").slice(
    0,
    10,
  );
  const cutoffEnd = safeStr(r?.cutoff_end ?? r?.cutoffEnd ?? "").slice(0, 10);

  const cutoff =
    cutoffId || (cutoffStart && cutoffEnd ? `${cutoffStart}:${cutoffEnd}` : "");

  if (emp && cutoff) return `emp:${emp}|${cutoff}`;

  return null;
}

function dedupeRows(rows: unknown[]) {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    const k = payslipKey(raw);
    if (!k) {
      out.push(normalizeRow(raw));
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(normalizeRow(raw));
  }
  return out;
}

function legalOrLongFormat(pageSize: PageSize) {
  if (pageSize === "LEGAL") return "legal" as const; // 8.5 x 14
  // LONG = 8.5 x 13 => 612 x 936 pt
  return [612, 936] as [number, number];
}

function textRight(doc: jsPDF, txt: string, xRight: number, y: number) {
  const w = doc.getTextWidth(txt);
  doc.text(txt, xRight - w, y);
}

function truncateToWidth(doc: jsPDF, txt: string, maxW: number): string {
  if (doc.getTextWidth(txt) <= maxW) return txt;
  const ell = "...";
  let s = txt;
  while (s.length > 0 && doc.getTextWidth(s + ell) > maxW) {
    s = s.slice(0, -1);
  }
  return s.length ? s + ell : ell;
}

type Entry = { label: string; value: string };

function buildEntries(items: Array<{ label: string; value: unknown }>): Entry[] {
  return items
    .filter((x) => x.label && n(x.value) !== 0)
    .map((x) => ({ label: String(x.label), value: fmtMoney(x.value) }));
}

function uniqLines(lines: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of lines) {
    const k = safeStr(s);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * Generic array extractor (safe fallback).
 * Looks for any common "items/lines/details" arrays and formats "Label: Amount".
 */
function extractGenericItemLines(section: unknown, preferredKeys: string[] = []) {
  const out: string[] = [];
  if (!section || typeof section !== "object") return out;

  const tryArrays: unknown[][] = [];
  const s = section as Record<string, unknown>;

  for (const k of preferredKeys) {
    const v = s[k];
    if (Array.isArray(v)) tryArrays.push(v as unknown[]);
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
    const v = s[k];
    if (Array.isArray(v)) tryArrays.push(v as unknown[]);
  }

  if (Array.isArray(section)) tryArrays.push(section as unknown[]);

  for (const arr of tryArrays) {
    for (const xRaw of arr) {
      const x = xRaw as Record<string, unknown>;
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
        x.pay ??
        0;

      const amt = n(rawAmt);
      if (!label || amt === 0) continue;

      out.push(`${label}: ${fmtMoney(amt)}`);
    }
    if (out.length) break; // stop at first useful array to avoid duplicates
  }

  return out;
}

/**
 * ✅ YOUR REAL STRUCTURE ITEMIZATION
 * earnings: allowance_items, holiday_items, rest_day_items (+ fallbacks)
 */
function extractEarningsItemization(earnings: unknown): string[] {
  if (!earnings || typeof earnings !== "object") return [];

  const e = earnings as Record<string, unknown>;
  const lines: string[] = [];

  // allowances
  const allowanceItems = Array.isArray(e.allowance_items)
    ? (e.allowance_items as Record<string, unknown>[])
    : [];
  for (const it of allowanceItems) {
    const desc = safeStr(it?.description ?? it?.name ?? it?.label ?? "Allowance");
    const amt = n(
      it?.amount_this_cutoff ??
      it?.amountThisCutoff ??
      it?.amount ??
      it?.total ??
      0,
    );
    if (desc && amt) lines.push(`${desc}: ${fmtMoney(amt)}`);
  }

  // holiday items
  const holidayItems = Array.isArray(e.holiday_items)
    ? (e.holiday_items as Record<string, unknown>[])
    : [];
  for (const it of holidayItems) {
    const date = safeStr(it?.date).slice(0, 10);
    const desc = safeStr(it?.description ?? it?.holiday ?? "Holiday");
    const amt = n(it?.total ?? it?.pay ?? 0);
    if (!amt) continue;

    // keep compact (space is limited per slip)
    const tag = safeStr(it?.pay_type);
    const prefix =
      tag === "UNWORKED_HOLIDAY_PAY" ? "Unworked Holiday" : "Holiday";
    const label = `${prefix}: ${desc}${date ? ` (${date})` : ""}`;
    lines.push(`${label}: ${fmtMoney(amt)}`);
  }

  // rest day items
  const restDayItems = Array.isArray(e.rest_day_items)
    ? (e.rest_day_items as Record<string, unknown>[])
    : [];
  for (const it of restDayItems) {
    const date = safeStr(it?.date).slice(0, 10);
    const amt = n(it?.total ?? it?.pay ?? 0);
    if (!amt) continue;
    lines.push(`Rest Day${date ? ` (${date})` : ""}: ${fmtMoney(amt)}`);
  }

  // manual additions items (if your backend provides them in some cases)
  const manualAddItems =
    (Array.isArray(e.manual_additions_items) &&
      (e.manual_additions_items as Record<string, unknown>[])) ||
    (Array.isArray(e.manual_items) && (e.manual_items as Record<string, unknown>[])) ||
    [];
  for (const it of manualAddItems) {
    const desc = safeStr(it?.description ?? it?.name ?? it?.label ?? "Manual");
    const amt = n(
      it?.amount_this_cutoff ??
      it?.amountThisCutoff ??
      it?.amount ??
      it?.total ??
      0,
    );
    if (desc && amt) lines.push(`${desc}: ${fmtMoney(amt)}`);
  }

  if (!lines.length) {
    lines.push(
      ...extractGenericItemLines(e, [
        "allowance_items",
        "manual_additions_items",
        "holiday_items",
        "rest_day_items",
        "items",
        "details",
      ]),
    );
  }

  return uniqLines(lines);
}

/**
 * ✅ YOUR REAL STRUCTURE ITEMIZATION
 * deductions: benefit_loans.items, employee_loans breakdown (+ fallbacks)
 */
function extractDeductionsItemization(deductions: unknown): string[] {
  if (!deductions || typeof deductions !== "object") return [];

  const d = deductions as Record<string, unknown>;
  const lines: string[] = [];

  // benefit loans items
  const benefitLoans = d.benefit_loans as Record<string, unknown>;
  const benefitLoanItems = Array.isArray(benefitLoans?.items)
    ? (benefitLoans.items as Record<string, unknown>[])
    : [];
  for (const it of benefitLoanItems) {
    const code = safeStr(it?.benefit_code ?? it?.benefitCode ?? "");
    const loanName = safeStr(it?.loan_name ?? it?.loanName ?? "");
    const ref = safeStr(it?.reference_no ?? it?.referenceNo ?? "");
    const amt = n(
      it?.amount_this_cutoff ??
      it?.amountThisCutoff ??
      it?.amortization_amount ??
      it?.amortizationAmount ??
      it?.amount ??
      0,
    );
    if (!amt) continue;

    const labelBase = loanName || (code ? `${code} Loan` : "Benefit Loan");
    const label = `${labelBase}${ref ? ` (${ref})` : ""}`;
    lines.push(`${label}: ${fmtMoney(amt)}`);
  }

  // employee loans (your JSON shows aggregated fields)
  const empLoans = d.employee_loans as Record<string, unknown>;
  if (empLoans && typeof empLoans === "object") {
    const vale = n(empLoans.vale);
    const car = n(empLoans.car_loan ?? empLoans.carLoan);
    const coop = n(empLoans.coop);

    if (vale) lines.push(`Vale: ${fmtMoney(vale)}`);
    if (car) lines.push(`Car Loan: ${fmtMoney(car)}`);
    if (coop) lines.push(`Coop Loan: ${fmtMoney(coop)}`);
  }

  // manual deductions items (if present sometimes)
  const manualDedItems =
    (Array.isArray(d.manual_deductions_items) &&
      (d.manual_deductions_items as Record<string, unknown>[])) ||
    (Array.isArray(d.manual_items) && (d.manual_items as Record<string, unknown>[])) ||
    [];
  for (const it of manualDedItems) {
    const desc = safeStr(it?.description ?? it?.name ?? it?.label ?? "Manual");
    const amt = n(
      it?.amount_this_cutoff ??
      it?.amountThisCutoff ??
      it?.amount ??
      it?.total ??
      0,
    );
    if (desc && amt) lines.push(`${desc}: ${fmtMoney(amt)}`);
  }

  // fallback
  if (!lines.length) {
    lines.push(
      ...extractGenericItemLines(d, [
        "manual_deductions_items",
        "loan_items",
        "benefit_items",
        "items",
        "details",
      ]),
    );
  }

  return uniqLines(lines);
}

export async function downloadPayslipsPdf(args: {
  rows: unknown[];
  payrollPeriodLabel: string;
  pageSize?: PageSize;
  fileName?: string;
  companyName?: string;
}) {
  const pageSize: PageSize = args.pageSize ?? "LEGAL";
  const rows = dedupeRows(Array.isArray(args.rows) ? args.rows : []);
  const fileName = args.fileName ?? "payslips.pdf";

  const doc = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: legalOrLongFormat(pageSize),
    compress: true,
  });

  // Built-in font (no fetching, no public/fonts needed)
  doc.setFont("helvetica", "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // maximize width while keeping safe print margin
  const marginX = 14;
  const marginY = 14;

  const slipsPerPage = 5;
  const gap = 8;

  const slipW = pageW - marginX * 2;
  const usableH = pageH - marginY * 2 - gap * (slipsPerPage - 1);
  const slipH = usableH / slipsPerPage;

  const pad = 8;

  function drawSlip(rIn: unknown, x: number, y: number) {
    const r = normalizeRow(rIn);

    // subtle header fill
    doc.setFillColor(235, 244, 255);
    doc.rect(x + 1, y + 1, slipW - 2, 18, "F");

    // border
    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.rect(x, y, slipW, slipH);

    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = slipW - pad * 2;
    const bottomY = y + slipH - pad;

    // ✅ add a small top offset so corp name isn't glued to the top border
    let cy = innerY + 3;

    const breakdown =
      parseJsonMaybe(r?.breakdown_json ?? r?.breakdownJson) ?? {};
    const b = breakdown; // already your structure (earnings/deductions/totals/etc)

    const employeeName = safeStr(
      r?.employee_name ?? r?.employeeName ?? r?.full_name ?? r?.name ?? "",
    );
    const employeeNameCaps = employeeName ? employeeName.toUpperCase() : "";

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
    const lateMin = Math.floor(Math.max(0, n(r?.late_minutes ?? 0)));
    const undertimeMin = Math.floor(Math.max(0, n(r?.undertime_minutes ?? 0)));
    const otMin = Math.floor(Math.max(0, n(r?.overtime_minutes ?? 0)));
    const ndMin = Math.floor(Math.max(0, n(r?.night_diff_minutes ?? 0)));

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

    const benLoanSSS = n(r?.benefit_loan_sss ?? 0);
    const benLoanPag = n(r?.benefit_loan_pagibig ?? 0);

    const otherDed = n(r?.other_deductions ?? 0);
    const manualDed = n(r?.manual_deductions ?? 0);

    const grossPay = n(r?.gross_pay ?? 0);
    const totalDeductions = n(r?.total_deductions ?? 0);
    const netPay = n(r?.net_pay ?? 0);

    // ✅ itemized lines from YOUR breakdown_json
    const earningsLines = extractEarningsItemization(b?.earnings);
    const deductionsLinesFromBreakdown = extractDeductionsItemization(b?.deductions);

    // keep legacy explicit loan lines (from row fields) if present and not already listed
    const extraLoanLines: string[] = [];
    if (loanVale) extraLoanLines.push(`Vale: ${fmtMoney(loanVale)}`);
    if (loanCar) extraLoanLines.push(`Car Loan: ${fmtMoney(loanCar)}`);
    if (loanCoop) extraLoanLines.push(`Coop Loan: ${fmtMoney(loanCoop)}`);

    const deductionsLines = uniqLines([
      ...deductionsLinesFromBreakdown,
      ...extraLoanLines,
    ]);

    // main lists (summary)
    const earningsEntries = buildEntries([
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

    const deductionsEntries = buildEntries([
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

    // fonts (keep compact)
    const fsCorp = 10.5;
    const fsTitle = 8.5;
    const fsBody = 7.2;
    const fsSmall = 6.6;
    const fsNet = 10;

    // corporation title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsCorp);
    const headerName = args.companyName || "MEN2 MARKETING CORPORATION";
    doc.text(headerName, innerX, cy);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    // Period text moved below
    // textRight(doc, `${periodText}`, innerX + innerW, cy);

    cy += 13;

    // employee line (caps, highlighted feel by placing on header band)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsTitle);
    doc.text(
      truncateToWidth(
        doc,
        `EMPLOYEE: ${employeeNameCaps || "(NO NAME)"}`,
        innerW * 0.72,
      ),
      innerX,
      cy,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.text(
      truncateToWidth(doc, `Department: ${department || "-"}`, innerW * 0.62),
      innerX,
      cy,
    );
    textRight(
      doc,
      truncateToWidth(doc, `ID No.: ${employeeId || "-"}`, innerW * 0.28),
      innerX + innerW,
      cy,
    );

    cy += 11;

    doc.text(
      truncateToWidth(doc, `Job Title: ${position || "-"}`, innerW * 0.5),
      innerX,
      cy,
    );
    textRight(
      doc,
      truncateToWidth(doc, `${periodText}`, innerW * 0.5),
      innerX + innerW,
      cy,
    );

    cy += 11;

    const rates = `Rates: ${monthlyRate ? fmtMoney(monthlyRate) : "-"} / ${dailyRate ? fmtMoney(dailyRate) : "-"
      } / ${hourlyRate ? fmtMoney(hourlyRate) : "-"}`;
    doc.text(truncateToWidth(doc, rates, innerW), innerX, cy);

    cy += 10;

    // metrics + net band
    const bandH = 34;
    const netW = 150;
    const gap2 = 8;
    const metricsW = innerW - netW - gap2;

    doc.setLineWidth(0.8);
    doc.rect(innerX, cy, metricsW, bandH);

    // net box fill
    doc.setFillColor(232, 245, 238);
    doc.rect(innerX + metricsW + gap2, cy, netW, bandH, "F");
    doc.rect(innerX + metricsW + gap2, cy, netW, bandH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);

    const mX = innerX + 6;
    const mY = cy + 12;
    const col = metricsW / 3;

    const metrics = [
      ["Days", daysWorked.toFixed(2)],
      ["Hours", hoursWorked.toFixed(2)],
      ["Late", String(lateMin)],
      ["UT", String(undertimeMin)],
      ["OT", String(otMin)],
      ["ND", String(ndMin)],
    ];

    for (let i = 0; i < metrics.length; i++) {
      const cx0 = mX + (i % 3) * col;
      const cy0 = mY + Math.floor(i / 3) * 11;
      doc.text(`${metrics[i][0]}:`, cx0, cy0);
      textRight(doc, metrics[i][1], cx0 + col - 8, cy0);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);
    doc.text("NET PAY", innerX + metricsW + gap2 + 8, cy + 12);

    doc.setFontSize(fsNet);
    textRight(
      doc,
      fmtMoney(netPay),
      innerX + metricsW + gap2 + netW - 8,
      cy + 27,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);

    cy += bandH + 8;

    // totals footer region
    const totalsH = 28;
    const totalsTopY = bottomY - totalsH;

    // columns
    const colGap = 10;
    const colW = (innerW - colGap) / 2;
    const leftColX = innerX;
    const rightColX = innerX + colW + colGap;

    const titleH = 12;

    // title row fill
    doc.setFillColor(235, 244, 255);
    doc.rect(leftColX, cy, colW, titleH, "F");
    doc.rect(rightColX, cy, colW, titleH, "F");
    doc.rect(leftColX, cy, colW, titleH);
    doc.rect(rightColX, cy, colW, titleH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);

    const eTitle = "EARNINGS";
    const dTitle = "DEDUCTIONS";
    doc.text(
      eTitle,
      leftColX + colW / 2 - doc.getTextWidth(eTitle) / 2,
      cy + 9,
    );
    doc.text(
      dTitle,
      rightColX + colW / 2 - doc.getTextWidth(dTitle) / 2,
      cy + 9,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);

    cy += titleH + 6;

    const listTopY = cy;
    const listBottomY = totalsTopY - 6;

    const rowH = 10;
    const smallRowH = 9;

    function drawMainList(
      x0: number,
      y0: number,
      w0: number,
      rows2: Entry[],
      maxY: number,
    ) {
      let yy = y0;
      for (const it of rows2) {
        if (yy > maxY) break;
        const labelW = w0 * 0.72;
        const label = truncateToWidth(doc, it.label, labelW - 6);
        doc.text(label, x0, yy);
        textRight(doc, it.value, x0 + w0, yy);
        yy += rowH;
      }
      return yy;
    }

    function drawItemized(
      x0: number,
      y0: number,
      w0: number,
      lines: string[],
      maxY: number,
    ) {
      if (lines.length === 0) return y0;

      (doc as unknown as { setLineDash: (p: number[], s: number) => void }).setLineDash([1.5, 2], 0);
      doc.line(x0, y0, x0 + w0, y0);
      (doc as unknown as { setLineDash: (p: number[], s: number) => void }).setLineDash([], 0);

      let yy = y0 + 9;

      doc.setFontSize(fsSmall);
      for (const t of lines) {
        if (yy > maxY) break;
        const s = truncateToWidth(doc, t, w0);
        doc.text(s, x0, yy);
        yy += smallRowH;
      }
      doc.setFontSize(fsBody);

      return yy;
    }

    // Earnings
    const eAfterMain = drawMainList(
      leftColX,
      listTopY,
      colW,
      earningsEntries,
      listBottomY,
    );
    drawItemized(leftColX, eAfterMain + 2, colW, earningsLines, listBottomY);

    // Deductions
    const dAfterMain = drawMainList(
      rightColX,
      listTopY,
      colW,
      deductionsEntries,
      listBottomY,
    );
    drawItemized(rightColX, dAfterMain + 2, colW, deductionsLines, listBottomY);

    // totals line
    doc.setLineWidth(0.8);
    doc.line(innerX, totalsTopY, innerX + innerW, totalsTopY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);

    doc.text(`Gross: ${fmtMoney(grossPay)}`, innerX, totalsTopY + 12);
    textRight(
      doc,
      `Total Deductions: ${fmtMoney(totalDeductions)}`,
      innerX + innerW,
      totalsTopY + 12,
    );
    doc.text(`Net: ${fmtMoney(netPay)}`, innerX, totalsTopY + 24);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
  }

  if (rows.length === 0) {
    doc.setFontSize(12);
    doc.text("No payslip rows to print.", 40, 60);
    doc.save(fileName);
    return;
  }

  // Explicit paging (no blank first/last pages)
  let pageIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    const nextPageIndex = Math.floor(i / slipsPerPage);
    const slot = i % slipsPerPage;

    if (nextPageIndex !== pageIndex) {
      pageIndex = nextPageIndex;
      doc.addPage(legalOrLongFormat(pageSize), "p");
      doc.setFont("helvetica", "normal");
    }

    const x = marginX;
    const y = marginY + slot * (slipH + gap);
    drawSlip(rows[i], x, y);
  }

  doc.save(fileName);
}
