// modules/lgu-payroll-run/utils/lguPayslipPdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import type { LguPayrollLine, CutoffSetting } from "../types";

function money(v: number): string {
  return `PHP ${(v || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export interface GenerateLguPayslipArgs {
  lines: LguPayrollLine[];
  cutoff: CutoffSetting | null;
  payrollRefNo: string;
  companyName?: string;
  singleEmployeeId?: number;
}

export async function downloadLguPayslipsPdf({
  lines,
  cutoff,
  payrollRefNo,
  companyName = "LOCAL GOVERNMENT UNIT (LGU)",
  singleEmployeeId,
}: GenerateLguPayslipArgs): Promise<void> {
  const targetLines = singleEmployeeId
    ? lines.filter((l) => l.userId === singleEmployeeId)
    : lines.filter((l) => !l.isOnHold);

  if (targetLines.length === 0) {
    throw new Error("No payslips available to download (all records may be on hold or none selected).");
  }

  // Use A4 portrait: 210mm x 297mm
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const periodStr = cutoff
    ? `${cutoff.cutoff_type} CUTOFF (${formatDateSafe(cutoff.start_date)} to ${formatDateSafe(cutoff.end_date)})`
    : "REGULAR CUTOFF";

  targetLines.forEach((line, index) => {
    if (index > 0) {
      doc.addPage();
    }

    // Top Header Banner
    doc.setFillColor(30, 58, 138); // deep blue
    doc.rect(14, 12, 182, 14, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("REPUBLIC OF THE PHILIPPINES", 105, 17, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`${companyName.toUpperCase()} • OFFICIAL EMPLOYEE PAYSLIP`, 105, 22, { align: "center" });

    // Metadata Grid
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);

    // Box border around employee info
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, 28, 182, 24, 2, 2);

    doc.text("Personnel Name:", 18, 34);
    doc.setFont("helvetica", "normal");
    doc.text(line.employeeName.toUpperCase(), 48, 34);

    doc.setFont("helvetica", "bold");
    doc.text("Department:", 18, 40);
    doc.setFont("helvetica", "normal");
    doc.text(line.departmentName, 48, 40);

    doc.setFont("helvetica", "bold");
    doc.text("Position & Grade:", 18, 46);
    doc.setFont("helvetica", "normal");
    doc.text(`${line.position} (${line.salaryGrade || "SG-11 Step 1"})`, 48, 46);

    doc.setFont("helvetica", "bold");
    doc.text("Payroll Ref:", 120, 34);
    doc.setFont("helvetica", "normal");
    doc.text(payrollRefNo, 145, 34);

    doc.setFont("helvetica", "bold");
    doc.text("Cutoff Period:", 120, 40);
    doc.setFont("helvetica", "normal");
    doc.text(periodStr, 145, 40);

    doc.setFont("helvetica", "bold");
    doc.text("Attendance / Tardiness:", 120, 46);
    doc.setFont("helvetica", "normal");
    doc.text(`${line.daysWorked} Days (Late: ${line.lateMinutes}m)`, 156, 46);

    // Build earnings rows
    const earningsRows: [string, string][] = [
      ["Monthly Basic Salary", money(line.monthlySalary)],
      ["Cutoff Basic Pay", money(line.basicPay)],
      ["PERA Allowance (DBM Mandate)", money(line.peraAllowance)],
    ];
    if (line.rataAllowance > 0) earningsRows.push(["RATA Allowance", money(line.rataAllowance)]);
    if (line.hazardPay > 0) earningsRows.push(["Hazard Pay (Magna Carta)", money(line.hazardPay)]);
    if (line.overtimePay > 0) earningsRows.push(["Overtime & Night Diff", money(line.overtimePay + line.nightDiffPay)]);
    if (line.otherAllowances > 0) earningsRows.push(["Other Authorized Allowances", money(line.otherAllowances)]);
    for (const add of line.manualAdditions) {
      earningsRows.push([add.description, money(add.amount)]);
    }

    // Build deductions rows
    const deductionsRows: [string, string][] = [
      ["GSIS Personal Share (9%)", money(line.statutory.gsisEmployee)],
      ["PhilHealth Personal Share (2.5%)", money(line.statutory.philhealthEmployee)],
      ["Pag-IBIG Personal Contribution", money(line.statutory.pagibigEmployee)],
    ];
    if (line.gsisLoan > 0) deductionsRows.push(["GSIS Salary Loans", money(line.gsisLoan)]);
    if (line.pagibigLoan > 0) deductionsRows.push(["Pag-IBIG MPL / Calamity Loans", money(line.pagibigLoan)]);
    if (line.taxWithholding > 0) deductionsRows.push(["Withholding Tax (BIR Form 1601-C)", money(line.taxWithholding)]);
    if (line.lateDeduction + line.undertimeDeduction > 0) {
      deductionsRows.push(["CSC Tardiness / Undertime Deductions", money(line.lateDeduction + line.undertimeDeduction)]);
    }
    if (line.coopDeduction + line.unionDues > 0) {
      deductionsRows.push(["Coop / Union Dues", money(line.coopDeduction + line.unionDues)]);
    }
    for (const ded of line.manualDeductions) {
      deductionsRows.push([ded.description, money(ded.amount)]);
    }

    // Pad arrays so table rows align nicely
    const maxRows = Math.max(earningsRows.length, deductionsRows.length);
    const tableBody: any[] = [];
    for (let r = 0; r < maxRows; r++) {
      const e = earningsRows[r] || ["", ""];
      const d = deductionsRows[r] || ["", ""];
      tableBody.push([e[0], e[1], d[0], d[1]]);
    }

    tableBody.push([
      { content: "TOTAL GROSS COMPENSATION", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
      { content: money(line.totalGrossPay), styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
      { content: "TOTAL PERSONAL DEDUCTIONS", styles: { fontStyle: "bold", fillColor: [254, 242, 242] } },
      { content: money(line.totalPersonalDeductions), styles: { fontStyle: "bold", textColor: [220, 38, 38], fillColor: [254, 242, 242] } },
    ]);

    // Detailed Earnings & Deductions Table
    autoTable(doc, {
      startY: 55,
      theme: "grid",
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
      },
      head: [["EARNINGS & ALLOWANCES", "AMOUNT", "MANDATORY & LOAN DEDUCTIONS", "AMOUNT"]],
      body: tableBody,
      margin: { left: 14, right: 14 },
    });

    // Net Take-Home Pay Highlight Box
    // @ts-expect-error jspdf-autotable extends doc with lastAutoTable
    const afterTableY = doc.lastAutoTable.finalY + 4;

    doc.setFillColor(236, 253, 245); // light emerald
    doc.setDrawColor(52, 211, 153);
    doc.roundedRect(14, afterTableY, 182, 13, 2, 2, "FD");

    doc.setTextColor(6, 95, 70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("NET TAKE-HOME PAY (NET PAY):", 20, afterTableY + 8.5);

    doc.setFontSize(11.5);
    doc.setTextColor(4, 120, 87);
    doc.text(money(line.netPay), 190, afterTableY + 8.5, { align: "right" });

    // Government Counterpart Section (Hati ng Pamahalaan)
    const govtY = afterTableY + 16;
    doc.setFillColor(238, 242, 255); // light indigo
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(14, govtY, 182, 22, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(49, 46, 129);
    doc.text("GOVERNMENT COUNTERPART SHARE (LGU SHOULDERED CONTRIBUTIONS):", 18, govtY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    doc.text(`• GSIS Government Share (12%): ${money(line.statutory.gsisGovernment)}`, 20, govtY + 10.5);
    doc.text(`• PhilHealth Government Share (2.5%): ${money(line.statutory.philhealthGovernment)}`, 20, govtY + 15);
    doc.text(`• Pag-IBIG Government Share (DBM): ${money(line.statutory.pagibigGovernment)}`, 20, govtY + 19.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(67, 56, 202);
    doc.text(`Total LGU Share: ${money(line.statutory.totalGovernmentStatutory)}`, 190, govtY + 15, { align: "right" });

    // Signatures / Acknowledgment footer
    const sigY = govtY + 26;
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(20, sigY + 9, 80, sigY + 9);
    doc.line(130, sigY + 9, 190, sigY + 9);
    doc.setLineDashPattern([], 0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Prepared By: Municipal / City Accountant", 25, sigY + 13);
    doc.text("Received By: Employee Signature", 138, sigY + 13);

    doc.setFontSize(6.5);
    doc.text("Official computerized payroll slip of the Local Government Unit pursuant to COA/DBM regulations.", 105, sigY + 20, { align: "center" });
  });

  const filePrefix = singleEmployeeId && targetLines[0]
    ? `payslip_${targetLines[0].employeeName.replace(/\s+/g, "_").toLowerCase()}`
    : `lgu_bulk_payslips_${payrollRefNo.toLowerCase()}`;

  doc.save(`${filePrefix}.pdf`);
}
