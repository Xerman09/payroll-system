// modules/benefit-settings/utils/employeeBenefitsPdf.ts
"use client";

import type { EmployeeBenefitCoverage, BenefitReportFilter, CoverageStatusFilter } from "../types";
import { formatMoney } from "../providers/benefitApi";
import { format } from "date-fns";

export type BenefitReportPaperSize = "LETTER" | "A4" | "LEGAL";

function paperToJsPdfFormat(paper: BenefitReportPaperSize): "letter" | "a4" | "legal" {
  if (paper === "A4") return "a4";
  if (paper === "LEGAL") return "legal";
  return "letter";
}

export async function exportEmployeeBenefitsPdf(args: {
  paper?: BenefitReportPaperSize;
  companyName?: string;
  isGovernment?: boolean;

  filterBenefit: BenefitReportFilter;
  filterStatus: CoverageStatusFilter;
  departmentLabel?: string;
  searchQuery?: string;

  coverages: EmployeeBenefitCoverage[];
}): Promise<Blob> {
  const {
    paper = "LETTER",
    companyName = "MEN2 MARKETING CORPORATION",
    isGovernment = false,
    filterBenefit,
    filterStatus,
    departmentLabel = "All Departments",
    searchQuery = "",
    coverages,
  } = args;

  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);

  const formatSize = paperToJsPdfFormat(paper);

  const isLandscape = filterBenefit === "ALL";

  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: formatSize,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 36;

  // Colors
  const DARK_NAVY = [15, 23, 42] as [number, number, number];
  const PRIMARY_BLUE = [37, 99, 235] as [number, number, number];
  const ACCENT_CYAN = [14, 165, 233] as [number, number, number];
  const BORDER_GRAY = [226, 232, 240] as [number, number, number];

  const setFill = (rgb: number[]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setText = (rgb: number[]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

  const sssLabel = isGovernment ? "GSIS" : "SSS";

  // Dynamic Title
  let reportTitle = "Employee Benefits Coverage & Remittance Report";
  if (filterBenefit === "SSS") reportTitle = `${sssLabel} Statutory Contributions Report`;
  else if (filterBenefit === "PHILHEALTH") reportTitle = "PhilHealth Statutory Contributions Report";
  else if (filterBenefit === "PAGIBIG") reportTitle = "Pag-IBIG Fund (HDMF) Contributions Report";
  else if (filterBenefit === "LOANS") reportTitle = "Employee Benefit Loans Masterlist";

  const renderHeader = () => {
    // Top colored accent bars
    setFill(DARK_NAVY);
    doc.rect(0, 0, pageW, 10, "F");
    setFill(PRIMARY_BLUE);
    doc.rect(0, 10, 160, 4, "F");
    setFill(ACCENT_CYAN);
    doc.rect(160, 10, 80, 4, "F");

    let curY = 38;
    setText(DARK_NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(companyName.toUpperCase(), marginX, curY);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setText([100, 116, 139]);
    curY += 14;
    doc.text(
      isGovernment ? "Government / Public Sector Compensation & Benefits" : "Compensation & Statutory Benefits Management",
      marginX,
      curY
    );

    // Right-aligned report title & date
    let rightY = 36;
    setText(PRIMARY_BLUE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(reportTitle, pageW - marginX, rightY, { align: "right" });

    rightY += 14;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    setText([100, 116, 139]);
    const generatedDate = format(new Date(), "MMM dd, yyyy • hh:mm a");
    doc.text(`Generated: ${generatedDate}`, pageW - marginX, rightY, { align: "right" });

    // Filter Badges / Summary Line
    curY += 16;
    doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
    doc.setLineWidth(1);
    doc.line(marginX, curY, pageW - marginX, curY);

    curY += 14;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    setText(DARK_NAVY);
    doc.text("Filters Applied:", marginX, curY);

    doc.setFont("helvetica", "normal");
    setText([71, 85, 105]);

    const getStatusLabel = (s: CoverageStatusFilter) => {
      switch (s) {
        case "ACTIVE_ONLY": return "Active Employees Only";
        case "INACTIVE_ONLY": return "Inactive Employees Only";
        case "HIDE_ZERO_RATE": return "Hide ₱0 Rate (> ₱0.00)";
        case "ZERO_RATE_ONLY": return "₱0.00 Monthly Rate Only";
        case "HAS_SSS": return `Has ${sssLabel} (> ₱0)`;
        case "NO_SSS": return `No ${sssLabel} (₱0)`;
        case "HAS_PHILHEALTH": return "Has PhilHealth (> ₱0)";
        case "NO_PHILHEALTH": return "No PhilHealth (₱0)";
        case "HAS_PAGIBIG": return "Has Pag-IBIG (> ₱0)";
        case "NO_PAGIBIG": return "No Pag-IBIG (₱0)";
        case "FULL_COVERAGE": return "Complete Coverage (All 3)";
        case "WITH_BENEFIT": return "With Benefit Amount (> ₱0)";
        case "WITHOUT_BENEFIT": return "Without Benefit Amount (₱0)";
        case "WITH_LOAN": return "With Active Loans";
        case "HAS_SSS_ID": return `Has ${sssLabel} Account No.`;
        case "MISSING_SSS_ID": return `Missing ${sssLabel} Account No.`;
        default: return "All Employees";
      }
    };

    const filterTexts = [
      `Benefit: ${filterBenefit === "ALL" ? "All Benefits" : filterBenefit === "SSS" ? sssLabel : filterBenefit}`,
      `Status: ${getStatusLabel(filterStatus)}`,
      `Dept: ${departmentLabel}`,
      searchQuery ? `Search: "${searchQuery}"` : null,
      `Headcount: ${coverages.length} employee${coverages.length === 1 ? "" : "s"}`,
    ].filter(Boolean).join("  |  ");

    doc.text(filterTexts, marginX + 75, curY);

    return curY + 12;
  };

  const startY = renderHeader();

  // Columns and Rows according to filterBenefit
  let head: string[][] = [];
  let body: (string | number)[][] = [];

  if (filterBenefit === "ALL") {
    head = [
      [
        "Employee",
        "Department",
        `${sssLabel} EE`,
        `${sssLabel} ER`,
        "PH EE",
        "PH ER",
        "HDMF EE",
        "HDMF ER",
        "Loans",
        "Total EE",
        "Total ER",
        "Remittance",
      ],
    ];

    body = coverages.map((c) => [
      c.employee_name,
      c.department_name,
      formatMoney(c.sss.personal_share),
      formatMoney(c.sss.counterpart_share),
      formatMoney(c.philhealth.personal_share),
      formatMoney(c.philhealth.counterpart_share),
      formatMoney(c.pagibig.personal_share),
      formatMoney(c.pagibig.counterpart_share),
      c.total_loan_amortization > 0 ? formatMoney(c.total_loan_amortization) : "—",
      formatMoney(c.total_personal_share),
      formatMoney(c.total_counterpart_share),
      formatMoney(c.grand_total_monthly),
    ]);
  } else if (filterBenefit === "SSS") {
    head = [
      [
        "Employee",
        "Department",
        `${sssLabel} Number`,
        "Monthly Rate",
        "Personal Share",
        `${isGovernment ? "LGU" : "Employer"} Share`,
        "Total Contribution",
        "Active Loan",
        "Status",
      ],
    ];

    body = coverages.map((c) => {
      const sssLoan = c.loans.find((l) => l.benefit_code === "SSS");
      return [
        c.employee_name,
        c.department_name,
        c.sss.account_no || "—",
        c.monthly_rate > 0 ? formatMoney(c.monthly_rate) : "—",
        formatMoney(c.sss.personal_share),
        formatMoney(c.sss.counterpart_share),
        formatMoney(c.sss.total_contribution),
        sssLoan ? `₱${formatMoney(sssLoan.amortization_amount)}/mo` : "None",
        c.sss.personal_share > 0 ? "Active" : c.sss.account_no ? "Registered (₱0)" : "No Benefit",
      ];
    });
  } else if (filterBenefit === "PHILHEALTH") {
    head = [
      [
        "Employee",
        "Department",
        "PhilHealth Number",
        "Monthly Rate",
        "Personal (2.5%)",
        `${isGovernment ? "LGU" : "Employer"} (2.5%)`,
        "Total (5%)",
        "Status",
      ],
    ];

    body = coverages.map((c) => [
      c.employee_name,
      c.department_name,
      c.philhealth.account_no || "—",
      c.monthly_rate > 0 ? formatMoney(c.monthly_rate) : "—",
      formatMoney(c.philhealth.personal_share),
      formatMoney(c.philhealth.counterpart_share),
      formatMoney(c.philhealth.total_contribution),
      c.philhealth.personal_share > 0 ? "Active" : c.philhealth.account_no ? "Registered (₱0)" : "No Benefit",
    ]);
  } else if (filterBenefit === "PAGIBIG") {
    head = [
      [
        "Employee",
        "Department",
        "Pag-IBIG MID",
        "Personal Share",
        `${isGovernment ? "LGU" : "Employer"} Share`,
        "Total Monthly",
        "Active Loan",
        "Status",
      ],
    ];

    body = coverages.map((c) => {
      const hdmfLoan = c.loans.find((l) => l.benefit_code === "PAGIBIG");
      return [
        c.employee_name,
        c.department_name,
        c.pagibig.account_no || "—",
        formatMoney(c.pagibig.personal_share),
        formatMoney(c.pagibig.counterpart_share),
        formatMoney(c.pagibig.total_contribution),
        hdmfLoan ? `₱${formatMoney(hdmfLoan.amortization_amount)}/mo` : "None",
        c.pagibig.personal_share > 0 ? "Active" : c.pagibig.account_no ? "Registered (₱0)" : "No Benefit",
      ];
    });
  } else {
    // LOANS
    head = [
      [
        "Employee",
        "Department",
        "Benefit",
        "Loan Name / Ref",
        "Principal",
        "Monthly Amort.",
        "Remaining Bal.",
        "Deduct On",
      ],
    ];

    const loanRows: (string | number)[][] = [];
    for (const c of coverages) {
      if (c.loans.length === 0) continue;
      for (const l of c.loans) {
        loanRows.push([
          c.employee_name,
          c.department_name,
          l.benefit_code,
          l.loan_name || l.reference_no || "Loan",
          formatMoney(l.principal_amount),
          formatMoney(l.amortization_amount),
          formatMoney(l.remaining_balance),
          l.deduct_on,
        ]);
      }
    }
    body = loanRows;
  }

  // Calculate Column Totals for footer
  let foot: string[][] | undefined = undefined;
  if (filterBenefit === "ALL") {
    const sumSssEe = coverages.reduce((s, c) => s + c.sss.personal_share, 0);
    const sumSssEr = coverages.reduce((s, c) => s + c.sss.counterpart_share, 0);
    const sumPhEe = coverages.reduce((s, c) => s + c.philhealth.personal_share, 0);
    const sumPhEr = coverages.reduce((s, c) => s + c.philhealth.counterpart_share, 0);
    const sumHdmfEe = coverages.reduce((s, c) => s + c.pagibig.personal_share, 0);
    const sumHdmfEr = coverages.reduce((s, c) => s + c.pagibig.counterpart_share, 0);
    const sumLoans = coverages.reduce((s, c) => s + c.total_loan_amortization, 0);
    const sumTotalEe = coverages.reduce((s, c) => s + c.total_personal_share, 0);
    const sumTotalEr = coverages.reduce((s, c) => s + c.total_counterpart_share, 0);
    const sumGrand = coverages.reduce((s, c) => s + c.grand_total_monthly, 0);

    foot = [
      [
        "TOTAL",
        `${coverages.length} Emps`,
        formatMoney(sumSssEe),
        formatMoney(sumSssEr),
        formatMoney(sumPhEe),
        formatMoney(sumPhEr),
        formatMoney(sumHdmfEe),
        formatMoney(sumHdmfEr),
        formatMoney(sumLoans),
        formatMoney(sumTotalEe),
        formatMoney(sumTotalEr),
        formatMoney(sumGrand),
      ],
    ];
  } else if (filterBenefit === "SSS") {
    const sumEe = coverages.reduce((s, c) => s + c.sss.personal_share, 0);
    const sumEr = coverages.reduce((s, c) => s + c.sss.counterpart_share, 0);
    const sumTotal = coverages.reduce((s, c) => s + c.sss.total_contribution, 0);
    foot = [
      [
        "TOTAL",
        `${coverages.length} Emps`,
        "",
        "",
        formatMoney(sumEe),
        formatMoney(sumEr),
        formatMoney(sumTotal),
        "",
        "",
      ],
    ];
  } else if (filterBenefit === "PHILHEALTH") {
    const sumEe = coverages.reduce((s, c) => s + c.philhealth.personal_share, 0);
    const sumEr = coverages.reduce((s, c) => s + c.philhealth.counterpart_share, 0);
    const sumTotal = coverages.reduce((s, c) => s + c.philhealth.total_contribution, 0);
    foot = [
      [
        "TOTAL",
        `${coverages.length} Emps`,
        "",
        "",
        formatMoney(sumEe),
        formatMoney(sumEr),
        formatMoney(sumTotal),
        "",
      ],
    ];
  } else if (filterBenefit === "PAGIBIG") {
    const sumEe = coverages.reduce((s, c) => s + c.pagibig.personal_share, 0);
    const sumEr = coverages.reduce((s, c) => s + c.pagibig.counterpart_share, 0);
    const sumTotal = coverages.reduce((s, c) => s + c.pagibig.total_contribution, 0);
    foot = [
      [
        "TOTAL",
        `${coverages.length} Emps`,
        "",
        formatMoney(sumEe),
        formatMoney(sumEr),
        formatMoney(sumTotal),
        "",
        "",
      ],
    ];
  }

  autoTable(doc, {
    head,
    body,
    foot,
    startY,
    margin: { left: marginX, right: marginX, bottom: 40 },
    theme: "striped",
    headStyles: {
      fillColor: DARK_NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: isLandscape ? 7.5 : 8,
      cellPadding: isLandscape ? 4 : 5,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: DARK_NAVY,
      fontStyle: "bold",
      fontSize: isLandscape ? 7.5 : 8,
      cellPadding: isLandscape ? 4 : 5,
    },
    styles: {
      font: "helvetica",
      fontSize: isLandscape ? 7 : 7.5,
      textColor: [30, 41, 59],
      cellPadding: isLandscape ? 3.5 : 4,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data: { pageNumber: number }) => {
      // Footer page numbering
      const totalPagesExp = "{total_pages_count_string}";
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      setText([148, 163, 184]);
      doc.text(
        `Page ${data.pageNumber} of ${totalPagesExp}  •  ${companyName} Statutory Benefits System`,
        pageW / 2,
        pageH - 18,
        { align: "center" }
      );
    },
  });

  // Put total page count
  if (typeof doc.putTotalPages === "function") {
    doc.putTotalPages("{total_pages_count_string}");
  }

  return doc.output("blob");
}
