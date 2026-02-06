// modules/benefit-settings/components/benefitLogsPdf.ts
"use client";

import type { BenefitLogRow, CutoffSetting, UserData, BenefitCode } from "../types";
import { cutoffLabel, formatMoney } from "../providers/benefitApi";

export type BenefitLogsPaperSize = "LETTER" | "A4" | "LEGAL";

function userName(users: UserData[], userId: number) {
  const u = users.find((x) => x.user_id === userId);
  return u ? `${u.user_fname} ${u.user_lname}`.trim() : `User #${userId}`;
}

function formatPosted(r: BenefitLogRow) {
  // Prefer payroll run reference if available; otherwise fallback to created_date-ish fields if present.
  const anyR = r as any;
  if (r.payroll_run_id) return `PR#${r.payroll_run_id}`;
  const raw = anyR.posted_at ?? anyR.created_date ?? anyR.updated_date ?? null;
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString();
}

function paperToJsPdfFormat(paper: BenefitLogsPaperSize): "letter" | "a4" | "legal" {
  if (paper === "A4") return "a4";
  if (paper === "LEGAL") return "legal";
  return "letter";
}

export async function exportBenefitLogsPdf(args: {
  paper: BenefitLogsPaperSize;
  companyName?: string;
  title?: string;

  users: UserData[];
  cutoffs: CutoffSetting[];
  cutoffId: string; // "ALL" or id string
  benefit: BenefitCode | "ALL";
  type: "ALL" | "CONTRIBUTION" | "LOAN";
  search: string;

  rows: BenefitLogRow[]; // already filtered rows
}) {
  const {
    paper,
    companyName = "Vertex Technology Corps.",
    title = "Benefit Logs (Deduction Report)",
    users,
    cutoffs,
    cutoffId,
    benefit,
    type,
    search,
    rows,
  } = args;

  // NOTE: requires deps in your app:
  // npm i jspdf jspdf-autotable
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);

  const format = paperToJsPdfFormat(paper);

  // Portrait, modern margins in points
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginX = 40;
  const headerH = 72;

  // --- Branding Colors (Persian Blue System) ---
  const colors = {
    primary: [4, 72, 255] as [number, number, number],   // Persian Blue 600
    secondary: [0, 60, 219] as [number, number, number], // Persian Blue 800
    dark: [7, 31, 95] as [number, number, number],      // Persian Blue 950
    accent: [79, 159, 255] as [number, number, number],  // Persian Blue 400
    border: [226, 232, 240] as [number, number, number],
    slate600: [71, 85, 105] as [number, number, number],
  };

  const footerH = 40;

  // --- Dynamic Title based on selection ---
  const getBenefitLabel = (code: string) => {
    if (code === "SSS") return "SSS";
    if (code === "PHILHEALTH") return "PhilHealth";
    if (code === "PAGIBIG") return "Pag-IBIG";
    return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  };

  const actualBenefit =
    benefit === "ALL"
      ? (() => {
        const unique = Array.from(new Set(rows.map((r) => r.benefit_code)));
        return unique.length === 1 ? unique[0] : "Benefit";
      })()
      : benefit;

  const typeLabel =
    type === "ALL" ? "Logs" : type === "CONTRIBUTION" ? "Contributions" : "Loans";

  const displayTitle = `${actualBenefit === "Benefit" ? "Benefit" : getBenefitLabel(actualBenefit)} ${typeLabel}`;

  const renderHeader = (isFirstPage: boolean) => {
    const headerY = 20;
    const sidebarW = 120;
    const barH = 32;

    // 1. Sidebar (Persian Blue 950)
    doc.setFillColor(...colors.dark);
    doc.roundedRect(0, headerY, sidebarW, barH * 2.5, 0, 30, "F");

    // 2. Icon placeholder (Geometric Accent)
    doc.setDrawColor(...colors.accent);
    doc.setLineWidth(1.5);
    doc.rect(sidebarW / 2 - 12, headerY + 25, 24, 24);
    doc.rect(sidebarW / 2 - 8, headerY + 29, 16, 16);

    // 3. Company Bar (Persian Blue 600)
    doc.setFillColor(...colors.primary);
    doc.rect(sidebarW - 20, headerY + 10, pageW - (sidebarW - 20), barH, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setCharSpace(1);
    doc.text("MEN2 MARKETING CORPORATIONS", sidebarW + (pageW - sidebarW) / 2, headerY + 30, { align: "center" });

    // 4. Title Bar (Persian Blue 800)
    doc.setFillColor(...colors.secondary);
    doc.rect(sidebarW - 10, headerY + 10 + barH, pageW - (sidebarW - 10), barH - 8, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(2);
    doc.text(displayTitle.toUpperCase(), sidebarW + (pageW - sidebarW) / 2, headerY + 10 + barH + 16, { align: "center" });

    // --- Summary Statistics (Only on First Page) ---
    if (isFirstPage) {
      const cutoffLabelText =
        cutoffId === "ALL"
          ? "All Cutoffs"
          : (() => {
            const c = cutoffs.find((x) => String(x.id) === String(cutoffId));
            return c ? cutoffLabel(c) : `Cutoff #${cutoffId}`;
          })();

      const uniqueEmployees = new Set(rows.map((r) => r.user_id)).size;
      const grandTotal = rows.reduce((sum, r) => sum + (r.deducted_amount || 0), 0);

      const statsY = headerY + barH * 2.5 + 15;
      doc.setTextColor(...colors.slate600);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setCharSpace(0);

      const headerStats = [
        `Period: ${cutoffLabelText}`,
        `Total Employees: ${uniqueEmployees}`,
        `Grand Total: ${formatMoney(grandTotal)}`
      ].join("   |   ");

      doc.text(headerStats, pageW / 2, statsY, { align: "center" });

      // Divider line
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.5);
      doc.line(marginX, statsY + 10, pageW - marginX, statsY + 10);
      return statsY + 12;
    }
    return headerY + barH * 2.5 + 10;
  };

  const renderFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageH - footerH;

    // Bottom Accent Bar (Mirrors Title Bar)
    doc.setFillColor(...colors.secondary);
    doc.rect(0, footerY + 10, pageW, 15, "F");

    // Sidebar Accent (Mirrors Header Sidebar)
    doc.setFillColor(...colors.dark);
    doc.roundedRect(0, footerY - 5, 80, 45, 0, 20, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`MEN2 MARKETING`, 40, footerY + 20, { align: "center" });

    doc.setTextColor(...colors.slate600);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${new Date().toLocaleDateString()}  |  Page ${pageNumber} of ${totalPages}`, pageW - marginX, footerY + 20, { align: "right" });
  };

  let lastY = renderHeader(true);

  // Optional Breakdown ONLY for ALL
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
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Breakdown: SSS ${formatMoney(totals.SSS)}  |  PhilHealth ${formatMoney(totals.PHILHEALTH)}  |  Pag-IBIG ${formatMoney(totals.PAGIBIG)}`,
      pageW / 2,
      lastY + 12,
      { align: "center" }
    );
    lastY += 20;
  }

  // --- Table Rendering (Grouped by Benefit & Type) ---
  const benefitOrder: BenefitCode[] =
    benefit === "ALL" ? ["SSS", "PHILHEALTH", "PAGIBIG"] : [benefit];
  const typeOrder: ("CONTRIBUTION" | "LOAN")[] = ["CONTRIBUTION", "LOAN"];

  for (const bCode of benefitOrder) {
    for (const lType of typeOrder) {
      const groupRows = rows.filter(
        (r) => r.benefit_code === bCode && r.log_type === lType
      );

      if (groupRows.length === 0) continue;

      // Group Header
      const head = [["Employee", "Account #", "Deducted", "Posted Date"]];
      const body = groupRows.map((r) => {
        const postedDate = r.posted_at
          ? new Date(r.posted_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
          : "—";

        return [
          r.employee_name || userName(users, r.user_id),
          r.account_no || "—",
          formatMoney(r.deducted_amount || 0),
          postedDate,
        ];
      });

      autoTable(doc, {
        startY: lastY + 10,
        head,
        body,
        theme: "grid",
        margin: { left: marginX, right: marginX, bottom: footerH + 10 },
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 4,
          textColor: [15, 23, 42],
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [71, 85, 105],
          fontStyle: "bold",
        },
        columnStyles: {
          2: { halign: "right" }, // Deducted
          1: { cellWidth: 100 },  // Account #
          3: { cellWidth: 80 },   // Posted Date
        },
      });

      lastY = (doc as any).lastAutoTable.finalY + 30;

      // Avoid orphaned headers at bottom of page
      if (lastY > pageH - 120) {
        doc.addPage();
        lastY = renderHeader(false);
      }
    }
  }

  // Final Footer Rendering on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    renderFooter(i, pageCount);
  }

  const safeDate = new Date().toISOString().slice(0, 10);
  doc.save(`benefit-logs-${safeDate}-${paper.toLowerCase()}-portrait.pdf`);
}
