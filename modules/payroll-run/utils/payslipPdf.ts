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

function legalOrLongFormat(pageSize: PageSize) {
  if (pageSize === "LEGAL") return "legal" as const; // 8.5 x 14
  return [612, 936] as [number, number];
}

function textRight(doc: jsPDF, txt: string, xRight: number, y: number) {
  const w = doc.getTextWidth(txt);
  doc.text(txt, xRight - w, y);
}

function truncateToWidth(doc: jsPDF, txt: string, maxW: number): string {
  if (maxW <= 0) return "";
  if (doc.getTextWidth(txt) <= maxW) return txt;
  const ell = "...";
  let s = txt;
  while (s.length > 0 && doc.getTextWidth(s + ell) > maxW) s = s.slice(0, -1);
  return s.length ? s + ell : ell;
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

// =========================
// ✅ ON-HOLD FILTER (NEW)
// =========================
function isRowOnHold(r: any): boolean {
  const row = r?.data ?? r;

  const raw =
    row?.on_hold ??
    row?.onHold ??
    row?.is_on_hold ??
    row?.isOnHold ??
    row?.hold ??
    row?.onhold ??
    0;

  const s = safeStr(raw).toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (typeof raw === "boolean") return raw;
  return n(raw) === 1;
}

// =========================
// Item extraction (pairs)
// =========================

type Pair = { label: string; value: string };
type ItemLine =
  | { t: "header"; text: string }
  | { t: "text"; text: string }
  | { t: "pair"; label: string; value: string; indent?: number; bold?: boolean };

function moneyPairsFromItems(
  items: any,
  opts: {
    defaultLabel: string;
    amountKeyCandidates: string[];
    descKeyCandidates: string[];
  },
): Pair[] {
  if (!Array.isArray(items)) return [];
  const out: Pair[] = [];

  for (const x of items) {
    const desc =
      opts.descKeyCandidates.map((k) => safeStr(x?.[k])).find((v) => !!v) ||
      opts.defaultLabel;

    const amt =
      opts.amountKeyCandidates.map((k) => n(x?.[k])).find((v) => v !== 0) ?? 0;

    if (!desc || amt === 0) continue;

    out.push({
      label: desc,
      value: fmtMoney(amt),
    });
  }

  // de-dupe identical label+value pairs
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = `${p.label}|||${p.value}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractAllowancePairs(b: any): Pair[] {
  const items = b?.earnings?.allowance_items ?? b?.earnings?.allowances ?? [];
  return moneyPairsFromItems(items, {
    defaultLabel: "Allowance",
    descKeyCandidates: ["description", "label", "name"],
    amountKeyCandidates: ["amount_this_cutoff", "amount"],
  });
}

function extractManualAdditionPairs(b: any): Pair[] {
  const items =
    b?.earnings?.manual_addition_items ?? b?.earnings?.manual_additions ?? [];
  return moneyPairsFromItems(items, {
    defaultLabel: "Manual Addition",
    descKeyCandidates: ["description", "label", "name"],
    amountKeyCandidates: ["amount"],
  });
}

/**
 * ✅ Retro Pay items from compute.ts:
 * - breakdown_json.earnings.retro_items (canonical)
 * - breakdown_json.earnings.retro_pay_items (backward compat)
 */
function extractRetroPayPairs(b: any): Pair[] {
  const items =
    b?.earnings?.retro_items ??
    b?.earnings?.retro_pay_items ??
    b?.earnings?.retroItems ??
    [];
  return moneyPairsFromItems(items, {
    defaultLabel: "Retro Pay",
    descKeyCandidates: ["description", "label", "name"],
    amountKeyCandidates: ["amount"],
  });
}

/**
 * ✅ Holiday items from compute.ts:
 * breakdown_json.earnings.holiday_items (canonical)
 *
 * We’ll use these for the 3rd column in the EARNINGS SUMMARY (top area).
 */
type Entry = { label: string; value: string };

function uniqEntries(rows: Entry[]) {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const r of rows) {
    const k = `${safeStr(r.label).toLowerCase()}|||${safeStr(r.value).toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function extractHolidayDetailEntries(b: any): Entry[] {
  const items =
    b?.earnings?.holiday_items ??
    b?.earnings?.holidayItems ??
    b?.earnings?.holiday_pay_items ??
    b?.earnings?.holidayPayItems ??
    [];

  if (!Array.isArray(items)) return [];

  const out: Entry[] = [];

  for (const h of items) {
    const total = n(h?.total ?? h?.amount ?? h?.pay_amount ?? 0);
    if (total === 0) continue;

    const dateRaw = safeStr(h?.date ?? h?.holiday_date ?? h?.holidayDate ?? "");
    const mmdd = dateRaw && dateRaw.length >= 10 ? dateRaw.slice(5, 10) : "";

    const hol = safeStr(
      h?.holiday ??
      h?.type ??
      h?.holiday_type ??
      h?.holidayType ??
      "",
    ).toUpperCase();

    const holAbbr =
      hol === "REGULAR"
        ? "RH"
        : hol === "SPECIAL"
          ? "SH"
          : hol
            ? hol.slice(0, 3)
            : "HOL";

    const isRD = !!(h?.is_rest_day ?? h?.isRestDay ?? false);

    const desc = safeStr(h?.description ?? h?.name ?? h?.label ?? "");

    // compact: "MM-DD RH+RD"
    let label = `${mmdd ? `${mmdd} ` : ""}${holAbbr}${isRD ? "+RD" : ""}`;
    if (desc) label = label; // keep ultra-compact
    label = label.trim();

    out.push({ label, value: fmtMoney(total) });
  }

  return uniqEntries(out);
}

/**
 * ✅ Manual deduction items (base only) from compute.ts:
 * breakdown_json.deductions.manual_deduction_items
 */
function extractManualDeductionGroupsPairs(b: any): {
  sh: Pair[];
  dr: Pair[];
  md: Pair[];
} {
  const items =
    b?.deductions?.manual_deduction_items ?? b?.deductions?.manual_deductions ?? [];

  if (!Array.isArray(items)) return { sh: [], dr: [], md: [] };

  const sh = moneyPairsFromItems(
    items.filter(
      (x: any) => String(x?.category ?? "").toUpperCase() === "SHORTAGE",
    ),
    {
      defaultLabel: "Shortage",
      descKeyCandidates: ["description", "label", "name"],
      amountKeyCandidates: ["amount"],
    },
  );

  const dr = moneyPairsFromItems(
    items.filter(
      (x: any) => String(x?.category ?? "").toUpperCase() === "DR_PAYMENT",
    ),
    {
      defaultLabel: "DR Payment",
      descKeyCandidates: ["description", "label", "name"],
      amountKeyCandidates: ["amount"],
    },
  );

  const md = moneyPairsFromItems(
    items.filter((x: any) => {
      const cat = String(x?.category ?? "").toUpperCase();
      return cat !== "SHORTAGE" && cat !== "DR_PAYMENT";
    }),
    {
      defaultLabel: "Manual Deduction",
      descKeyCandidates: ["description", "label", "name"],
      amountKeyCandidates: ["amount"],
    },
  );

  return { sh, dr, md };
}

/**
 * Employee loans can come from:
 * - deductions.employee_loan_items
 * - deductions.employee_loans.items
 * - deductions.items (unified)
 * - items (unified)
 * - deductions.manual_deduction_items (some implementations push everything here)
 */
function collectEmployeeLoanItems(b: any): any[] {
  const buckets: any[] = [];
  const candidates = [
    b?.deductions?.employee_loan_items,
    b?.deductions?.employee_loans?.items,
    b?.deductions?.items,
    b?.items,
    b?.deductions?.manual_deduction_items,
    b?.deductions?.other_deductions,
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr)) buckets.push(...arr);
  }

  // filter likely loan rows
  return buckets.filter((x: any) => {
    const cat = String(x?.category ?? "").toUpperCase();
    const itemKey = safeStr(x?.item_key ?? x?.itemKey ?? "");
    const desc = safeStr(x?.description ?? "");
    if (cat === "EMPLOYEE_LOAN") return true;
    if (itemKey.toUpperCase().startsWith("EL:")) return true;
    if (/employee\s*loan/i.test(desc)) return true;
    return false;
  });
}

function loanTypeUpper(x: any): string {
  const code = safeStr(
    x?.meta?.loan_type ??
    x?.loan_type ??
    x?.meta?.loanType ??
    x?.code ??
    "",
  );
  return code.toUpperCase();
}

function sumEmployeeLoans(
  items: any[],
  opts?: { onlyCoop?: boolean; excludeCoop?: boolean },
) {
  const onlyCoop = !!opts?.onlyCoop;
  const excludeCoop = !!opts?.excludeCoop;

  let total = 0;
  for (const x of items) {
    const t = loanTypeUpper(x);
    const isCoop = t === "COOP" || /COOP/i.test(safeStr(x?.description ?? ""));
    if (onlyCoop && !isCoop) continue;
    if (excludeCoop && isCoop) continue;
    total += Math.max(0, n(x?.amount ?? 0));
  }
  return total;
}

function uniqPairs(pairs: Pair[]) {
  const seen = new Set<string>();
  const out: Pair[] = [];
  for (const p of pairs) {
    const k = `${safeStr(p.label).toLowerCase()}|||${safeStr(p.value).toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function extractEmployeeLoanPairsExcludingCoop(row: any, b: any): Pair[] {
  const items = collectEmployeeLoanItems(b);

  if (items.length) {
    const out: Pair[] = [];
    for (const x of items) {
      const amt = Math.max(0, n(x?.amount ?? 0));
      if (amt === 0) continue;

      const t = loanTypeUpper(x);
      const isCoop = t === "COOP" || /COOP/i.test(safeStr(x?.description ?? ""));
      if (isCoop) continue; // ✅ COOP moved to overview as CL

      let label = t || "LOAN";
      // ultra-compact loan labels
      if (label === "CAR LOAN" || label === "CAR") label = "CAR";
      else if (label === "VALE") label = "VA";
      else if (label.length > 10) label = label.slice(0, 10);

      out.push({ label, value: fmtMoney(amt) });
    }

    return uniqPairs(out);
  }

  // fallback (exclude coop)
  const loanVale = Math.max(0, n(row?.loan_vale ?? 0));
  const loanCar = Math.max(0, n(row?.loan_car ?? 0));
  const out: Pair[] = [];
  if (loanVale) out.push({ label: "VA", value: fmtMoney(loanVale) });
  if (loanCar) out.push({ label: "CAR", value: fmtMoney(loanCar) });
  return uniqPairs(out);
}

function extractBenefitLoanPairs(b: any): Pair[] {
  const items =
    b?.deductions?.benefit_loans?.items ?? b?.deductions?.benefit_loan_items ?? [];

  if (!Array.isArray(items)) return [];

  const out: Pair[] = [];
  for (const x of items) {
    const code = safeStr(x?.benefit_code ?? x?.code ?? "").toUpperCase();
    const amt = n(
      x?.amount_this_cutoff ?? x?.amortization_amount ?? x?.amount ?? 0,
    );
    if (!code || amt === 0) continue;

    // ultra-compact labels
    const label =
      code === "SSS" ? "SSS" : code === "PAGIBIG" ? "PGB" : code.slice(0, 3);
    out.push({ label, value: fmtMoney(amt) });
  }
  return uniqPairs(out);
}

// =========================
// Overview entries renderer
// =========================

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

function fitFontSizeToWidth(
  doc: jsPDF,
  txt: string,
  maxW: number,
  fsStart: number,
  fsMin: number,
) {
  let fs = fsStart;
  doc.setFontSize(fs);
  while (fs > fsMin && doc.getTextWidth(txt) > maxW) {
    fs = Math.max(fsMin, fs - 0.2);
    doc.setFontSize(fs);
  }
  return fs;
}

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
  const {
    doc,
    x0,
    y0,
    w0,
    maxY,
    rows,
    cols,
    rowH,
    innerGap,
    C_TEXT_DIM,
    fsBody,
  } = args;
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

    // spacer rows
    const isSpacer = safeStr(it.label) === "" && safeStr(it.value) === "";
    if (isSpacer) continue;

    // never truncate amount: allocate remaining width to label
    doc.setFontSize(fsBody);
    const value = it.value;
    const valueW = doc.getTextWidth(value);
    const gap = 4;

    let valueFs = fsBody;
    if (valueW > colW - 2) {
      valueFs = fitFontSizeToWidth(
        doc,
        value,
        colW - 2,
        fsBody,
        Math.max(4.8, fsBody - 1.2),
      );
    } else {
      doc.setFontSize(fsBody);
    }

    const finalValueW = doc.getTextWidth(value);
    const labelMaxW = Math.max(10, colW - finalValueW - gap);
    doc.setFontSize(fsBody);

    const label = truncateToWidth(doc, it.label, labelMaxW);

    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text(label, xx, yy);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(valueFs);
    textRight(doc, value, xx + colW, yy);

    doc.setFontSize(fsBody);
  }

  doc.setTextColor(0, 0, 0);
}

// =========================
// Itemization renderer (3-col, amount-safe)
// =========================

type ItemLine =
  | { t: "header"; text: string }
  | { t: "text"; text: string }
  | { t: "pair"; label: string; value: string; indent?: number; bold?: boolean };

function drawItemLines3ColCompact(args: {
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
  lines: ItemLine[];
  title: string;
}) {
  const {
    doc,
    x0,
    y0,
    w0,
    maxY,
    cols,
    rowH,
    innerGap,
    fsSmall,
    C_TEXT_DIM,
    lines,
    title,
  } = args;
  if (maxY < y0) return;

  // dashed separator
  doc.setLineDash([1.5, 2], 0);
  doc.line(x0, y0 - 8, x0 + w0, y0 - 8);
  doc.setLineDash([], 0);

  const availH = Math.max(0, maxY - y0);
  const rowsPerCol = Math.max(0, Math.floor(availH / rowH) + 1);
  if (rowsPerCol <= 0) return;

  const colW = cols === 1 ? w0 : (w0 - innerGap * (cols - 1)) / cols;

  const all: ItemLine[] = [{ t: "header", text: title }, ...lines];
  const cap = rowsPerCol * cols;
  const drawRows = all.slice(0, cap);

  doc.setFontSize(fsSmall);

  for (let i = 0; i < drawRows.length; i++) {
    const colIdx = cols === 1 ? 0 : Math.floor(i / rowsPerCol);
    const rowIdx = cols === 1 ? i : i % rowsPerCol;

    const xx = x0 + colIdx * (colW + innerGap);
    const yy = y0 + rowIdx * rowH;
    if (yy > maxY) continue;

    const ln = drawRows[i];

    if (ln.t === "header") {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
      doc.setFontSize(fsSmall);
      doc.text(truncateToWidth(doc, ln.text, colW), xx, yy);
      continue;
    }

    if (ln.t === "text") {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
      doc.setFontSize(fsSmall);
      doc.text(truncateToWidth(doc, ln.text, colW), xx, yy);
      continue;
    }

    if (ln.t === "pair") {
      const indent = Math.max(0, ln.indent ?? 8);

      // amount-safe rendering
      const value = ln.value;
      doc.setFont("helvetica", ln.bold ? "bold" : "normal");
      doc.setFontSize(fsSmall);

      let valueFs = fsSmall;
      const valueW0 = doc.getTextWidth(value);
      if (valueW0 > colW - 2) {
        valueFs = fitFontSizeToWidth(
          doc,
          value,
          colW - 2,
          fsSmall,
          Math.max(4.6, fsSmall - 1.2),
        );
      } else {
        doc.setFontSize(fsSmall);
      }

      const valueW = doc.getTextWidth(value);
      const gap = 4;
      const labelMaxW = Math.max(10, colW - valueW - gap - indent);

      doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
      doc.setFontSize(fsSmall);
      const label = truncateToWidth(doc, ln.label, labelMaxW);
      doc.text(label, xx + indent, yy);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(valueFs);
      textRight(doc, value, xx + colW, yy);

      doc.setFontSize(fsSmall);
      continue;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
}

// =========================
// main export
// =========================

export async function downloadPayslipsPdf(args: {
  rows: any[];
  payrollPeriodLabel: string;
  pageSize?: PageSize;
  fileName?: string;
}) {
  const pageSize: PageSize = args.pageSize ?? "LEGAL";
  const fileName = args.fileName ?? "payslips.pdf";

  // ✅ FILTER OUT ON-HOLD ROWS (NEW)
  const filtered = (Array.isArray(args.rows) ? args.rows : []).filter(
    (r) => !isRowOnHold(r),
  );

  // ✅ de-dupe AFTER filtering
  const rows = dedupeRows(filtered);

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

  // slightly tighter
  const pad = 6;

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

    const topInset = 2;

    const innerX = x + pad;
    const innerY = y + pad + topInset;

    const innerW = slipW - pad * 2;
    const bottomY = y + slipH - pad;

    const b = parseJsonMaybe(row?.breakdown_json ?? row?.breakdownJson) ?? {};

    const payrollId = safeStr(
      row?.payroll_run_employee_id ??
      row?.payrollRunEmployeeId ??
      row?.pre_id ??
      row?.id ??
      "-",
    );

    const employeeNameRaw = safeStr(
      row?.employee_name ??
      row?.employeeName ??
      row?.full_name ??
      row?.name ??
      "",
    );
    const employeeName = (employeeNameRaw || "(NO NAME)").toUpperCase();

    const position = safeStr(
      row?.position_name ?? row?.position ?? row?.positionName ?? "",
    );
    const department = safeStr(
      row?.department_name_snapshot ??
      row?.department_name ??
      row?.departmentName ??
      "",
    );

    const employeeId = safeStr(
      row?.employee_no ??
      row?.employeeNo ??
      row?.id_no ??
      row?.idNo ??
      row?.user_id ??
      row?.userId ??
      "",
    );

    const periodText = pickPeriodText(row, args.payrollPeriodLabel);

    const dailyRate = n(row?.daily_rate ?? row?.basic_daily_rate ?? 0);
    const hourlyRate = n(row?.hourly_rate ?? 0);
    const monthlyRate = n(row?.monthly_rate ?? 0);

    const daysWorked = Math.round(
      n(row?.total_days_worked ?? row?.days_worked ?? 0),
    );
    const workMinutes = Math.floor(Math.max(0, n(row?.total_work_minutes ?? 0)));
    const lateMin = Math.floor(Math.max(0, n(row?.late_minutes ?? 0)));
    const undertimeMin = Math.floor(
      Math.max(0, n(row?.undertime_minutes ?? 0)),
    );
    const otMin = Math.floor(Math.max(0, n(row?.overtime_minutes ?? 0)));
    const ndMin = Math.floor(Math.max(0, n(row?.night_diff_minutes ?? 0)));

    const basicPay = n(row?.basic_pay ?? 0);
    const otAmount = n(row?.ot_amount ?? 0);
    const holidayPay = n(row?.holiday_pay ?? row?.holiday ?? 0);
    const restDayAmount = n(row?.rest_day_amount ?? 0);
    const nightDiffAmount = n(row?.night_diff_amount ?? 0);

    const allowanceTotal = n(row?.allowance ?? 0);
    const manualAdditions = n(row?.manual_additions ?? 0);

    const retroPayTotal = n(
      row?.retro_pay ?? row?.retroPay ?? b?.earnings?.retro_pay ?? 0,
    );

    const lateDed = n(row?.late_deduction ?? 0);
    const undertimeDed = n(row?.undertime_deduction ?? 0);
    const shortageDed = n(row?.shortage_deduction ?? 0);
    const drDed = n(row?.dr_deduction ?? 0);

    // employee loan totals (raw)
    const loanVale = n(row?.loan_vale ?? 0);
    const loanCar = n(row?.loan_car ?? 0);
    const loanCoopLegacy = n(row?.loan_coop ?? 0);

    const loanTotalRaw = n(
      row?.loan_total ?? loanVale + loanCar + loanCoopLegacy,
    );

    // ✅ derive COOP loan from breakdown employee-loan items (COOP), fallback to legacy fields
    const employeeLoanItems = collectEmployeeLoanItems(b);
    const coopLoanFromItems = sumEmployeeLoans(employeeLoanItems, {
      onlyCoop: true,
    });
    const coopLoanTotal =
      coopLoanFromItems !== 0
        ? coopLoanFromItems
        : n(row?.coop_loan ?? row?.coopLoan ?? b?.deductions?.coop_loan ?? 0);

    // total employee loans (prefer row loan_total, else derive from items, else fallback)
    const empLoansFromItemsAll = employeeLoanItems.length
      ? sumEmployeeLoans(employeeLoanItems)
      : 0;
    const empLoansAll =
      loanTotalRaw !== 0
        ? loanTotalRaw
        : empLoansFromItemsAll !== 0
          ? empLoansFromItemsAll
          : loanVale + loanCar + loanCoopLegacy;

    // ✅ EL shown without COOP (COOP goes to overview as CL)
    const empLoansExCoop = Math.max(0, empLoansAll - coopLoanTotal);

    const coopSavingsTotal = n(
      row?.coop_savings ??
      row?.coopSavings ??
      row?.coop_savings_membership ??
      b?.deductions?.coop_savings ??
      0,
    );

    const benSSS = n(row?.benefit_sss ?? 0);
    const benPhil = n(row?.benefit_philhealth ?? 0);
    const benPag = n(row?.benefit_pagibig ?? 0);

    const benefitLoansTotal = n(
      b?.deductions?.benefit_loans?.total ?? row?.benefit_loan_total ?? 0,
    );
    const manualDedTotal = n(row?.other_deductions ?? 0);

    const grossPay = n(row?.gross_pay ?? 0);
    const totalDeductions = n(row?.total_deductions ?? 0);
    const netPay = n(row?.net_pay ?? 0);

    // ✅ item pairs (compact)
    const allowancePairs = extractAllowancePairs(b);
    const manualAdditionPairs = extractManualAdditionPairs(b);
    const retroPairs = extractRetroPayPairs(b);

    const { sh, dr, md } = extractManualDeductionGroupsPairs(b);
    const employeeLoanPairs = extractEmployeeLoanPairsExcludingCoop(row, b); // ✅ excludes coop
    const benefitLoanPairs = extractBenefitLoanPairs(b);

    // ✅ Holiday detail entries (for 3rd column of earnings summary)
    const holidayDetailEntries = extractHolidayDetailEntries(b);

    // ✅ ultra-compact overview labels
    const baseEarningsEntries = buildEntries(
      [
        { label: "BASIC PAY", value: basicPay },
        { label: "OVERTIME", value: otAmount },
        { label: "HOLIDAY PAY", value: holidayPay },
        { label: "REST DAY", value: restDayAmount },
        { label: "NIGHT DIFF", value: nightDiffAmount },
        { label: "ALLOWANCE", value: allowanceTotal },
        { label: "RETRO", value: retroPayTotal },
        { label: "MANUAL ADDS", value: manualAdditions },
      ],
      { includeZero: true },
    );

    const deductionsEntries = buildEntries(
      [
        { label: "LATE", value: lateDed },
        { label: "UT", value: undertimeDed },
        { label: "SHORTAGE", value: shortageDed },
        { label: "DR PAY", value: drDed },
        { label: "ELoans", value: empLoansExCoop },
        { label: "CSavings", value: coopSavingsTotal },
        { label: "CLoans", value: coopLoanTotal }, // ✅ COOP employee-loan sum lives here
        { label: "SSS", value: benSSS },
        { label: "PHILHEALTH", value: benPhil },
        { label: "PAG-IBIG", value: benPag },
        { label: "BLoans", value: benefitLoansTotal },
        { label: "MANUAL DEDS", value: manualDedTotal },
      ],
      { includeZero: true },
    );

    // ultra-compact fonts
    const fsCorp = 9.6;
    const fsName = 8.4;
    const fsBody = 6.1;
    const fsSmall = 5.3;
    const fsNet = 9.4;

    const rowH = 8.1;
    const flatRowH = 7.6;

    let cy = innerY;

    // HEADER
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsCorp);
    doc.text("MEN2 MARKETING CORPORATION", innerX, cy);

    cy += 9.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);

    doc.text(`Payroll ID: ${payrollId || "-"}`, innerX, cy);
    textRight(doc, `Period: ${periodText}`, innerX + innerW, cy);

    doc.setTextColor(0, 0, 0);
    cy += 11;

    // EMPLOYEE BAR
    setFill(doc, C_SOFT_BLUE);
    doc.rect(innerX, cy - 9, innerW, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsName);
    doc.text(
      truncateToWidth(doc, `EMPLOYEE: ${employeeName}`, innerW - 6),
      innerX + 3,
      cy,
    );

    cy += 7.5;

    const leftW = innerW * 0.62;
    const rightW = innerW - leftW - 8;
    const rightX = innerX + leftW + 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text(
      truncateToWidth(doc, `Department: ${department || "-"}`, leftW),
      innerX,
      cy,
    );
    textRight(
      doc,
      truncateToWidth(doc, `ID No.: ${employeeId || "-"}`, rightW),
      rightX + rightW,
      cy,
    );

    doc.setTextColor(0, 0, 0);
    cy += 7.6;

    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text(
      truncateToWidth(doc, `Designation: ${position || "-"}`, leftW),
      innerX,
      cy,
    );
    doc.setTextColor(0, 0, 0);

    cy += 7.6;

    const rates = `Rates: ${monthlyRate ? fmtMoney(monthlyRate) : "PHP 0.00"
      } / ${dailyRate ? fmtMoney(dailyRate) : "PHP 0.00"} / ${hourlyRate ? fmtMoney(hourlyRate) : "PHP 0.00"
      }`;

    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text(truncateToWidth(doc, rates, innerW), innerX, cy);
    doc.setTextColor(0, 0, 0);

    cy += 7.6;

    // METRICS + NET PAY
    const bandH = 27;
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
    const mY = cy + 10.5;
    const mCol = metricsW / 3;

    const metrics = [
      ["Days", String(daysWorked)],
      ["Min", String(workMinutes)],
      ["Late", String(lateMin)],
      ["UT", String(undertimeMin)],
      ["OT", String(otMin)],
      ["ND", String(ndMin)],
    ];

    for (let i = 0; i < metrics.length; i++) {
      const cx0 = mX + (i % 3) * mCol;
      const cy0 = mY + Math.floor(i / 3) * 10.0;
      doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
      doc.text(`${metrics[i][0]}:`, cx0, cy0);
      doc.setTextColor(0, 0, 0);
      textRight(doc, metrics[i][1], cx0 + mCol - 8, cy0);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);
    doc.setTextColor(C_TEXT_DIM[0], C_TEXT_DIM[1], C_TEXT_DIM[2]);
    doc.text("NET PAY", innerX + metricsW + gap2 + 8, cy + 11.5);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(fsNet);
    textRight(
      doc,
      fmtMoney(netPay),
      innerX + metricsW + gap2 + netW - 8,
      cy + 23.5,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(0, 0, 0);

    cy += bandH + 7;

    // LIST AREA
    const totalsH = 25;
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
    doc.text(
      eTitle,
      earnHalfX + halfW / 2 - doc.getTextWidth(eTitle) / 2,
      listTopY + 9,
    );
    doc.text(
      dTitle,
      dedHalfX + halfW / 2 - doc.getTextWidth(dTitle) / 2,
      listTopY + 9,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);

    const contentTopY = listTopY + titleH + 6;
    const totalListH = Math.max(0, listBottomY - contentTopY);

    const mainAreaH = totalListH * 0.5;
    const mainMaxY = contentTopY + mainAreaH;

    const itemStartY = mainMaxY + 13;
    const itemMaxY = listBottomY;

    const cols: 1 | 2 | 3 = 3;
    const innerGapCols = 8;

    // ✅ push holiday items into the 3rd column of the earnings summary
    let earningsEntries: Entry[] = baseEarningsEntries;
    if (holidayDetailEntries.length) {
      const availH = Math.max(0, mainMaxY - contentTopY);
      const rowsPerCol = Math.max(0, Math.floor(availH / rowH) + 1);
      const fillTwoCols = rowsPerCol * 2;

      const padded = [...baseEarningsEntries];
      const padCount = Math.max(0, fillTwoCols - padded.length);

      for (let i = 0; i < padCount; i++) padded.push({ label: "", value: "" });

      padded.push(...holidayDetailEntries);
      earningsEntries = padded;
    }

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

    // ======================
    // ITEMIZATION (ULTRA COMPACT)
    // ======================

    const earnLines: ItemLine[] = [];

    if (allowancePairs.length) {
      earnLines.push({ t: "text", text: "ALLOWANCE:" });
      for (const p of allowancePairs)
        earnLines.push({ t: "pair", label: p.label, value: p.value, indent: 10 });
    }
    if (retroPairs.length) {
      earnLines.push({ t: "text", text: "RETRO:" });
      for (const p of retroPairs)
        earnLines.push({ t: "pair", label: p.label, value: p.value, indent: 10 });
    }
    if (manualAdditionPairs.length) {
      earnLines.push({ t: "text", text: "MANUAL ADDS:" });
      for (const p of manualAdditionPairs)
        earnLines.push({ t: "pair", label: p.label, value: p.value, indent: 10 });
    }
    if (!earnLines.length) earnLines.push({ t: "text", text: "(none)" });

    const dedLines: ItemLine[] = [];

    if (sh.length) {
      dedLines.push({ t: "text", text: "SHORTAGE:" });
      for (const p of sh)
        dedLines.push({ t: "pair", label: p.label, value: p.value, indent: 10 });
    }
    if (dr.length) {
      dedLines.push({ t: "text", text: "DR:" });
      for (const p of dr)
        dedLines.push({ t: "pair", label: p.label, value: p.value, indent: 10 });
    }
    if (md.length) {
      dedLines.push({ t: "text", text: "MANUAL DEDS:" });
      for (const p of md)
        dedLines.push({ t: "pair", label: p.label, value: p.value, indent: 10 });
    }

    // ✅ NO COOP SAVINGS ITEMIZATION (requested)

    if (employeeLoanPairs.length) {
      dedLines.push({ t: "text", text: "ELOANS:" });
      for (const p of employeeLoanPairs)
        dedLines.push({ t: "pair", label: p.label, value: p.value, indent: 10 });
    }

    if (benefitLoanPairs.length) {
      dedLines.push({ t: "text", text: "BLOANS:" });
      for (const p of benefitLoanPairs)
        dedLines.push({ t: "pair", label: p.label, value: p.value, indent: 10 });
    }

    if (!dedLines.length) dedLines.push({ t: "text", text: "(none)" });

    drawItemLines3ColCompact({
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
      title: "Itemization",
      lines: earnLines,
    });

    drawItemLines3ColCompact({
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
      title: "Itemization",
      lines: dedLines,
    });

    // TOTALS FOOTER
    setFill(doc, C_SOFT_GRAY);
    doc.rect(innerX, totalsTopY, innerW, totalsH, "F");
    doc.line(innerX, totalsTopY, innerX + innerW, totalsTopY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);

    doc.text(`Gross: ${fmtMoney(grossPay)}`, innerX + 4, totalsTopY + 12);
    textRight(
      doc,
      `Total Deds: ${fmtMoney(totalDeductions)}`,
      innerX + innerW - 4,
      totalsTopY + 12,
    );
    doc.text(`Net: ${fmtMoney(netPay)}`, innerX + 4, totalsTopY + 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(0, 0, 0);
  }

  // ✅ If all rows are on-hold (or empty), show message and exit
  if (rows.length === 0) {
    doc.setFontSize(12);
    doc.text("No payslip rows to print (on-hold rows excluded).", 40, 60);
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
