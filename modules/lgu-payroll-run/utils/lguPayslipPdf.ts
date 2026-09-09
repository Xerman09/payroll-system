// modules/lgu-payroll-run/utils/lguPayslipPdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LguPayrollLine, CutoffSetting } from "../types";

function money(v: number): string {
  return `PHP ${(v || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
    throw new Error("Walang payslip na mada-download (lahat ay naka-on-hold o walang napili).");
  }

  // Use A4 portrait: 210mm x 297mm
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const periodStr = cutoff
    ? `${cutoff.cutoff_type} CUTOFF (${cutoff.start_date} to ${cutoff.end_date})`
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
    doc.roundedRect(14, 28, 182, 22, 2, 2);

    doc.text("Kawani / Name:", 18, 34);
    doc.setFont("helvetica", "normal");
    doc.text(line.employeeName.toUpperCase(), 48, 34);

    doc.setFont("helvetica", "bold");
    doc.text("Departamento:", 18, 40);
    doc.setFont("helvetica", "normal");
    doc.text(line.departmentName, 48, 40);

    doc.setFont("helvetica", "bold");
    doc.text("Posisyon / Title:", 18, 46);
    doc.setFont("helvetica", "normal");
    doc.text(line.position, 48, 46);

    doc.setFont("helvetica", "bold");
    doc.text("Payroll Ref:", 120, 34);
    doc.setFont("helvetica", "normal");
    doc.text(payrollRefNo, 145, 34);

    doc.setFont("helvetica", "bold");
    doc.text("Panahon / Cutoff:", 120, 40);
    doc.setFont("helvetica", "normal");
    doc.text(periodStr, 145, 40);

    doc.setFont("helvetica", "bold");
    doc.text("Araw ng Pasok:", 120, 46);
    doc.setFont("helvetica", "normal");
    doc.text(`${line.daysWorked} Araw (Late: ${line.lateMinutes} min)`, 145, 46);

    // Detailed Earnings & Deductions Table
    autoTable(doc, {
      startY: 53,
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
      head: [["MGA KINITA (EARNINGS)", "HALAGA", "MGA BAWAS (PERSONAL DEDUCTIONS)", "HALAGA"]],
      body: [
        ["Monthly Basic Salary", money(line.monthlySalary), "GSIS Personal Share (9%)", money(line.statutory.gsisEmployee)],
        ["Cutoff Basic Pay", money(line.basicPay), "PhilHealth Personal Share (2.5%)", money(line.statutory.philhealthEmployee)],
        ["PERA Allowance", money(line.peraAllowance), "Pag-IBIG Personal Contribution", money(line.statutory.pagibigEmployee)],
        ["Overtime Pay", money(line.overtimePay), "GSIS Salary Loan", money(line.gsisLoan)],
        ["Iba pang Allowance", money(line.otherAllowances), "Pag-IBIG Calamity/MPL Loan", money(line.pagibigLoan)],
        ["", "", "Tardy / Undertime Bawas", money(line.lateDeduction + line.undertimeDeduction)],
        ["", "", "Withholding Tax (BIR)", money(line.taxWithholding)],
        [
          { content: "KABUUANG KINITA (GROSS PAY)", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
          { content: money(line.totalGrossPay), styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
          { content: "KABUUANG BAWAS (TOTAL DEDUCTIONS)", styles: { fontStyle: "bold", fillColor: [254, 242, 242] } },
          { content: money(line.totalPersonalDeductions), styles: { fontStyle: "bold", textColor: [220, 38, 38], fillColor: [254, 242, 242] } },
        ],
      ],
      margin: { left: 14, right: 14 },
    });

    // Net Take-Home Pay Highlight Box
    // @ts-expect-error jspdf-autotable extends doc with lastAutoTable
    const afterTableY = doc.lastAutoTable.finalY + 4;

    doc.setFillColor(236, 253, 245); // light emerald
    doc.setDrawColor(52, 211, 153);
    doc.roundedRect(14, afterTableY, 182, 14, 2, 2, "FD");

    doc.setTextColor(6, 95, 70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("NET TAKE-HOME PAY (MATITIRANG SAHOD):", 20, afterTableY + 9);

    doc.setFontSize(12);
    doc.setTextColor(4, 120, 87);
    doc.text(money(line.netPay), 190, afterTableY + 9, { align: "right" });

    // Government Counterpart Section (Hati ng Pamahalaan)
    const govtY = afterTableY + 18;
    doc.setFillColor(238, 242, 255); // light indigo
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(14, govtY, 182, 24, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(49, 46, 129);
    doc.text("GOVERNMENT COUNTERPART SHARE (SAGOT NG LGU / PAMAHALAAN):", 18, govtY + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    doc.text(`• GSIS Government Share (12%): ${money(line.statutory.gsisGovernment)}`, 20, govtY + 11.5);
    doc.text(`• PhilHealth Government Share (2.5%): ${money(line.statutory.philhealthGovernment)}`, 20, govtY + 16.5);
    doc.text(`• Pag-IBIG Government Share (DBM): ${money(line.statutory.pagibigGovernment)}`, 20, govtY + 21.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(67, 56, 202);
    doc.text(`Kabuuang Hulog ng LGU: ${money(line.statutory.totalGovernmentStatutory)}`, 190, govtY + 16.5, { align: "right" });

    // Signatures / Acknowledgment footer
    const sigY = govtY + 32;
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(20, sigY + 10, 80, sigY + 10);
    doc.line(130, sigY + 10, 190, sigY + 10);
    doc.setLineDashPattern([], 0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Inihanda Ni: Municipal / City Accountant", 30, sigY + 14);
    doc.text("Nilagdaan ng Kawani / Employee Signature", 136, sigY + 14);

    doc.setFontSize(6.5);
    doc.text("Ito ay opisyal na computerized payslip ng pamahalaang lokal. Walang bura o lagda ayon sa COA/DBM regulations.", 105, sigY + 22, { align: "center" });
  });

  const filePrefix = singleEmployeeId && targetLines[0]
    ? `payslip_${targetLines[0].employeeName.replace(/\s+/g, "_").toLowerCase()}`
    : `lgu_bulk_payslips_${payrollRefNo.toLowerCase()}`;

  doc.save(`${filePrefix}.pdf`);
}
