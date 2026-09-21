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
  cutoffRange: string;
  companyFilter: string;
  benefit: BenefitCode | "ALL";
  type: "ALL" | "CONTRIBUTION" | "LOAN";
  search: string;
  rows: UnifiedBenefitLogRow[];
}) {
  const {
    paper,
    title = "Compiled Enterprise Benefits Logs Report",
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
    orientation: "landscape",
    unit: "pt",
    format: docFormat,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 40;
  const marginRight = 40;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(24, 24, 27);
  doc.text("UNIFIED HR & PAYROLL SYSTEM", marginLeft, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(title, marginLeft, 56);

  // Metadata block (Right-aligned)
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const generatedText = `Generated: ${format(new Date(), "MMM dd, yyyy, hh:mm a")}`;
  doc.text(generatedText, pageWidth - marginRight, 40, { align: "right" });

  const filterSummary = `Company: ${companyFilter} | Benefit: ${benefit} | Type: ${type}${
    cutoffRange !== "ALL" ? ` | Cutoff: ${cutoffRange}` : ""
  }${search ? ` | Query: "${search}"` : ""}`;
  doc.text(filterSummary, pageWidth - marginRight, 54, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(marginLeft, 68, pageWidth - marginRight, 68);

  // Compute summary totals by Company and by Benefit
  const byCompany: Record<string, { name: string; count: number; total: number }> = {};
  const byBenefit: Record<string, number> = { SSS: 0, PHILHEALTH: 0, PAGIBIG: 0 };
  let grandTotal = 0;

  for (const r of rows) {
    const amt = r.deducted_amount || 0;
    grandTotal += amt;

    if (!byCompany[r.company_id]) {
      byCompany[r.company_id] = { name: r.company_name, count: 0, total: 0 };
    }
    byCompany[r.company_id].count += 1;
    byCompany[r.company_id].total += amt;

    if (r.benefit_code) {
      byBenefit[r.benefit_code] = (byBenefit[r.benefit_code] || 0) + amt;
    }
  }

  // AutoTable rows
  const tableData = rows.map((r) => [
    r.company_name,
    r.employee_name || "Employee",
    r.benefit_code,
    r.log_type,
    `PHP ${formatMoney(r.deducted_amount)}`,
    r.payroll_ref_no || "—",
    r.cutoff_start && r.cutoff_end
      ? `${formatDateSafe(r.cutoff_start)} - ${formatDateSafe(r.cutoff_end)}`
      : "—",
    formatDateSafe(r.posted_at || r.created_date),
  ]);

  autoTable(doc, {
    startY: 80,
    margin: { left: marginLeft, right: marginRight, bottom: 40 },
    head: [
      [
        "Company",
        "Employee Name",
        "Benefit",
        "Type",
        "Deducted",
        "Payroll Ref",
        "Cutoff Period",
        "Posted Date",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 120 },
      2: { cellWidth: 55 },
      3: { cellWidth: 65 },
      4: { cellWidth: 75, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 80 },
      6: { cellWidth: 120 },
      7: { cellWidth: 70 },
    },
    didDrawPage: (data: any) => {
      // Footer page numbering
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        pageStr,
        pageWidth - marginRight,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" }
      );
      doc.text(
        "Unified Payroll System - Confidential Report",
        marginLeft,
        doc.internal.pageSize.getHeight() - 20
      );
    },
  });

  // Summary section at end of table
  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  const pageHeight = doc.internal.pageSize.getHeight();

  // If near page bottom, add new page for summary totals
  if (finalY + 120 > pageHeight) {
    doc.addPage();
    doc.text("Executive Compilation Summary", marginLeft, 40);
  }

  const summaryStartY = finalY + 120 > pageHeight ? 55 : finalY + 20;

  const companySummaryRows = Object.values(byCompany).map((c) => [
    c.name,
    c.count.toString(),
    `PHP ${formatMoney(c.total)}`,
  ]);

  autoTable(doc, {
    startY: summaryStartY,
    margin: { left: marginLeft, right: pageWidth / 2 + 10 },
    head: [["Company", "Records", "Total Amount"]],
    body: [
      ...companySummaryRows,
      ["Grand Total", rows.length.toString(), `PHP ${formatMoney(grandTotal)}`],
    ],
    theme: "plain",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 7.5 },
    footStyles: { fontStyle: "bold" },
  });

  const filename = `unified-benefits-logs-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`;
  doc.save(filename);
}
