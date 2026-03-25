// modules/benefit-settings/components/benefitLogsPdf.ts
"use client";

import type { BenefitLogRow, UserData, BenefitCode } from "../types";
import { formatMoney } from "../providers/benefitApi";

export type BenefitLogsPaperSize = "LETTER" | "A4" | "LEGAL";

function userName(users: UserData[], userId: number) {
  const u = users.find((x) => x.user_id === userId);
  return u ? `${u.user_fname} ${u.user_lname}`.trim() : `User #${userId}`;
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
  cutoffRange: string; // "ALL" or start_end
  benefit: BenefitCode | "ALL";
  type: "ALL" | "CONTRIBUTION" | "LOAN";
  department?: string; // optional department label (undefined = All)
  search: string;

  rows: BenefitLogRow[]; // already filtered rows
}) {
  const {
    paper,
    companyName = "",
    users,
    cutoffRange,
    benefit,
    type,
    department,
    rows,
  } = args;

  // NOTE: requires deps in your app:
  // npm i jspdf jspdf-autotable
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // --- Branding Colors (Premium System) ---
  const DARK_BLUE = [11, 19, 43] as [number, number, number];
  const CYAN = [0, 180, 216] as [number, number, number];
  const LIGHT_BLUE = [144, 224, 239] as [number, number, number];

  const setFill = (rgb: number[]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: number[]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

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
  const footerH = 50;

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

    const nameStr = (companyName || "").toUpperCase().trim();
    const lastSpaceIdx = nameStr.lastIndexOf(" ");

    if (lastSpaceIdx === -1) {
      doc.setFontSize(22);
      doc.text(nameStr, pageW - marginX, headerY, { align: "right" });
    } else {
      const p1 = nameStr.substring(0, lastSpaceIdx);
      const p2 = nameStr.substring(lastSpaceIdx + 1);

      doc.setFontSize(22);
      doc.text(p1, pageW - marginX, headerY, { align: "right" });

      headerY += 18;
      setText(CYAN);
      doc.setFontSize(10);
      doc.text(p2, pageW - marginX, headerY, { align: "right" });
    }

    // Divider Line
    headerY += 15;
    doc.setDrawColor(DARK_BLUE[0], DARK_BLUE[1], DARK_BLUE[2]);
    doc.setLineWidth(1.5);
    doc.line(pageW - 250, headerY, pageW - marginX, headerY);

    // --- REPORT TITLE ---
    headerY += 60;
    setText(DARK_BLUE);
    doc.setFontSize(16);
    doc.text(displayTitle.toUpperCase(), marginX, headerY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`DATE: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}`, pageW - marginX, headerY, { align: "right" });

    // --- Summary Statistics (Only on First Page) ---
    if (isFirstPage) {
      const periodLabelText =
        cutoffRange === "ALL" || cutoffRange === "UNKNOWN"
          ? "All Records"
          : (() => {
            const [start, end] = cutoffRange.split("_");
            const format = (d: string) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
            return `Cutoff: ${format(start)} - ${format(end)}`;
          })();

      const uniqueEmployees = new Set(rows.map((r) => r.user_id)).size;
      const grandTotal = rows.reduce((sum, r) => sum + (r.deducted_amount || 0), 0);

      const statsY = headerY + 40;
      doc.setTextColor(11, 19, 43); // Dark Blue
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");

      const statsParts = [
        department ? `DEPARTMENT: ${department.toUpperCase()}` : null,
        `PERIOD: ${periodLabelText.toUpperCase()}`,
        `TOTAL EMPLOYEES: ${uniqueEmployees}`,
        `GRAND TOTAL: PHP ${formatMoney(grandTotal)}`,
      ].filter(Boolean);

      doc.text(statsParts.join("   |   "), pageW / 2, statsY, { align: "center" });

      // Divider line
      doc.setDrawColor(226, 232, 240); // Border color
      doc.setLineWidth(0.5);
      doc.line(marginX, statsY + 10, pageW - marginX, statsY + 10);
      return statsY + 12;
    }
    return headerY + 20;
  };

  const renderFooter = (pageNumber: number, totalPages: number) => {
    const footerH = 50;
    const footerY = pageH - footerH;

    // Background Bar
    setFill(DARK_BLUE);
    doc.rect(0, footerY, pageW, footerH, "F");

    // Footer Ribbon (Bottom Right)
    setFill(CYAN);
    doc.triangle(pageW, pageH, pageW - 120, pageH, pageW, pageH - 40, "F");
    setFill(LIGHT_BLUE);
    doc.triangle(pageW, pageH, pageW - 80, pageH, pageW, pageH - 25, "F");

    // Contact Info
    setText([255, 255, 255]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text((companyName || "").toUpperCase(), marginX, footerY + 30);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageW - marginX - 100, footerY + 30, { align: "right" });
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

        const uId = typeof r.user_id === "object" ? (r.user_id as Record<string, unknown>)?.user_id as number : r.user_id as number;

        return [
          r.employee_name || userName(users, uId),
          r.account_no || "—",
          formatMoney(r.deducted_amount || 0),
          postedDate,
        ];
      });

      autoTable(doc, {
        startY: lastY + 10,
        head,
        body,
        theme: "striped",
        margin: { left: marginX, right: marginX, bottom: footerH + 10 },
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 8,
          textColor: [11, 19, 43], // Dark Blue
          lineColor: [230, 233, 237],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [11, 19, 43], // Dark Blue
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          2: { halign: "right", fontStyle: "bold" }, // Deducted
          1: { cellWidth: 100 },  // Account #
          3: { cellWidth: 80 },   // Posted Date
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return doc;
}
