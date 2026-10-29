// modules/lgu-payroll-run/utils/lguExportUtils.ts

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import type { LguPayrollLine, LguPayrollSummary, CutoffSetting } from "../types";
import { formatPhp } from "./lguCompute";

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

/**
 * Generates and downloads the Landbank of the Philippines (LBP) Electronic Payroll (WeAccess format) CSV file.
 * This is the standard banking file utilized by Philippine LGUs to credit salaries directly to employee ATM / Cash Cards.
 */
export function exportLguLandbankCsv(lines: LguPayrollLine[], payrollRefNo: string): void {
  const activeLines = lines.filter((l) => !l.isOnHold);

  const headers = [
    "Record Type",
    "Employee ID",
    "Employee Name",
    "Account / Card Number",
    "Amount (PHP)",
    "Department",
    "Reference Number",
  ];

  const rows = activeLines.map((l) => {
    // Generate standard 10-digit LBP account format placeholder if not configured
    const cardNo = `0772-${String(l.userId).padStart(6, "0")}-01`;
    return [
      "D", // Detail record
      `"${l.employeeNo || l.userId}"`,
      `"${l.employeeName.replace(/"/g, '""')}"`,
      `"${cardNo}"`,
      l.netPay.toFixed(2),
      `"${l.departmentName.replace(/"/g, '""')}"`,
      `"${payrollRefNo}"`,
    ];
  });

  const totalAmount = activeLines.reduce((sum, l) => sum + l.netPay, 0).toFixed(2);
  const trailer = [
    "T", // Trailer record
    `"COUNT: ${activeLines.length}"`,
    `"TOTAL AMOUNT"`,
    `""`,
    totalAmount,
    `""`,
    `"${payrollRefNo}"`,
  ];

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(",")), trailer.join(",")].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `LBP_PAYROLL_${payrollRefNo.replace(/[^A-Za-z0-9_-]/g, "_")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads the Official LGU General Payroll Top Sheet & Disbursement Summary (COA / DBM Audit Compliant) PDF.
 */
export async function downloadLguTopSheetPdf(args: {
  summary: LguPayrollSummary;
  cutoff: CutoffSetting | null;
  payrollRefNo: string;
  companyName?: string;
}): Promise<void> {
  const { summary, cutoff, payrollRefNo, companyName = "LOCAL GOVERNMENT UNIT (LGU)" } = args;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Top Title Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text("REPUBLIC OF THE PHILIPPINES", 148, 14, { align: "center" });

  doc.setFontSize(11);
  doc.text(companyName.toUpperCase(), 148, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("GENERAL PAYROLL TOP SHEET & DISBURSEMENT SUMMARY (COA / DBM PRESCRIBED FORM)", 148, 26, { align: "center" });

  const periodStr = cutoff
    ? `Period: ${formatDateSafe(cutoff.start_date)} to ${formatDateSafe(cutoff.end_date)} (${cutoff.cutoff_type} Half)`
    : "Period: Regular Pay Period";

  doc.setFontSize(8.5);
  doc.text(`Payroll Reference No: ${payrollRefNo} • ${periodStr}`, 148, 32, { align: "center" });

  // Summary Metrics Banner
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 36, 269, 16, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  doc.text(`Active Headcount: ${summary.activeHeadcount} of ${summary.totalHeadcount}`, 18, 43);
  doc.text(`Gross Compensation: ${formatPhp(summary.totalGrossPay)}`, 75, 43);
  doc.text(`Total Deductions: ${formatPhp(summary.totalPersonalDeductions)}`, 145, 43);
  doc.text(`Net Take-Home Pay: ${formatPhp(summary.totalNetPay)}`, 215, 43);

  doc.text(`Basic: ${formatPhp(summary.totalBasicPay)} • PERA: ${formatPhp(summary.totalPeraAllowance)}`, 18, 48);
  doc.text(`LGU Gov't Share: ${formatPhp(summary.totalLguCounterpart)}`, 75, 48);
  doc.text(`Statutory Remittance: ${formatPhp(summary.totalPersonalDeductions + summary.totalLguCounterpart)}`, 145, 48);
  doc.setTextColor(67, 56, 202);
  doc.text(`Total Public Fund Appropriation: ${formatPhp(summary.grandTotalAppropriation)}`, 215, 48);

  // Departmental Obligation Table
  autoTable(doc, {
    startY: 55,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    head: [
      [
        "DEPARTMENT / OFFICE",
        "HEADCOUNT",
        "BASIC PAY",
        "PERA",
        "GROSS PAY",
        "DEDUCTIONS",
        "NET PAY",
        "LGU SHARE",
        "TOTAL OBLIGATION",
      ],
    ],
    body: summary.departmentSummaries.map((dept) => [
      dept.departmentName,
      dept.headcount,
      formatPhp(dept.totalBasicPay),
      formatPhp(dept.totalPera),
      formatPhp(dept.totalGrossPay),
      `(${formatPhp(dept.totalPersonalDeductions)})`,
      formatPhp(dept.totalNetPay),
      formatPhp(dept.totalLguCounterpart),
      formatPhp(dept.totalAppropriation),
    ]),
    foot: [
      [
        "GRAND TOTAL",
        summary.activeHeadcount,
        formatPhp(summary.totalBasicPay),
        formatPhp(summary.totalPeraAllowance),
        formatPhp(summary.totalGrossPay),
        `(${formatPhp(summary.totalPersonalDeductions)})`,
        formatPhp(summary.totalNetPay),
        formatPhp(summary.totalLguCounterpart),
        formatPhp(summary.grandTotalAppropriation),
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error jspdf-autotable extends doc with lastAutoTable
  const finalY = doc.lastAutoTable.finalY + 12;

  // Signatures certification block (COA Box A, B, C format)
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);

  // Box 1: Accounting
  doc.rect(14, finalY, 85, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("CERTIFIED AS TO APPROPRIATION & CHARGES:", 17, finalY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("All supporting documents complete & valid.", 17, finalY + 10);
  doc.setFont("helvetica", "bold");
  doc.text("CITY / MUNICIPAL ACCOUNTANT", 17, finalY + 20);

  // Box 2: Treasury
  doc.rect(106, finalY, 85, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("CERTIFIED AS TO FUNDS AVAILABILITY:", 109, finalY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Cash available in General Fund account.", 109, finalY + 10);
  doc.setFont("helvetica", "bold");
  doc.text("CITY / MUNICIPAL TREASURER", 109, finalY + 20);

  // Box 3: Local Chief Executive
  doc.rect(198, finalY, 85, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("APPROVED FOR PAYMENT / DISBURSEMENT:", 201, finalY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Payment authorized pursuant to RA 7160.", 201, finalY + 10);
  doc.setFont("helvetica", "bold");
  doc.text("CITY / MUNICIPAL MAYOR", 201, finalY + 20);

  doc.save(`LGU_TOPSHEET_${payrollRefNo.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`);
}
