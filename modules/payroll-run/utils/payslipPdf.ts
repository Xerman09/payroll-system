// modules/payroll-run/utils/payslipPdf.ts
import jsPDF from "jspdf";
import { formatPHP } from "./compute";

type PageSize = "LEGAL" | "LONG";

function n(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const x = Number(cleaned);
    return Number.isFinite(x) ? x : 0;
  }
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function safeStr(v: any): string {
  return String(v ?? "").trim();
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

/**
 * NO-FONT MODE:
 * Built-in jsPDF fonts are WinAnsi; `₱` is not safe.
 * Convert "₱1,234.00" -> "PHP 1,234.00".
 */
function fmtMoney(v: any): string {
  const x = Math.abs(n(v));
  const s = formatPHP(x);
  if (!s) return "PHP 0.00";
  return s.startsWith("₱") ? `PHP ${s.slice(1).trim()}` : s;
}

function pickPeriodText(r: any, fallbackLabel: string) {
  const cutoffLabel = safeStr(r?.cutoff_label ?? r?.cutoffLabel ?? "");
  const cutoffStart = safeStr(r?.cutoff_start ?? r?.cutoffStart ?? "").slice(0, 10);
  const cutoffEnd = safeStr(r?.cutoff_end ?? r?.cutoffEnd ?? "").slice(0, 10);

  return (
    cutoffLabel ||
    (cutoffStart && cutoffEnd ? `${cutoffStart} to ${cutoffEnd}` : "") ||
    fallbackLabel ||
    "-"
  );
}

function legalOrLongFormat(pageSize: PageSize) {
  if (pageSize === "LEGAL") return "legal" as const; // 8.5 x 14
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
  while (s.length > 0 && doc.getTextWidth(s + ell) > maxW) s = s.slice(0, -1);
  return s.length ? s + ell : ell;
}

type Entry = { label: string; value: string };

function buildEntries(
  items: Array<{ label: string; value: any }>,
  opts?: { includeZero?: boolean },
): Entry[] {
  const includeZero = !!opts?.includeZero;
  return items
    .filter((x) => {
      if (!x.label) return false;
      const v = n(x.value);
      return includeZero ? true : v !== 0;
    })
    .map((x) => ({ label: String(x.label), value: fmtMoney(x.value) }));
}

function uniqLines(lines: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of lines) {
    const k = safeStr(s);
    if (!k) continue;
    const kk = k.toLowerCase();
    if (seen.has(kk)) continue;
    seen.add(kk);
    out.push(k);
  }
  return out;
}

function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDraw(doc: jsPDF, rgb: [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
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
  const user = r?.user_id ?? r?.userId ?? r?.employee_id ?? r?.employeeId ?? null;

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
    const row = r?.data ?? r;
    const k = payslipKey(row);
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

// ===== breakdown_json extractors (your new structure) =====

function extractAllowanceLines(b: any): string[] {
  const items = b?.earnings?.allowance_items ?? [];
  if (!Array.isArray(items)) return [];
  return uniqLines(
    items
      .map((x: any) => {
        const label = safeStr(x?.description ?? "Allowance");
        const amt = n(x?.amount_this_cutoff ?? x?.amount ?? 0);
        if (!label || amt === 0) return "";
        return `${label}: ${fmtMoney(amt)}`;
      })
      .filter(Boolean),
  );
}

function extractManualAdditionLines(b: any): string[] {
  const items = b?.earnings?.manual_addition_items ?? [];
  if (!Array.isArray(items)) return [];
  return uniqLines(
    items
      .map((x: any) => {
        const label = safeStr(x?.description ?? "Manual Addition");
        const amt = n(x?.amount ?? 0);
        if (!label || amt === 0) return "";
        return `${label}: ${fmtMoney(amt)}`;
      })
      .filter(Boolean),
  );
}

function extractManualDeductionLines(b: any): string[] {
  const items = b?.deductions?.manual_deduction_items ?? [];
  if (!Array.isArray(items)) return [];
  return uniqLines(
    items
      .map((x: any) => {
        const label = safeStr(x?.description ?? "Manual Deduction");
        const amt = n(x?.amount ?? 0);
        if (!label || amt === 0) return "";
        return `${label}: ${fmtMoney(amt)}`;
      })
      .filter(Boolean),
  );
}

function extractEmployeeLoanLines(row: any, b: any): string[] {
  const items = b?.deductions?.employee_loan_items ?? [];
  if (Array.isArray(items) && items.length) {
    return uniqLines(
      items
        .map((x: any) => {
          const code = safeStr(x?.code ?? x?.meta?.loan_type ?? x?.loan_type ?? "");
          const amt = n(x?.amount ?? 0);
          if (!code && amt === 0) return "";

          const upper = code.toUpperCase();
          const label =
            upper === "CAR LOAN"
              ? "Car Loan"
              : upper === "COOP"
                ? "COOP"
                : upper === "VALE"
                  ? "Vale"
                  : code || "Loan";

          return `${label}: ${fmtMoney(amt)}`;
        })
        .filter(Boolean),
    );
  }

  const loanVale = n(row?.loan_vale ?? 0);
  const loanCar = n(row?.loan_car ?? 0);
  const loanCoop = n(row?.loan_coop ?? 0);
  return uniqLines([
    `Vale: ${fmtMoney(loanVale)}`,
    `Car Loan: ${fmtMoney(loanCar)}`,
    `COOP: ${fmtMoney(loanCoop)}`,
  ]);
}

function extractBenefitLoanLines(b: any): string[] {
  const items = b?.deductions?.benefit_loans?.items ?? [];
  if (!Array.isArray(items)) return [];
  return uniqLines(
    items
      .map((x: any) => {
        const code = safeStr(x?.benefit_code ?? "");
        const amt = n(x?.amount_this_cutoff ?? x?.amortization_amount ?? 0);
        if (!code && amt === 0) return "";
        const label =
          code === "SSS"
            ? "SSS Loan"
            : code === "PAGIBIG"
              ? "Pag-IBIG Loan"
              : `${code} Loan`;
        return `${label}: ${fmtMoney(amt)}`;
      })
      .filter(Boolean),
  );
}

// ===== 3-col renderers =====

function drawEntriesMultiColumn(args: {
  doc: jsPDF;
  x0: number;
  y0: number;
  w0: number;
  maxY: number;
  rows: Entry[];
  cols: 1 | 2 | 3;
  rowH: number;
  innerGap: number;
  C_TEXT_DIM: [number, number, number];
  fsBody: number;
}) {
  const { doc, x0, y0, w0, maxY, rows, cols, rowH, innerGap, C_TEXT_DIM, fsBody } = args;
  if (maxY < y0) return;

  const availH = Math.max(0, maxY - y0);
  const rowsPerCol = Math.max(0, Math.floor(availH / rowH) + 1);
  if (rowsPerCol <= 0) return;

  const colW = cols === 1 ? w0 : (w0 - innerGap * (cols - 1)) / cols;

  const cap = rowsPerCol * cols;
  const drawRows = rows.slice(0, cap);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fsBody);

  for (let i = 0; i < drawRows.length; i++) {
    const colIdx = cols === 1 ? 0 : Math.floor(i / rowsPerCol);
    const rowIdx = cols === 1 ? i : i % rowsPerCol;

    const xx = x0 + colIdx * (colW + innerGap);
    const yy = y0 + rowIdx * rowH;
    if (yy > maxY) continue;

    const it = drawRows[i];

    // ✅ narrower label to leave more room for the value
    const labelW = colW * 0.58;
    const label = truncateToWidth(doc, it.label, labelW - 2);

    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text(label, xx, yy);

    doc.setTextColor(0, 0, 0);
    textRight(doc, it.value, xx + colW, yy);
  }

  doc.setTextColor(0, 0, 0);
}

function drawItemLines3Col(args: {
  doc: jsPDF;
  x0: number;
  y0: number;
  w0: number;
  maxY: number;
  cols: 1 | 2 | 3;
  rowH: number;
  innerGap: number;
  fsSmall: number;
  C_TEXT_DIM: [number, number, number];
  lines: string[];
  title: string;
}) {
  const { doc, x0, y0, w0, maxY, cols, rowH, innerGap, fsSmall, C_TEXT_DIM, lines, title } = args;
  if (maxY < y0) return;

  // separator line above itemization
  doc.setLineDash([1.5, 2], 0);
  doc.line(x0, y0 - 8, x0 + w0, y0 - 8);
  doc.setLineDash([], 0);

  const availH = Math.max(0, maxY - y0);
  const rowsPerCol = Math.max(0, Math.floor(availH / rowH) + 1);
  if (rowsPerCol <= 0) return;

  const colW = cols === 1 ? w0 : (w0 - innerGap * (cols - 1)) / cols;

  // first row: title (still flows in the grid, but shorten it before passing in)
  const all = [title, ...lines].filter(Boolean);
  const cap = rowsPerCol * cols;
  const drawRows = all.slice(0, cap);

  doc.setFontSize(fsSmall);

  for (let i = 0; i < drawRows.length; i++) {
    const colIdx = cols === 1 ? 0 : Math.floor(i / rowsPerCol);
    const rowIdx = cols === 1 ? i : i % rowsPerCol;

    const xx = x0 + colIdx * (colW + innerGap);
    const yy = y0 + rowIdx * rowH;
    if (yy > maxY) continue;

    const t = drawRows[i];

    if (i === 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
      doc.text(truncateToWidth(doc, t, colW), xx, yy);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
      const indent = 8;
      doc.text(truncateToWidth(doc, t, colW - indent), xx + indent, yy);
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
}

// ===== main export =====

export async function downloadPayslipsPdf(args: {
  rows: any[];
  payrollPeriodLabel: string;
  pageSize?: PageSize;
  fileName?: string;
}) {
  const pageSize: PageSize = args.pageSize ?? "LEGAL";
  let rows = dedupeRows(Array.isArray(args.rows) ? args.rows : []);
  const fileName = args.fileName ?? "payslips.pdf";

  const doc = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: legalOrLongFormat(pageSize),
    compress: true,
  });

  doc.setFont("helvetica", "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginX = 8;
  const marginY = 12;

  // ✅ 4 slips per page
  const slipsPerPage = 4;
  const gap = 10;

  const slipW = pageW - marginX * 2;
  const usableH = pageH - marginY * 2 - gap * (slipsPerPage - 1);
  const slipH = usableH / slipsPerPage;

  const pad = 7;

  const C_BORDER: [number, number, number] = [0, 0, 0];
  const C_SOFT_BLUE: [number, number, number] = [232, 241, 255];
  const C_SOFT_GRAY: [number, number, number] = [245, 245, 245];
  const C_SOFT_GREEN: [number, number, number] = [233, 248, 239];
  const C_TEXT_DIM: [number, number, number] = [70, 70, 70];

  function drawSlip(r: any, x: number, y: number) {
    const row = r?.data ?? r;

    setDraw(doc, C_BORDER);
    doc.setLineWidth(0.9);
    doc.rect(x, y, slipW, slipH);

    const topInset = 3;

    const innerX = x + pad;
    const innerY = y + pad + topInset;

    const innerW = slipW - pad * 2;
    const bottomY = y + slipH - pad;

    const b = parseJsonMaybe(row?.breakdown_json ?? row?.breakdownJson) ?? {};

    const employeeNameRaw = safeStr(row?.employee_name ?? row?.employeeName ?? row?.full_name ?? row?.name ?? "");
    const employeeName = (employeeNameRaw || "(NO NAME)").toUpperCase();

    const position = safeStr(row?.position_name ?? row?.position ?? row?.positionName ?? "");
    const department = safeStr(row?.department_name_snapshot ?? row?.department_name ?? row?.departmentName ?? "");

    const employeeId = safeStr(
      row?.employee_no ??
      row?.employeeNo ??
      row?.id_no ??
      row?.idNo ??
      row?.user_id ??
      row?.userId ??
      row?.id ??
      "",
    );

    const periodText = pickPeriodText(row, args.payrollPeriodLabel);

    const dailyRate = n(row?.daily_rate ?? row?.basic_daily_rate ?? 0);
    const hourlyRate = n(row?.hourly_rate ?? 0);
    const monthlyRate = n(row?.monthly_rate ?? 0);

    const daysWorked = Math.round(n(row?.total_days_worked ?? row?.days_worked ?? 0));
    const workMinutes = Math.floor(Math.max(0, n(row?.total_work_minutes ?? 0)));
    const lateMin = Math.floor(Math.max(0, n(row?.late_minutes ?? 0)));
    const undertimeMin = Math.floor(Math.max(0, n(row?.undertime_minutes ?? 0)));
    const otMin = Math.floor(Math.max(0, n(row?.overtime_minutes ?? 0)));
    const ndMin = Math.floor(Math.max(0, n(row?.night_diff_minutes ?? 0)));

    const basicPay = n(row?.basic_pay ?? 0);
    const otAmount = n(row?.ot_amount ?? 0);
    const holidayPay = n(row?.holiday_pay ?? row?.holiday ?? 0);
    const restDayAmount = n(row?.rest_day_amount ?? 0);
    const nightDiffAmount = n(row?.night_diff_amount ?? 0);

    const allowanceTotal = n(row?.allowance ?? 0);
    const manualAdditions = n(row?.manual_additions ?? 0);

    const lateDed = n(row?.late_deduction ?? 0);
    const undertimeDed = n(row?.undertime_deduction ?? 0);
    const shortageDed = n(row?.shortage_deduction ?? 0);
    const drDed = n(row?.dr_deduction ?? 0);

    const loanVale = n(row?.loan_vale ?? 0);
    const loanCar = n(row?.loan_car ?? 0);
    const loanCoop = n(row?.loan_coop ?? 0);
    const loanTotal = n(row?.loan_total ?? (loanVale + loanCar + loanCoop));

    const benSSS = n(row?.benefit_sss ?? 0);
    const benPhil = n(row?.benefit_philhealth ?? 0);
    const benPag = n(row?.benefit_pagibig ?? 0);

    const benLoanSSS = n(row?.benefit_sss_loan ?? row?.benefit_loan_sss ?? 0);
    const benLoanPag = n(row?.benefit_pagibig_loan ?? row?.benefit_loan_pagibig ?? 0);

    const benefitLoansTotal = n(b?.deductions?.benefit_loans?.total ?? (benLoanSSS + benLoanPag));
    const manualDedTotal = n(row?.manual_deductions ?? 0);

    const grossPay = n(row?.gross_pay ?? 0);
    const totalDeductions = n(row?.total_deductions ?? 0);
    const netPay = n(row?.net_pay ?? 0);

    const allowanceLines = extractAllowanceLines(b);
    const manualAdditionLines = extractManualAdditionLines(b);
    const employeeLoanLines = extractEmployeeLoanLines(row, b);
    const manualDeductionLines = extractManualDeductionLines(b);
    const benefitLoanLines = extractBenefitLoanLines(b);

    const earningsItemCount = allowanceLines.length + manualAdditionLines.length;

    const employeeLoanRule = safeStr(b?.deductions?.employee_loans?.rule ?? "50/50");
    const benefitLoanRule = safeStr(b?.deductions?.benefit_loans?.rule ?? "per cutoff");

    const earningsEntries = buildEntries(
      [
        { label: "Basic Pay", value: basicPay },
        { label: "OT Amount", value: otAmount },
        { label: "Holiday Pay", value: holidayPay },
        { label: "Rest Day Amount", value: restDayAmount },
        { label: "Night Diff", value: nightDiffAmount },
        { label: "Allowances", value: allowanceTotal },
        { label: "Manual Adds", value: manualAdditions },
      ],
      { includeZero: true },
    );

    const deductionsEntries = buildEntries(
      [
        { label: "Late", value: lateDed },
        { label: "Undertime", value: undertimeDed },
        { label: "Shortage", value: shortageDed },
        { label: "DR Payment", value: drDed },
        { label: "Emp Loans", value: loanTotal },
        { label: "SSS", value: benSSS },
        { label: "PhilHealth", value: benPhil },
        { label: "Pag-IBIG", value: benPag },
        { label: "Ben Loans", value: benefitLoansTotal },
        { label: "Manual Deds", value: manualDedTotal },
      ],
      { includeZero: true },
    );

    // ✅ slightly smaller fonts
    const fsCorp = 10.0;
    const fsName = 8.6;
    const fsBody = 6.3;
    const fsSmall = 5.8;
    const fsNet = 9.6;

    // ✅ slightly tighter rows
    const rowH = 8.6;
    const flatRowH = 8.0;

    let cy = innerY;

    // HEADER
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsCorp);
    doc.text("MEN2 MARKETING CORPORATION", innerX, cy);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    textRight(doc, `Period: ${periodText}`, innerX + innerW, cy);

    doc.setTextColor(0, 0, 0);
    cy += 12;

    // EMPLOYEE BAR
    setFill(doc, C_SOFT_BLUE);
    doc.rect(innerX, cy - 9, innerW, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsName);
    doc.text(truncateToWidth(doc, `EMPLOYEE: ${employeeName}`, innerW - 6), innerX + 3, cy);

    cy += 8;

    const leftW = innerW * 0.62;
    const rightW = innerW - leftW - 8;
    const rightX = innerX + leftW + 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text(truncateToWidth(doc, `Department: ${department || "-"}`, leftW), innerX, cy);
    textRight(doc, truncateToWidth(doc, `ID No.: ${employeeId || "-"}`, rightW), rightX + rightW, cy);

    doc.setTextColor(0, 0, 0);
    cy += 8;

    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text(truncateToWidth(doc, `Designation: ${position || "-"}`, leftW), innerX, cy);
    doc.setTextColor(0, 0, 0);

    cy += 8;

    const rates = `Rates: ${monthlyRate ? fmtMoney(monthlyRate) : "PHP 0.00"} / ${dailyRate ? fmtMoney(dailyRate) : "PHP 0.00"
      } / ${hourlyRate ? fmtMoney(hourlyRate) : "PHP 0.00"}`;

    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text(truncateToWidth(doc, rates, innerW), innerX, cy);
    doc.setTextColor(0, 0, 0);

    cy += 8;

    // METRICS + NET PAY (slightly shorter)
    const bandH = 29;
    const netW = 150;
    const gap2 = 8;
    const metricsW = innerW - netW - gap2;

    setFill(doc, C_SOFT_GRAY);
    doc.rect(innerX, cy, metricsW, bandH, "F");
    doc.rect(innerX, cy, metricsW, bandH);

    setFill(doc, C_SOFT_GREEN);
    doc.rect(innerX + metricsW + gap2, cy, netW, bandH, "F");
    doc.rect(innerX + metricsW + gap2, cy, netW, bandH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);

    const mX = innerX + 6;
    const mY = cy + 11;
    const mCol = metricsW / 3;

    const metrics = [
      ["Days Worked", String(daysWorked)],
      ["Work Minutes", String(workMinutes)],
      ["Late Min", String(lateMin)],
      ["Undertime", String(undertimeMin)],
      ["OT Min", String(otMin)],
      ["Night Diff", String(ndMin)],
    ];

    for (let i = 0; i < metrics.length; i++) {
      const cx0 = mX + (i % 3) * mCol;
      const cy0 = mY + Math.floor(i / 3) * 10.5;
      doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
      doc.text(`${metrics[i][0]}:`, cx0, cy0);
      doc.setTextColor(0, 0, 0);
      textRight(doc, metrics[i][1], cx0 + mCol - 8, cy0);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);
    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text("NET PAY", innerX + metricsW + gap2 + 8, cy + 12);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(fsNet);
    textRight(doc, fmtMoney(netPay), innerX + metricsW + gap2 + netW - 8, cy + 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(0, 0, 0);

    cy += bandH + 8;

    // LIST AREA
    const totalsH = 26;
    const totalsTopY = bottomY - totalsH;

    const listTopY = cy;
    const listBottomY = totalsTopY - 6;

    const halfGap = 8;
    const halfW = (innerW - halfGap) / 2;

    const earnHalfX = innerX;
    const dedHalfX = innerX + halfW + halfGap;

    const titleH = 12;

    setFill(doc, C_SOFT_BLUE);
    doc.rect(earnHalfX, listTopY, halfW, titleH, "F");
    doc.rect(dedHalfX, listTopY, halfW, titleH, "F");
    doc.rect(earnHalfX, listTopY, halfW, titleH);
    doc.rect(dedHalfX, listTopY, halfW, titleH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);

    const eTitle = "EARNINGS";
    const dTitle = "DEDUCTIONS";
    doc.text(eTitle, earnHalfX + halfW / 2 - doc.getTextWidth(eTitle) / 2, listTopY + 9);
    doc.text(dTitle, dedHalfX + halfW / 2 - doc.getTextWidth(dTitle) / 2, listTopY + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);

    const contentTopY = listTopY + titleH + 7;

    const totalListH = Math.max(0, listBottomY - contentTopY);

    // ✅ give itemization more room than before
    const mainAreaH = totalListH * 0.50;
    const mainMaxY = contentTopY + mainAreaH;

    const itemStartY = mainMaxY + 14;
    const itemMaxY = listBottomY;

    const cols: 1 | 2 | 3 = 3;

    // ✅ slightly wider separation between the 3 columns (helps readability)
    const innerGapCols = 8;

    // MAIN LISTS (3 columns per half)
    drawEntriesMultiColumn({
      doc,
      x0: earnHalfX,
      y0: contentTopY,
      w0: halfW,
      maxY: mainMaxY,
      rows: earningsEntries,
      cols,
      rowH,
      innerGap: innerGapCols,
      C_TEXT_DIM,
      fsBody,
    });

    drawEntriesMultiColumn({
      doc,
      x0: dedHalfX,
      y0: contentTopY,
      w0: halfW,
      maxY: mainMaxY,
      rows: deductionsEntries,
      cols,
      rowH,
      innerGap: innerGapCols,
      C_TEXT_DIM,
      fsBody,
    });

    // ITEMIZATION (still 3 columns per half)
    const earningsItems = uniqLines([
      ...allowanceLines.map((t) => `Allowance: ${t}`.replace("Allowance: ", "")),
      ...manualAdditionLines.map((t) => `MA: ${t}`.replace("MA: ", "")),
    ]);

    const dedLoanLines = uniqLines([
      ...employeeLoanLines,
      `Loans Total: ${fmtMoney(loanTotal)}`,
    ]);

    const dedBenefitLines = uniqLines([
      ...benefitLoanLines,
      `Ben Loans Total: ${fmtMoney(benefitLoansTotal)}`,
    ]);

    const dedManualLines = uniqLines([
      ...manualDeductionLines,
      ...(manualDeductionLines.length ? [] : ["(none)"]),
    ]);

    // ✅ short titles so they fit inside 3 columns
    drawItemLines3Col({
      doc,
      x0: earnHalfX,
      y0: itemStartY,
      w0: halfW,
      maxY: itemMaxY,
      cols,
      rowH: flatRowH,
      innerGap: innerGapCols,
      fsSmall,
      C_TEXT_DIM,
      title: `Itemizations (${earningsItemCount})`,
      lines: uniqLines([
        ...(allowanceLines.length ? ["Allowances:"] : []),
        ...allowanceLines,
        ...(manualAdditionLines.length ? ["Manual Adds:"] : []),
        ...manualAdditionLines,
      ]),
    });

    drawItemLines3Col({
      doc,
      x0: dedHalfX,
      y0: itemStartY,
      w0: halfW,
      maxY: itemMaxY,
      cols,
      rowH: flatRowH,
      innerGap: innerGapCols,
      fsSmall,
      C_TEXT_DIM,
      title: `Emp Loans (${employeeLoanRule || "50/50"})`,
      lines: uniqLines([
        ...dedLoanLines,
        ...(dedBenefitLines.length ? ["Ben Loans:"] : []),
        ...dedBenefitLines,
        `Manual Deds (Total: ${fmtMoney(manualDedTotal)})`,
        ...dedManualLines,
      ]),
    });

    // TOTALS FOOTER
    setFill(doc, C_SOFT_GRAY);
    doc.rect(innerX, totalsTopY, innerW, totalsH, "F");
    doc.line(innerX, totalsTopY, innerX + innerW, totalsTopY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);

    doc.text(`Gross: ${fmtMoney(grossPay)}`, innerX + 4, totalsTopY + 12);
    textRight(doc, `Total Deductions: ${fmtMoney(totalDeductions)}`, innerX + innerW - 4, totalsTopY + 12);
    doc.text(`Net: ${fmtMoney(netPay)}`, innerX + 4, totalsTopY + 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(0, 0, 0);
  }

  if (rows.length === 0) {
    doc.setFontSize(12);
    doc.text("No payslip rows to print.", 40, 60);
    doc.save(fileName);
    return;
  }

  // Explicit paging: no blank first/last pages
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
