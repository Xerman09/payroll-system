// modules/unified/benefits-logs/utils/unifiedBenefitLogsPdf.ts
"use client";

import { format, parseISO } from "date-fns";
import type { UnifiedBenefitLogRow, BenefitCode } from "../types";

export type BenefitLogsPaperSize = "LETTER" | "A4" | "LEGAL";

function paperToJsPdfFormat(paper: BenefitLogsPaperSize): "letter" | "a4" | "legal" {
  if (paper === "A4") return "a4";
  if (paper === "LEGAL") return "legal";
  return "letter";
}

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" && dateStr.includes("T") ? parseISO(dateStr) : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, "MMM dd, yyyy");
  } catch {
    return String(dateStr);
  }
}

function formatMoney(v: number) {
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function exportUnifiedBenefitLogsPdf(args: {
  paper: BenefitLogsPaperSize;
  title?: string;
  companyName?: string;
  cutoffRange: string;
  companyFilter: string;
  benefit: BenefitCode | "ALL";
  type: "ALL" | "CONTRIBUTION" | "LOAN";
  search: string;
  rows: UnifiedBenefitLogRow[];
}) {
  const {
    paper,
    companyName = "ENTERPRISE UNIFIED PAYROLL",
    cutoffRange,
    companyFilter,
    benefit,
    type,
    search,
    rows,
  } = args;

  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);

  const docFormat = paperToJsPdfFormat(paper);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: docFormat,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const footerH = 50;

  // --- Branding Colors (Matching Benefit Logs Printables) ---
  const DARK_BLUE = [11, 19, 43] as [number, number, number];
  const CYAN = [0, 180, 216] as [number, number, number];
  const LIGHT_BLUE = [144, 224, 239] as [number, number, number];

  const setFill = (rgb: number[]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: number[]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

  // Dynamic Title
  const getBenefitLabel = (code: string) => {
    if (code === "SSS") return "SSS / GSIS";
    if (code === "PHILHEALTH") return "PhilHealth";
    if (code === "PAGIBIG") return "Pag-IBIG";
    return code;
  };

  const actualBenefit =
    benefit === "ALL"
      ? (() => {
          const unique = Array.from(new Set(rows.map((r) => r.benefit_code)));
          return unique.length === 1 ? unique[0] : "Unified Benefits";
        })()
      : benefit;

  const typeLabel =
    type === "ALL" ? "Logs" : type === "CONTRIBUTION" ? "Contributions" : "Loans";

  const displayTitle =
    actualBenefit === "Unified Benefits"
      ? `COMPILED ENTERPRISE BENEFIT ${typeLabel.toUpperCase()}`
      : `${getBenefitLabel(actualBenefit).toUpperCase()} ${typeLabel.toUpperCase()}`;

  const renderHeader = (isFirstPage: boolean) => {
    // --- HEADER RIBBON (Top Left) ---
    setFill(DARK_BLUE);
    doc.triangle(0, 0, 180, 0, 0, 80, "F");
    setFill(CYAN);
    doc.triangle(0, 15, 120, 15, 0, 65, "F");
    setFill(LIGHT_BLUE);
    doc.triangle(0, 30, 80, 30, 0, 55, "F");
    setFill(DARK_BLUE);
    doc.rect(180, 0, pageW - 180, 15, "F");

    // --- COMPANY LOGO & NAME ---
    let headerY = 50;
    setText(DARK_BLUE);
    doc.setFont("helvetica", "bold");

    const nameStr = (companyFilter && companyFilter !== "All Companies" ? companyFilter : companyName)
      .toUpperCase()
      .trim();
    const lastSpaceIdx = nameStr.lastIndexOf(" ");

    if (lastSpaceIdx === -1) {
      doc.setFontSize(20);
      doc.text(nameStr, pageW - marginX, headerY, { align: "right" });
    } else {
      const p1 = nameStr.substring(0, lastSpaceIdx);
      const p2 = nameStr.substring(lastSpaceIdx + 1);

      doc.setFontSize(20);
      doc.text(p1, pageW - marginX, headerY, { align: "right" });

      headerY += 16;
      setText(CYAN);
      doc.setFontSize(10);
      doc.text(p2, pageW - marginX, headerY, { align: "right" });
    }

    // Divider Line
    headerY += 14;
    doc.setDrawColor(DARK_BLUE[0], DARK_BLUE[1], DARK_BLUE[2]);
    doc.setLineWidth(1.5);
    doc.line(pageW - 250, headerY, pageW - marginX, headerY);

    // --- REPORT TITLE ---
    headerY += 50;
    setText(DARK_BLUE);
    doc.setFontSize(15);
    doc.text(displayTitle, marginX, headerY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `DATE: ${format(new Date(), "MMMM dd, yyyy").toUpperCase()}`,
      pageW - marginX,
      headerY,
      { align: "right" }
    );

    // --- Summary Statistics (Only on First Page) ---
    if (isFirstPage) {
      const periodLabelText =
        cutoffRange === "ALL" || cutoffRange === "UNKNOWN"
          ? "All Cutoff Records"
          : (() => {
              const [start, end] = cutoffRange.split("_");
              return `Cutoff: ${formatDateSafe(start)} – ${formatDateSafe(end)}`;
            })();

      const uniqueEmployees = new Set(
        rows.map((r) => `${r.company_id}-${r.employee_name || r.user_id}`)
      ).size;
      const uniqueCompanies = new Set(rows.map((r) => r.company_id)).size;
      const grandTotal = rows.reduce((sum, r) => sum + (r.deducted_amount || 0), 0);

      const statsY = headerY + 30;
      doc.setTextColor(11, 19, 43); // Dark Blue
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");

      const statsParts = [
        companyFilter && companyFilter !== "All Companies"
          ? `COMPANY: ${companyFilter.toUpperCase()}`
          : `COMPANIES: ${uniqueCompanies}`,
        `PERIOD: ${periodLabelText.toUpperCase()}`,
        `EMPLOYEES: ${uniqueEmployees}`,
        `GRAND TOTAL: PHP ${formatMoney(grandTotal)}`,
      ].filter(Boolean);

      doc.text(statsParts.join("   |   "), pageW / 2, statsY, { align: "center" });

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(marginX, statsY + 10, pageW - marginX, statsY + 10);
      return statsY + 14;
    }

    return headerY + 20;
  };

  const renderFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageH - footerH;

    // Background Bar
    setFill(DARK_BLUE);
    doc.rect(0, footerY, pageW, footerH, "F");

    // Footer Ribbon (Bottom Right)
    setFill(CYAN);
    doc.triangle(pageW, pageH, pageW - 120, pageH, pageW, pageH - 40, "F");
    setFill(LIGHT_BLUE);
    doc.triangle(pageW, pageH, pageW - 80, pageH, pageW, pageH - 25, "F");

    // Company / System Name
    setText([255, 255, 255]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("UNIFIED ENTERPRISE PAYROLL SYSTEM", marginX, footerY + 28);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${pageNumber} of ${totalPages}`,
      pageW - marginX - 100,
      footerY + 28,
      { align: "right" }
    );
  };

  let lastY = renderHeader(true);

  // Optional Breakdown Banner for "ALL" benefits
  const uniqueBenefitsTotal = new Set(rows.map((r) => r.benefit_code)).size;
  if (benefit === "ALL" && uniqueBenefitsTotal > 1) {
    const totals = rows.reduce(
      (acc, r) => {
        const b = r.benefit_code as BenefitCode;
        acc[b] = (acc[b] || 0) + (r.deducted_amount || 0);
        return acc;
      },
      { SSS: 0, PAGIBIG: 0, PHILHEALTH: 0 } as Record<string, number>
    );

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Breakdown: SSS ₱${formatMoney(totals.SSS)}   |   PhilHealth ₱${formatMoney(totals.PHILHEALTH)}   |   Pag-IBIG ₱${formatMoney(totals.PAGIBIG)}`,
      pageW / 2,
      lastY + 8,
      { align: "center" }
    );
    lastY += 18;
  }

  // --- Table Rendering (Grouped by Benefit & Type, exactly like benefit logs template) ---
  const benefitOrder: BenefitCode[] =
    benefit === "ALL" ? ["SSS", "PHILHEALTH", "PAGIBIG"] : [benefit];
  const typeOrder: ("CONTRIBUTION" | "LOAN")[] =
    type === "ALL" ? ["CONTRIBUTION", "LOAN"] : [type];

  for (const bCode of benefitOrder) {
    for (const lType of typeOrder) {
      const groupRows = rows.filter(
        (r) => r.benefit_code === bCode && r.log_type === lType
      );

      if (groupRows.length === 0) continue;

      // Group Sub-header Banner
      const groupTitle = `${getBenefitLabel(bCode)} - ${lType === "CONTRIBUTION" ? "Contributions" : "Loans"}`;
      const groupSubtotal = groupRows.reduce((sum, r) => sum + (r.deducted_amount || 0), 0);

      // Avoid orphaned group headers near bottom of page
      if (lastY > pageH - 140) {
        doc.addPage();
        lastY = renderHeader(false);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(DARK_BLUE[0], DARK_BLUE[1], DARK_BLUE[2]);
      doc.text(groupTitle.toUpperCase(), marginX, lastY + 16);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Subtotal: PHP ${formatMoney(groupSubtotal)} (${groupRows.length} records)`,
        pageW - marginX,
        lastY + 16,
        { align: "right" }
      );

      lastY += 22;

      // Table Columns
      const head = [["Company", "Employee", "Account #", "Deducted", "Payroll Ref", "Posted Date"]];
      const body = groupRows.map((r) => {
        const postedDate = formatDateSafe(r.posted_at || r.created_date);

        return [
          r.company_name,
          r.employee_name || "Employee",
          r.account_no || "—",
          formatMoney(r.deducted_amount || 0),
          r.payroll_ref_no || "—",
          postedDate,
        ];
      });

      autoTable(doc, {
        startY: lastY,
        head,
        body,
        theme: "striped",
        margin: { left: marginX, right: marginX, bottom: footerH + 10 },
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          cellPadding: 6,
          textColor: [11, 19, 43], // Dark Blue
          lineColor: [230, 233, 237],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [11, 19, 43], // Dark Blue
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
          fontSize: 8.5,
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          0: { cellWidth: 120 }, // Company
          1: { cellWidth: 125 }, // Employee
          2: { cellWidth: 70 },  // Account #
          3: { cellWidth: 70, halign: "right", fontStyle: "bold" }, // Deducted
          4: { cellWidth: 75 },  // Payroll Ref
          5: { cellWidth: 70 },  // Posted Date
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastY = (doc as any).lastAutoTable.finalY + 24;
    }
  }

  // Final Footer Rendering across all generated pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    renderFooter(i, pageCount);
  }

  const filename = `unified-benefits-logs-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`;
  doc.save(filename);
}
