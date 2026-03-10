// modules/payroll-run/utils/benefitHistoryPdf.ts
import jsPDF from "jspdf";

type BenefitReportType = "contributions" | "loans";

type BenefitPageRecord = {
  index: number;
  name: string;
  amount: number;
};

type BenefitReportArgs = {
  companyName: string;
  reportType: BenefitReportType;
  employee: {
    id: string | number;
    name: string;
  };
  payrollId: string;
  monthAndYear: string;
  postedDate: string;
  records: BenefitPageRecord[];
};

export async function buildBenefitHistoryPdf(args: BenefitReportArgs) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "legal",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const innerW = pageW - margin * 2;

  // Colors based on sample image
  const DARK_BLUE = [11, 19, 43]; // #0B132B
  const CYAN = [0, 180, 216]; // #00B4D8
  const LIGHT_BLUE = [144, 224, 239]; // #90E0EF

  const setFill = (rgb: number[]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: number[]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

  // --- HEADER RIBBON (Top Left) ---
  // Large Dark Blue Diagonal
  setFill(DARK_BLUE);
  doc.triangle(0, 0, 180, 0, 0, 80, "F");

  // Cyan Accent
  setFill(CYAN);
  doc.triangle(0, 15, 120, 15, 0, 65, "F");

  // Light Blue Accent
  setFill(LIGHT_BLUE);
  doc.triangle(0, 30, 80, 30, 0, 55, "F");

  // Top Dark Bar
  setFill(DARK_BLUE);
  doc.rect(180, 0, pageW - 180, 15, "F");

  // --- COMPANY LOGO & NAME ---
  let y = 50;
  setText(DARK_BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);

  const compStr = (args.companyName || "").toUpperCase();
  doc.text(compStr, pageW - margin, y, { align: "right" });

  // Divider Line
  y += 15;
  doc.setDrawColor(DARK_BLUE[0], DARK_BLUE[1], DARK_BLUE[2]);
  doc.setLineWidth(1.5);

  // --- REPORT TITLE ---
  y += 60;
  const title = args.reportType === "contributions"
    ? "BENEFIT CONTRIBUTIONS HISTORY"
    : "BENEFIT LOANS HISTORY";

  setText(DARK_BLUE);
  doc.setFontSize(16);
  doc.text(title, margin, y);

  // Date on the right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`DATE: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}`, pageW - margin, y, { align: "right" });

  // --- EMPLOYEE & REFERENCE SECTION ---
  y += 40;
  doc.setFont("helvetica", "bold");
  doc.text("To,", margin, y);

  y += 14;
  setText(CYAN);
  doc.setFontSize(12);
  doc.text(args.employee.name.toUpperCase(), margin, y);

  y += 14;
  setText(DARK_BLUE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Employee ID: ${args.employee.id}`, margin, y);
  doc.text(`Payroll Ref: ${args.payrollId}`, margin, y + 12);

  // Right side info (Period)
  doc.setFont("helvetica", "bold");
  doc.text("REFERENCE PERIOD", pageW - margin, y - 10, { align: "right" });
  setText(CYAN);
  doc.setFontSize(11);
  doc.text(args.monthAndYear.toUpperCase(), pageW - margin, y + 5, { align: "right" });

  // --- MAIN CONTENT (TABLE) ---
  y += 60;

  // Table Style
  const tableHeaderH = 30;
  const rowH = 25;

  // Header Background
  setFill(DARK_BLUE);
  doc.rect(margin, y, innerW, tableHeaderH, "F");

  setText([255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("#", margin + 30, y + 18, { align: "center" });
  doc.text("DESCRIPTION / BENEFIT NAME", margin + 80, y + 18);
  doc.text("AMOUNT (PHP)", pageW - margin - 30, y + 18, { align: "right" });

  y += tableHeaderH;

  // Rows
  const fmtPeso = (val: number) => {
    return val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  setText(DARK_BLUE);
  doc.setFont("helvetica", "normal");

  args.records.forEach((rec, i) => {
    // Zebra Stripe
    if (i % 2 !== 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, innerW, rowH, "F");
    }

    doc.text(String(rec.index), margin + 30, y + 16, { align: "center" });
    doc.text(rec.name, margin + 80, y + 16);
    doc.text(fmtPeso(rec.amount), pageW - margin - 30, y + 16, { align: "right" });

    // Bottom border for each row
    doc.setDrawColor(230, 233, 237);
    doc.setLineWidth(0.5);
    doc.line(margin, y + rowH, margin + innerW, y + rowH);

    y += rowH;
  });

  // Total Row area (optional but looks good)
  const total = args.records.reduce((sum, r) => sum + r.amount, 0);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL AMOUNT", pageW - margin - 150, y + 15, { align: "right" });
  setText(CYAN);
  doc.setFontSize(12);
  doc.text(`PHP ${fmtPeso(total)}`, pageW - margin - 30, y + 15, { align: "right" });

  // --- FOOTER SECTION ---
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
  doc.text((args.companyName || "").toUpperCase(), margin, footerY + 30);

  return doc;
}
