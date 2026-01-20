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

  // --- Header bar ---
  doc.setFillColor(15, 23, 42); // slate-900-ish
  doc.rect(0, 0, pageW, headerH, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, marginX, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const generated = new Date().toLocaleString();
  doc.text(`Generated: ${generated}  •  Paper: ${paper}`, marginX, 52);

  // --- Filters box ---
  const filterY = headerH + 18;
  const boxH = 74;
  doc.setFillColor(248, 250, 252); // slate-50-ish
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(marginX, filterY, pageW - marginX * 2, boxH, 10, 10, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Filters", marginX + 14, filterY + 22);

  const cutoffLabelText =
    cutoffId === "ALL"
      ? "All Cutoffs"
      : (() => {
        const c = cutoffs.find((x) => String(x.id) === String(cutoffId));
        return c ? cutoffLabel(c) : `Cutoff #${cutoffId}`;
      })();

  const benefitText = benefit === "ALL" ? "All Benefits" : benefit;
  const typeText = type === "ALL" ? "All Types" : type === "CONTRIBUTION" ? "Contribution" : "Loan";
  const searchText = search?.trim() ? search.trim() : "(none)";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Cutoff: ${cutoffLabelText}`, marginX + 14, filterY + 40);
  doc.text(`Benefit: ${benefitText}  •  Type: ${typeText}  •  Search: ${searchText}`, marginX + 14, filterY + 56);

  // --- Totals line (computed from rows) ---
  const totals = rows.reduce(
    (acc, r) => {
      const b = r.benefit_code as BenefitCode;
      acc[b] = (acc[b] || 0) + (r.deducted_amount || 0);
      acc.ALL += r.deducted_amount || 0;
      return acc;
    },
    { SSS: 0, PAGIBIG: 0, PHILHEALTH: 0, ALL: 0 } as Record<string, number>
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `Totals  SSS: ${formatMoney(totals.SSS)}   PAGIBIG: ${formatMoney(totals.PAGIBIG)}   PHILHEALTH: ${formatMoney(
      totals.PHILHEALTH
    )}   TOTAL: ${formatMoney(totals.ALL)}`,
    marginX + 14,
    filterY + 72
  );

  // --- Table (NOTE column intentionally excluded) ---
  const cutoffMap = new Map(cutoffs.map((c) => [c.id, c] as const));

  const head = [["Employee", "Cutoff", "Benefit", "Type", "Source", "Deducted", "Posted"]];
  const body = rows.map((r) => {
    const c = cutoffMap.get(r.cutoff_id);
    return [
      userName(users, r.user_id),
      c ? cutoffLabel(c) : `Cutoff #${r.cutoff_id}`,
      r.benefit_code,
      r.log_type === "LOAN" ? "Loan" : "Contribution",
      formatMoney(r.source_amount || 0),
      formatMoney(r.deducted_amount || 0),
      formatPosted(r),
    ];
  });

  const startY = filterY + boxH + 22;

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    margin: { left: marginX, right: marginX, top: marginX, bottom: 44 },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      4: { halign: "right" }, // Source
      5: { halign: "right" }, // Deducted
      6: { cellWidth: 90 }, // Posted
      2: { cellWidth: 72 }, // Benefit
      3: { cellWidth: 88 }, // Type
    },
    didDrawPage: (data: any) => {
      // Footer
      const pageCount = doc.getNumberOfPages();
      const pageNum = doc.getCurrentPageInfo().pageNumber;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(companyName, marginX, pageH - 24);
      doc.text(`Page ${pageNum} of ${pageCount}`, pageW - marginX, pageH - 24, { align: "right" });
    },
  });

  const safeDate = new Date().toISOString().slice(0, 10);
  doc.save(`benefit-logs-${safeDate}-${paper.toLowerCase()}-portrait.pdf`);
}
