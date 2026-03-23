// modules/payroll-records/utils/tapSheetPdf.ts
import jsPDF from "jspdf";
import type { TapSheetRow } from "../types";

type Totals = { gross: number; adds: number; deds: number; net: number };

let fontInitPromise: Promise<boolean> | null = null;

function toNum(v: unknown): number {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
}

/** Format number ONLY (no currency symbol) */
function formatAmountOnly(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  try {
    return x.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

/** 
 * Show whole numbers without decimals (12), 
 * but fractionals with up to 2 (12.5) 
 */
function formatSmartDecimal(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  if (Number.isInteger(x)) return x.toString();
  return x.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Format date to MMM D, YYYY */
function fmtDate(iso: string) {
  if (!iso || iso === "-") return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  if (typeof btoa === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  const B = (globalThis as unknown as { Buffer: { from: (b: Uint8Array) => { toString: (e: string) => string } } }).Buffer;
  if (B) return B.from(bytes).toString("base64");
  throw new Error("Base64 encoder not available.");
}

/**
 * Loads a font that supports ₱ (Peso sign) so we don't get "±".
 * Put these files in:
 *   public/fonts/Inter-Regular.ttf
 *   public/fonts/Inter-Bold.ttf
 */
async function ensurePesoFont(doc: jsPDF): Promise<boolean> {
  if (fontInitPromise) return fontInitPromise;

  fontInitPromise = (async () => {
    try {
      const anyDoc = doc as unknown as {
        addFileToVFS: (f: string, c: string) => void;
        addFont: (f: string, n: string, s: string) => void;
      };
      if (!anyDoc.addFileToVFS || !anyDoc.addFont) return false;

      const [regRes, boldRes] = await Promise.all([
        fetch("/fonts/Inter-Regular.ttf", { cache: "no-store" }),
        fetch("/fonts/Inter-Bold.ttf", { cache: "no-store" }),
      ]);

      if (!regRes.ok || !boldRes.ok) return false;

      const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);

      anyDoc.addFileToVFS("Inter-Regular.ttf", arrayBufferToBase64(regBuf));
      anyDoc.addFileToVFS("Inter-Bold.ttf", arrayBufferToBase64(boldBuf));
      anyDoc.addFont("Inter-Regular.ttf", "Inter", "normal");
      anyDoc.addFont("Inter-Bold.ttf", "Inter", "bold");

      return true;
    } catch {
      return false;
    }
  })();

  return fontInitPromise;
}

function fitTextEllipsis(doc: jsPDF, text: string, maxW: number) {
  const s = (text ?? "").toString();
  if (!s) return "";
  if (doc.getTextWidth(s) <= maxW) return s;

  const ell = "…";
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = s.slice(0, mid) + ell;
    if (doc.getTextWidth(candidate) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, Math.max(0, lo)) + ell;
}

function drawRightFitted(args: {
  doc: jsPDF;
  text: string;
  xRight: number;
  y: number;
  maxW: number;
  baseSize: number;
  minSize?: number;
  fontFamily: string;
  fontStyle: "normal" | "bold";
  color?: { r: number; g: number; b: number };
}) {
  const { doc, text, xRight, y, maxW, baseSize, minSize = 6.5, fontFamily, fontStyle, color } = args;

  let size = baseSize;
  doc.setFont(fontFamily, fontStyle);
  doc.setFontSize(size);
  if (color) doc.setTextColor(color.r, color.g, color.b);

  while (doc.getTextWidth(text) > maxW && size > minSize) {
    size -= 0.5;
    doc.setFontSize(size);
  }

  doc.text(text, xRight, y, { align: "right" });
}

export async function buildTapSheetPdf(args: {
  companyName?: string;
  departmentName: string;
  cutoffStart: string;
  cutoffEnd: string;
  rows: TapSheetRow[];
  totals: Totals;
  filterType: "ALL" | "BANK" | "CASH";
  payrollRefNo?: string;
  postedAt?: string;
}) {
  // LEGAL paper
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "legal" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginX = 34;
  const marginTop = 22;
  const marginBottom = 34;

  // palette
  const ACCENT = { r: 16, g: 54, b: 98 };
  const ACCENT_SOFT = { r: 236, g: 242, b: 252 };
  const GRID = { r: 210, g: 218, b: 230 };
  const TEXT_MUTED = { r: 70, g: 75, b: 85 };

  // font
  const fontOk = await ensurePesoFont(doc);
  const fontFamily = fontOk ? "Inter" : "helvetica";
  const currencyPrefix = fontOk ? "₱" : "PHP";

  // ABS, no +/- sign
  const peso = (v: unknown) => `${currencyPrefix} ${formatAmountOnly(Math.abs(toNum(v)))}`;

  // Conditional Column Logic
  const showTypeCol = args.filterType === "ALL";

  // columns (avoid overflow)
  const availableW = pageW - marginX * 2;

  const colAmtW = 62;
  const colTypeW = showTypeCol ? 40 : 0;
  const colIdW = 32;
  const colDaysW = 32;
  const colHoursW = 34;
  
  const colNameW = availableW - colTypeW - colIdW - colDaysW - colHoursW - colAmtW * 4;

  const x0 = marginX;
  const xName = x0;
  const xId = xName + colNameW;
  const xDays = xId + colIdW;
  const xHours = xDays + colDaysW;
  const xType = xHours + colHoursW; // if colTypeW is 0, this is start of Gross
  const xGross = xType + colTypeW;
  const xAdds = xGross + colAmtW;
  const xDeds = xAdds + colAmtW;
  const xNet = xDeds + colAmtW;
  const xEnd = x0 + availableW;

  const headerBandH = 30;
  const tableStartY = 155;

  const rowH = 14;

  const drawFooter = (pageNo: number) => {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text(`Page ${pageNo}`, pageW - marginX, pageH - 18, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  const drawHeader = () => {
    // 1. Primary Header Band (Accent Blue)
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.rect(0, 0, pageW, headerBandH + 10, "F");

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    const companyLabel = (args.companyName || "").toUpperCase();
    doc.text(companyLabel, pageW / 2, marginTop + 16, { align: "center" });

    // 2. Document Title (Subtle Ribbon)
    const titleY = headerBandH + 18;
    doc.setFillColor(ACCENT_SOFT.r, ACCENT_SOFT.g, ACCENT_SOFT.b);
    doc.setDrawColor(GRID.r, GRID.g, GRID.b);
    doc.roundedRect(pageW / 2 - 70, titleY, 140, 20, 2, 2, "FD");

    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.setFontSize(10);
    doc.setFont(fontFamily, "bold");
    doc.text("TOP SHEET REPORT", pageW / 2, titleY + 14, { align: "center" });

    // 3. Metadata Grid
    const gridY = titleY + 42;
    doc.setTextColor(0, 0, 0);

    // Left Column: Core Identity
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(9);
    doc.text("DEPARTMENT:", x0, gridY);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(10);
    const deptDisplayName = (args.departmentName || "ALL DEPARTMENTS").toUpperCase();
    doc.text(deptDisplayName, x0 + 72, gridY);

    const cutoffLabel = `PERIOD: ${fmtDate(args.cutoffStart)} — ${fmtDate(args.cutoffEnd)}`;
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text(cutoffLabel, x0, gridY + 16);

    // Right Column: Summary Stats
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("EMPLOYEES:", xEnd - 22, gridY, { align: "right" });
    doc.setFontSize(11);
    doc.text(String(args.rows.length), xEnd, gridY, { align: "right" });

    // Payment Filter (if single)
    if (!showTypeCol) {
      doc.setFont(fontFamily, "bold");
      doc.setFontSize(8);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text(`MODE: ${args.filterType.toUpperCase()}`, xEnd, gridY + 15, { align: "right" });
    }

    // 4. Administrative Footer (Small/Muted)
    const adminY = gridY + 30;
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED.r * 1.2, TEXT_MUTED.g * 1.2, TEXT_MUTED.b * 1.2);
    doc.text(`PAYROLL ID: ${args.payrollRefNo || "N/A"}`, x0, adminY);
    doc.text(`POSTED ON: ${fmtDate(args.postedAt || "-")}`, xEnd, adminY, { align: "right" });

    // Main separator
    doc.setDrawColor(GRID.r, GRID.g, GRID.b);
    doc.setLineWidth(1);
    doc.line(x0, adminY + 8, xEnd, adminY + 8);
  };

  const drawTableHeader = (y: number) => {
    doc.setFillColor(ACCENT_SOFT.r, ACCENT_SOFT.g, ACCENT_SOFT.b);
    doc.setDrawColor(GRID.r, GRID.g, GRID.b);
    doc.setLineWidth(0.6);
    doc.rect(x0, y, availableW, rowH, "FD");

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(8);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);

    const ty = y + 11;
    doc.text("EMPLOYEE NAME", xName + 6, ty);

    doc.text("ID", xId + 3, ty);
    doc.text("DAYS", xDays + 3, ty);
    doc.text("HOURS", xHours + 3, ty);

    if (showTypeCol) {
      doc.text("TYPE", xType + 3, ty);
    }

    doc.text("GROSS PAY", xGross + colAmtW - 6, ty, { align: "right" });
    doc.text("ADDITIONS", xAdds + colAmtW - 6, ty, { align: "right" });
    doc.text("DEDUCTIONS", xDeds + colAmtW - 6, ty, { align: "right" });
    doc.text("NET PAY", xNet + colAmtW - 6, ty, { align: "right" });

    doc.setDrawColor(GRID.r, GRID.g, GRID.b);
    doc.setLineWidth(0.6);

    doc.line(xId, y, xId, y + rowH);
    doc.line(xDays, y, xDays, y + rowH);
    doc.line(xHours, y, xHours, y + rowH);

    if (showTypeCol) {
      doc.line(xType, y, xType, y + rowH);
    }

    doc.line(xGross, y, xGross, y + rowH);
    doc.line(xAdds, y, xAdds, y + rowH);
    doc.line(xDeds, y, xDeds, y + rowH);
    doc.line(xNet, y, xNet, y + rowH);

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    return y + rowH;
  };

  const drawRow = (y: number, r: TapSheetRow, zebra: boolean) => {
    if (zebra) {
      doc.setFillColor(252, 253, 255);
      doc.rect(x0, y, availableW, rowH, "F");
    }

    doc.setDrawColor(GRID.r, GRID.g, GRID.b);
    doc.setLineWidth(0.4);
    doc.rect(x0, y, availableW, rowH);

    doc.line(xId, y, xId, y + rowH);
    doc.line(xDays, y, xDays, y + rowH);
    doc.line(xHours, y, xHours, y + rowH);

    if (showTypeCol) {
      doc.line(xType, y, xType, y + rowH);
    }

    doc.line(xGross, y, xGross, y + rowH);
    doc.line(xAdds, y, xAdds, y + rowH);
    doc.line(xDeds, y, xDeds, y + rowH);
    doc.line(xNet, y, xNet, y + rowH);

    const ty = y + 11;

    // name
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(0, 0, 0);
    const name = fitTextEllipsis(doc, r.name_display ?? "", colNameW - 10);
    doc.text(name, xName + 5, ty);

    // ID / stats
    doc.setFontSize(6.8);
    doc.text(r.employee_no, xId + 3, ty);
    doc.text(formatSmartDecimal(r.days_worked), xDays + 3, ty);
    doc.text(formatSmartDecimal(r.work_hours), xHours + 3, ty);

    // type
    if (showTypeCol) {
      doc.setFontSize(6.8);
      const type = r.payment_type === "BANK" ? "BANK" : "CASH";
      doc.text(type, xType + 3, ty);
    }

    // amounts: smaller font
    const maxAmtW = colAmtW - 10;

    drawRightFitted({
      doc,
      text: peso(r.gross_pay),
      xRight: xGross + colAmtW - 5,
      y: ty,
      maxW: maxAmtW,
      baseSize: 7,
      minSize: 6,
      fontFamily,
      fontStyle: "normal",
      color: TEXT_MUTED,
    });

    drawRightFitted({
      doc,
      text: peso(r.total_additions),
      xRight: xAdds + colAmtW - 5,
      y: ty,
      maxW: maxAmtW,
      baseSize: 7,
      minSize: 6,
      fontFamily,
      fontStyle: "normal",
      color: TEXT_MUTED,
    });

    drawRightFitted({
      doc,
      text: peso(r.total_deductions),
      xRight: xDeds + colAmtW - 5,
      y: ty,
      maxW: maxAmtW,
      baseSize: 7,
      minSize: 6,
      fontFamily,
      fontStyle: "normal",
      color: TEXT_MUTED,
    });

    // net: bold accent, still small-ish
    drawRightFitted({
      doc,
      text: peso(r.net_pay),
      xRight: xNet + colAmtW - 5,
      y: ty,
      maxW: maxAmtW,
      baseSize: 7,
      minSize: 6,
      fontFamily,
      fontStyle: "bold",
      color: ACCENT,
    });

    doc.setTextColor(0, 0, 0);
  };

  const drawTotals = (y: number) => {
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.rect(x0, y, availableW, rowH + 2, "F");

    doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.setLineWidth(0.8);

    doc.line(xId, y, xId, y + rowH + 2);
    doc.line(xDays, y, xDays, y + rowH + 2);
    doc.line(xHours, y, xHours, y + rowH + 2);

    if (showTypeCol) {
      doc.line(xType, y, xType, y + rowH + 2);
    }

    doc.line(xGross, y, xGross, y + rowH + 2);
    doc.line(xAdds, y, xAdds, y + rowH + 2);
    doc.line(xDeds, y, xDeds, y + rowH + 2);
    doc.line(xNet, y, xNet, y + rowH + 2);

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    const ty = y + 12;
    doc.text("TOTAL", xName + 6, ty);
    // Removed count from footer per user request

    const maxAmtW = colAmtW - 12;

    drawRightFitted({
      doc,
      text: peso(args.totals.gross),
      xRight: xGross + colAmtW - 6,
      y: ty,
      maxW: maxAmtW,
      baseSize: 7.5,
      minSize: 6.5,
      fontFamily,
      fontStyle: "bold",
      color: { r: 255, g: 255, b: 255 },
    });

    drawRightFitted({
      doc,
      text: peso(args.totals.adds),
      xRight: xAdds + colAmtW - 6,
      y: ty,
      maxW: maxAmtW,
      baseSize: 7.5,
      minSize: 6.5,
      fontFamily,
      fontStyle: "bold",
      color: { r: 255, g: 255, b: 255 },
    });

    drawRightFitted({
      doc,
      text: peso(args.totals.deds),
      xRight: xDeds + colAmtW - 6,
      y: ty,
      maxW: maxAmtW,
      baseSize: 7.5,
      minSize: 6.5,
      fontFamily,
      fontStyle: "bold",
      color: { r: 255, g: 255, b: 255 },
    });

    drawRightFitted({
      doc,
      text: peso(args.totals.net),
      xRight: xNet + colAmtW - 6,
      y: ty,
      maxW: maxAmtW,
      baseSize: 7.5,
      minSize: 6.5,
      fontFamily,
      fontStyle: "bold",
      color: { r: 255, g: 255, b: 255 },
    });

    doc.setTextColor(0, 0, 0);
    return y + rowH + 2;
  };

  // ... rest of logic
  const ensureSpace = (y: number, needH: number, pageNoRef: { v: number }) => {
    const limit = pageH - marginBottom;
    if (y + needH <= limit) return y;

    drawFooter(pageNoRef.v);
    doc.addPage();
    pageNoRef.v += 1;

    drawHeader();
    let ny = tableStartY;
    ny = drawTableHeader(ny);
    return ny;
  };

  const pageNo = { v: 1 };
  drawHeader();

  let y = tableStartY;
  y = drawTableHeader(y);

  let zebra = false;
  for (const r of args.rows) {
    y = ensureSpace(y, rowH, pageNo);
    drawRow(y, r, zebra);
    zebra = !zebra;
    y += rowH;
  }

  y = ensureSpace(y, rowH + 6, pageNo);
  y = drawTotals(y);

  drawFooter(pageNo.v);

  return doc;
}
