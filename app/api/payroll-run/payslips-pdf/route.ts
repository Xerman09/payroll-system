// app/api/payroll-run/payslips-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig } from "@/lib/api-helper";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, unknown>;

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function money(v: unknown): string {
  const x = n(v);
  return `₱${x.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function s(v: unknown): string {
  return String(v ?? "");
}

type BreakdownData = Record<string, unknown> & {
  earnings?: {
    allowance_items?: unknown[];
    allowanceItems?: unknown[];
    manual_additions_items?: unknown[];
    manualAdditionsItems?: unknown[];
    manual_items?: unknown[];
  };
};

function parseJsonMaybe(v: unknown): BreakdownData | null {
  if (!v) return null;
  if (typeof v === "object") return v as BreakdownData;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as BreakdownData;
    } catch {
      return null;
    }
  }
  return null;
}

async function readBody(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function baseUrl() {
  const config = await resolveApiConfig();
  if (!config) return "";
  const b = config.apiBase;
  return b ? String(b).replace(/\/+$/, "") : "";
}

function pickAuth(req: NextRequest) {
  const incoming = req.headers.get("authorization");
  if (incoming) return incoming;

  const staticToken =
    process.env.DIRECTUS_TOKEN ??
    process.env.DIRECTUS_STATIC_TOKEN ??
    process.env.API_TOKEN ??
    null;

  return staticToken ? `Bearer ${staticToken}` : null;
}

async function fetchPayrollRunEmployees(req: NextRequest, payrollRunId: number) {
  const directus = await baseUrl();
  if (!directus) throw new Error("Missing API_BASE / NEXT_PUBLIC_API_BASE env");

  const auth = pickAuth(req);

  const url =
    `${directus}/items/payroll_run_employee` +
    `?filter[payroll_run_id][_eq]=${encodeURIComponent(String(payrollRunId))}` +
    `&limit=5000` +
    `&sort=employee_name`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(auth ? { Authorization: auth } : {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: { data?: AnyRow[]; error?: unknown; errors?: unknown; message?: unknown; [key: string]: unknown } | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error || json?.errors || json?.message || "Request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return Array.isArray(json?.data) ? (json.data as AnyRow[]) : [];
}

/**
 * ✅ SAFE DEDUPE:
 * - Prefer payroll_run_employee primary key (row.id) when present.
 * - Fallback to explicit payroll_run_employee_id if present.
 * - Fallback to (payroll_run_id + user_id) only if BOTH exist.
 * - If we cannot compute a reliable key, we DO NOT dedupe that row (prevents “missing 1 payslip”).
 */
function payslipKey(r: AnyRow): string | null {
  const primary =
    r?.id ?? r?.payroll_run_employee_id ?? r?.payrollRunEmployeeId ?? null;

  if (primary !== null && primary !== undefined && String(primary).trim() !== "") {
    return `pre:${String(primary)}`;
  }

  const run = r?.payroll_run_id ?? r?.payrollRunId ?? null;
  const user = r?.user_id ?? r?.userId ?? null;

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

function dedupeRows(rows: AnyRow[]): AnyRow[] {
  const seen = new Set<string>();
  const out: AnyRow[] = [];

  for (const r of rows) {
    const k = payslipKey(r);
    if (!k) {
      // no reliable key -> keep it (prevents accidental dropping)
      out.push(r);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }

  return out;
}

function buildEarningsLines(row: AnyRow) {
  const b = parseJsonMaybe(row.breakdown_json ?? row.breakdownJson);

  const allowanceItems =
    b?.earnings?.allowance_items ?? b?.earnings?.allowanceItems ?? [];

  const allowanceLines: string[] = Array.isArray(allowanceItems)
    ? allowanceItems
      .map((xVal: unknown) => {
        const x = xVal as Record<string, unknown>;
        const desc = s(x?.description ?? x?.name ?? "Allowance").trim();
        const amt = n(
          x?.amount_this_cutoff ?? x?.amount ?? x?.amountThisCutoff
        );
        if (!desc || amt === 0) return "";
        return `${desc} (${money(amt)})`;
      })
      .filter(Boolean)
    : [];

  const manualItems =
    b?.earnings?.manual_additions_items ??
    b?.earnings?.manualAdditionsItems ??
    b?.earnings?.manual_items ??
    [];

  const manualLines: string[] = Array.isArray(manualItems)
    ? manualItems
      .map((xVal: unknown) => {
        const x = xVal as Record<string, unknown>;
        const desc = s(x?.description ?? x?.name ?? "Addition").trim();
        const amt = n(x?.amount ?? x?.value ?? 0);
        if (!desc || amt === 0) return "";
        return `${desc} (${money(amt)})`;
      })
      .filter(Boolean)
    : [];

  return { allowanceLines, manualLines };
}

function buildDeductionLines(row: AnyRow) {
  const loanVale = n(row.loan_vale);
  const loanCar = n(row.loan_car);
  const loanCoop = n(row.loan_coop);

  const loanLines: string[] = [];
  if (loanVale) loanLines.push(`Vale (${money(loanVale)})`);
  if (loanCar) loanLines.push(`Car Loan (${money(loanCar)})`);
  if (loanCoop) loanLines.push(`Coop Loan (${money(loanCoop)})`);

  const benefitLoanSSS = n(row.benefit_loan_sss);
  const benefitLoanPagibig = n(row.benefit_loan_pagibig);

  const benefitLoanLines: string[] = [];
  if (benefitLoanSSS) benefitLoanLines.push(`SSS Loan (${money(benefitLoanSSS)})`);
  if (benefitLoanPagibig)
    benefitLoanLines.push(`Pag-IBIG Loan (${money(benefitLoanPagibig)})`);

  return { loanLines, benefitLoanLines };
}

function drawSlip(
  doc: PDFKit.PDFDocument,
  row: AnyRow,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const pad = 10;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  doc.save().lineWidth(1).rect(x, y, w, h).stroke("#111111").restore();

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
  doc.text("PAYSLIP", innerX, innerY, { width: innerW, align: "left" });

  const employeeName = s(
    row.employee_name ?? row.employeeName ?? row.full_name ?? row.name ?? ""
  ).trim();
  const position = s(row.position_name ?? row.position ?? "").trim();
  const department = s(
    row.department_name_snapshot ?? row.department_name ?? row.departmentName ?? ""
  ).trim();
  const userId = s(row.user_id ?? row.userId ?? "").trim();

  const cutoffLabel = s(row.cutoff_label ?? "").trim();
  const cutoffStart = s(row.cutoff_start ?? "").slice(0, 10);
  const cutoffEnd = s(row.cutoff_end ?? "").slice(0, 10);
  const period =
    cutoffLabel ||
    (cutoffStart && cutoffEnd ? `${cutoffStart} to ${cutoffEnd}` : "-");

  const topY = innerY + 14;
  doc.font("Helvetica").fontSize(8).fillColor("#111111");

  const leftW = innerW * 0.62;
  const rightW = innerW - leftW;
  const lh = 10;

  doc.text(`Period: ${period}`, innerX, topY, { width: leftW });
  doc.text(`Designation: ${position || "-"}`, innerX + leftW, topY, {
    width: rightW,
  });

  doc.text(`Employee: ${employeeName || "-"}`, innerX, topY + lh, {
    width: leftW,
  });
  doc.text(`ID No.: ${userId || "-"}`, innerX + leftW, topY + lh, {
    width: rightW,
  });

  doc.text(`Department: ${department || "-"}`, innerX, topY + lh * 2, {
    width: leftW,
  });

  const bandY = topY + lh * 3 + 2;
  const bandH = 38;

  doc.save().lineWidth(1).rect(innerX, bandY, innerW, bandH).stroke("#111111").restore();

  const daysWorked = n(row.total_days_worked);
  const hoursWorked = n(row.total_hours_worked);
  const lateMin = Math.floor(n(row.late_minutes));
  const utMin = Math.floor(n(row.undertime_minutes));
  const otMin = Math.floor(n(row.overtime_minutes));
  const ndMin = Math.floor(n(row.night_diff_minutes));

  const dailyRate = n(row.daily_rate ?? row.basic_daily_rate);

  const bandLeftX = innerX + 6;
  const bandRightX = innerX + innerW * 0.55;

  doc.font("Helvetica").fontSize(8);
  doc.text(`Days Worked: ${daysWorked.toFixed(2)}`, bandLeftX, bandY + 6);
  doc.text(`Hours Worked: ${hoursWorked.toFixed(2)}`, bandLeftX, bandY + 16);
  doc.text(`OT (min): ${otMin}   ND (min): ${ndMin}`, bandLeftX, bandY + 26);

  doc.text(`Late (min): ${lateMin}`, bandRightX, bandY + 6);
  doc.text(`Undertime (min): ${utMin}`, bandRightX, bandY + 16);
  doc.text(`Daily Rate: ${money(dailyRate)}`, bandRightX, bandY + 26);

  const tableY = bandY + bandH + 6;
  const tableH = innerH - (tableY - innerY) - 34;
  const midX = innerX + innerW / 2;

  doc
    .save()
    .lineWidth(1)
    .rect(innerX, tableY, innerW, tableH)
    .stroke("#111111")
    .moveTo(midX, tableY)
    .lineTo(midX, tableY + tableH)
    .stroke("#111111")
    .restore();

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("EARNINGS", innerX, tableY + 4, { width: innerW / 2, align: "center" });
  doc.text("DEDUCTIONS", midX, tableY + 4, { width: innerW / 2, align: "center" });

  doc
    .save()
    .lineWidth(1)
    .moveTo(innerX, tableY + 18)
    .lineTo(innerX + innerW, tableY + 18)
    .stroke("#111111")
    .restore();

  const earningsX = innerX + 6;
  const deductionsX = midX + 6;
  const colW = innerW / 2 - 12;

  const basicPay = n(row.basic_pay);
  const otAmount = n(row.ot_amount);
  const holidayPay = n(row.holiday_pay ?? row.holiday);
  const restDayAmount = n(row.rest_day_amount);
  const nightDiffAmount = n(row.night_diff_amount);
  const allowanceTotal = n(row.allowance);
  const manualAdditions = n(row.manual_additions);
  const leaveAmount = n(row.leave_amount);
  const retroPay = n(row.retro_pay);

  const lateDed = n(row.late_deduction);
  const utDed = n(row.undertime_deduction);
  const shortageDed = n(row.shortage_deduction);
  const drDed = n(row.dr_deduction);

  const loanTotal = n(
    row.loan_total ?? (n(row.loan_vale) + n(row.loan_car) + n(row.loan_coop))
  );
  const coopSavings = n(row.coop_savings);
  const coopLoan = n(row.coop_loan);

  const benSSS = n(row.benefit_sss);
  const benPhil = n(row.benefit_philhealth);
  const benPag = n(row.benefit_pagibig);
  const benLoanSSS = n(row.benefit_loan_sss);
  const benLoanPag = n(row.benefit_loan_pagibig);

  const otherDed = n(row.other_deductions);
  const manualDed = n(row.manual_deductions);

  const grossPay = n(row.gross_pay);
  const totalDeductions = n(row.total_deductions);
  const netPay = n(row.net_pay);

  const { allowanceLines, manualLines } = buildEarningsLines(row);
  const { loanLines, benefitLoanLines } = buildDeductionLines(row);

  const eItems: Array<[string, number]> = [
    ["Basic Pay", basicPay],
    ["Overtime Pay", otAmount],
    ["Holiday Pay", holidayPay],
    ["Rest Day Pay", restDayAmount],
    ["Night Diff", nightDiffAmount],
    ["Allowance (Total)", allowanceTotal],
    ["Manual Additions (Total)", manualAdditions],
    ["Leave Amount", leaveAmount],
    ["Retro Pay", retroPay],
  ];

  const dItems: Array<[string, number]> = [
    ["Late Deduction", lateDed],
    ["Undertime Deduction", utDed],
    ["Shortage Deduction", shortageDed],
    ["Stock Payments (DR)", drDed],
    ["Employee Loans (Total)", loanTotal],
    ["SSS Contribution", benSSS],
    ["PhilHealth Contribution", benPhil],
    ["Pag-IBIG Contribution", benPag],
    ["SSS Loan", benLoanSSS],
    ["Pag-IBIG Loan", benLoanPag],
    ["Coop Savings", coopSavings],
    ["Coop Loan", coopLoan],
    ["Other Deductions", otherDed],
    ["Manual Deductions", manualDed],
  ];

  const startY = tableY + 22;
  const rowH = 10;
  const maxRows = Math.floor((tableH - 26) / rowH);

  doc.font("Helvetica").fontSize(8);

  function drawList(
    x0: number,
    y0: number,
    items: Array<[string, number]>,
    extraLines: string[]
  ) {
    let yPos = y0;
    let used = 0;

    for (const [label, val] of items) {
      if (used >= maxRows - 3) break;
      if (n(val) === 0) continue;

      doc.text(label, x0, yPos, { width: colW * 0.68, ellipsis: true });
      doc.text(money(val), x0 + colW * 0.68, yPos, {
        width: colW * 0.32,
        align: "right",
      });

      yPos += rowH;
      used += 1;
    }

    if (extraLines?.length) {
      const take = Math.max(0, Math.min(extraLines.length, maxRows - used - 1));
      if (take > 0) {
        doc.font("Helvetica-Oblique").fontSize(7);
        for (let i = 0; i < take; i++) {
          doc.text(`- ${extraLines[i]}`, x0, yPos, { width: colW, ellipsis: true });
          yPos += 9;
        }
        doc.font("Helvetica").fontSize(8);
      }
      if (extraLines.length > take) {
        doc.font("Helvetica-Oblique").fontSize(7);
        doc.text("…", x0, yPos, { width: colW });
        doc.font("Helvetica").fontSize(8);
      }
    }
  }

  drawList(earningsX, startY, eItems, [...allowanceLines, ...manualLines]);
  drawList(deductionsX, startY, dItems, [...loanLines, ...benefitLoanLines]);

  const footY = tableY + tableH + 6;
  const footH = 22;

  doc.save().lineWidth(1).rect(innerX, footY, innerW, footH).stroke("#111111").restore();

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text(`Gross Pay: ${money(grossPay)}`, innerX + 8, footY + 6, {
    width: innerW / 3,
  });
  doc.text(`Deductions: ${money(totalDeductions)}`, innerX + innerW / 3, footY + 6, {
    width: innerW / 3,
    align: "center",
  });
  doc.text(`NET PAY: ${money(netPay)}`, innerX + (innerW * 2) / 3 - 8, footY + 6, {
    width: innerW / 3,
    align: "right",
  });
}

async function buildPdfBuffer(rows: AnyRow[]) {
  const doc = new PDFDocument({
    size: "LEGAL",
    layout: "portrait",
    margins: { top: 24, bottom: 24, left: 24, right: 24 },
    autoFirstPage: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const perPage = 5;
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  const marginX = 24;
  const marginY = 24;
  const gap = 10;

  const slipW = pageW - marginX * 2;
  const usableH = pageH - marginY * 2 - gap * (perPage - 1);
  const slipH = usableH / perPage;

  for (let i = 0; i < rows.length; i++) {
    const idxOnPage = i % perPage;
    if (i > 0 && idxOnPage === 0) doc.addPage();

    const x = marginX;
    const y = marginY + idxOnPage * (slipH + gap);

    drawSlip(doc, rows[i], x, y, slipW, slipH);
  }

  doc.end();
  return done;
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    const payrollRunIdRaw = body?.payrollRunId ?? body?.payroll_run_id ?? null;
    const payrollRunId = Number(payrollRunIdRaw);

    if (!Number.isFinite(payrollRunId) || payrollRunId <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid payrollRunId" },
        { status: 400 }
      );
    }

    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    let rows = await fetchPayrollRunEmployees(req, payrollRunId);

    if (!rows.length) {
      return NextResponse.json(
        { error: "No payroll_run_employee rows found for this run" },
        { status: 404 }
      );
    }

    rows = dedupeRows(rows);

    rows.sort((a, b) =>
      s(a.employee_name ?? a.employeeName ?? "").localeCompare(
        s(b.employee_name ?? b.employeeName ?? "")
      )
    );

    const pdf = await buildPdfBuffer(rows);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="payslips-run-${payrollRunId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Failed to generate payslip PDF", details },
      { status: 500 }
    );
  }
}
