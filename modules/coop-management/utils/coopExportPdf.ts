"use client";

import { formatPeso } from "../helpers";

import { CutoffSetting } from "@/modules/benefit-settings/types";

export type CoopPaperSize = "LETTER" | "A4" | "LEGAL";

function paperToJsPdfFormat(paper: CoopPaperSize): "letter" | "a4" | "legal" {
  if (paper === "A4") return "a4";
  if (paper === "LEGAL") return "legal";
  return "letter";
}

export async function exportCoopPdf(args: {
  paper: CoopPaperSize;
  type: "savings" | "loans";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  searchTerm?: string;
  statusFilter?: string;
  cutoffId?: number;
  cutoffs?: CutoffSetting[];
  companyName?: string;
}) {
  const { paper, type, data: rawData, searchTerm, statusFilter, cutoffId, cutoffs, companyName } = args;

  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);

  const format = paperToJsPdfFormat(paper);
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

  const displayTitle = type === "savings" ? "COOP SAVINGS REPORT" : "COOP LOANS REPORT";
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
      doc.text(nameStr || "MEN2 MARKETING", pageW - marginX, headerY, { align: "right" });
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
    doc.text(
      `DATE: ${new Date()
        .toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        .toUpperCase()}`,
      pageW - marginX,
      headerY,
      { align: "right" }
    );

    if (isFirstPage) {
      const statsY = headerY + 40;
      doc.setTextColor(11, 19, 43);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");

      const filtersArr = [];
      if (searchTerm) filtersArr.push(`SEARCH: ${searchTerm.toUpperCase()}`);
      if (statusFilter && statusFilter !== "All") filtersArr.push(`STATUS: ${statusFilter.toUpperCase()}`);

      // Add Cutoff info
      if (cutoffId) {
        const selected = cutoffs?.find(c => c.id === cutoffId);
        if (selected) {
          const dateText = new Date(selected.start_date).toLocaleDateString();
          filtersArr.push(`CUTOFF: ${dateText} (${selected.cutoff_type})`);
        }
      }

      const filterText = filtersArr.length > 0 ? filtersArr.join("   |   ") : "ALL RECORDS";
      doc.text(filterText, pageW / 2, statsY, { align: "center" });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(marginX, statsY + 10, pageW - marginX, statsY + 10);
      return statsY + 12;
    }
    return headerY + 20;
  };

  // --- FILTER BY CUTOFF ---
  let filteredData = rawData;
  if (cutoffId) {
    const selected = cutoffs?.find(c => c.id === cutoffId);
    if (selected) {
      const startDate = new Date(selected.start_date);
      const endDate = new Date(selected.end_date);

      filteredData = rawData.filter(r => {
        const recordStart = r.start ? new Date(r.start) : (r.loan?.start_date ? new Date(r.loan.start_date) : null);
        const recordEnd = r.end ? new Date(r.end) : (r.loan?.end_date ? new Date(r.loan.end_date) : null);

        if (recordEnd && recordEnd < startDate) return false;
        if (recordStart && recordStart > endDate) return false;

        return true;
      });
    }
  }

  const renderFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageH - footerH;

    setFill(DARK_BLUE);
    doc.rect(0, footerY, pageW, footerH, "F");

    setFill(CYAN);
    doc.triangle(pageW, pageH, pageW - 120, pageH, pageW, pageH - 40, "F");
    setFill(LIGHT_BLUE);
    doc.triangle(pageW, pageH, pageW - 80, pageH, pageW, pageH - 25, "F");

    setText([255, 255, 255]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text((companyName || "VERTEX TECHNOLOGIES CORPORATIONS").toUpperCase(), marginX, footerY + 30);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${pageNumber} of ${totalPages}`,
      pageW - marginX - 100,
      footerY + 30,
      { align: "right" }
    );
  };

  const lastY = renderHeader(true);

  if (type === "savings") {
    const head = [["No.", "Membership ID", "Name", "Monthly", "Total Collection", "Months", "Status"]];
    const body = filteredData.map((r, i) => [
      i + 1,
      r.membershipId || "-",
      r.name,
      formatPeso(r.monthly),
      formatPeso(r.totalCollection),
      r.totalMonths,
      r.raw.is_active === 1 ? "Active" : "Inactive",
    ]);

    autoTable(doc, {
      startY: lastY + 10,
      head,
      body,
      theme: "striped",
      margin: { left: marginX, right: marginX, bottom: footerH + 10 },
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: DARK_BLUE, textColor: [255, 255, 255] },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "center" },
      },
    });
  } else {
    const head = [["No.", "Name", "Loan Amount", "Total Paid", "Balance", "Monthly", "Status"]];
    const body = filteredData.map((r, i) => [
      i + 1,
      r.name,
      formatPeso(r.loanAmount),
      formatPeso(r.totalPaid),
      formatPeso(r.balance),
      formatPeso(r.loan.monthly_payment),
      r.loan.status,
    ]);

    autoTable(doc, {
      startY: lastY + 10,
      head,
      body,
      theme: "striped",
      margin: { left: marginX, right: marginX, bottom: footerH + 10 },
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: DARK_BLUE, textColor: [255, 255, 255] },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(i, totalPages);
  }

  return doc;
}
