// modules/payroll-records/utils/payrollSummaryPdf.ts
import jsPDF from "jspdf";

type Totals = {
  bank: { emp: number; net: number; add: number; remove: number };
  cash: { emp: number; net: number; add: number; remove: number };
  grand: { emp: number; net: number; add: number; remove: number };
  prevBank: { net: number };
  prevCash: { net: number };
};

type CompanySummary = {
  name: string;
  prevNet: number;
  currNet: number;
};

type DeptSummary = {
  name: string;
  bank: { prevEmp: number; currEmp: number; prevNet: number; currNet: number; add: number; remove: number };
  cash: { prevEmp: number; currEmp: number; prevNet: number; currNet: number; add: number; remove: number };
};

export async function buildPayrollSummaryPdf(args: {
  data: any[];
  meta: any;
}) {
  // LEGAL Landscape
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "legal" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const marginTop = 40;

  const ACCENT = { r: 0, g: 0, b: 0 }; // Professional Black
  const GRID = { r: 200, g: 200, b: 200 };

  const fmt = (n: number) => {
    return (n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // --- 1. PROCESS DATA ---
  const companySums: CompanySummary[] = [];
  const deptMap = new Map<string, DeptSummary>();

  let bankAdd = 0, bankRemove = 0, bankPrevNet = 0, bankCurrNet = 0, bankCurrEmp = 0;
  let cashAdd = 0, cashRemove = 0, cashPrevNet = 0, cashCurrNet = 0, cashCurrEmp = 0;

  // Table 2 uses all companies
  for (const c of args.data) {
    companySums.push({
      name: c.companyName,
      prevNet: Number(c.prevRun?.total_net || 0),
      currNet: Number(c.currentRun?.total_net || 0),
    });
  }

  // Tables 1, 3, and 4 use ONLY the first company (Dummy / 8056)
  const dummyData = args.data[0];
  if (dummyData) {
    const currIds = new Set(dummyData.currEmps.map((e: any) => e.user_id));
    const prevIds = new Set(dummyData.prevEmps.map((e: any) => e.user_id));

    // Stats for Table 1
    dummyData.currEmps.forEach((e: any) => {
      const isCard = Number(e.is_card) === 1;
      if (isCard) {
        bankCurrNet += Number(e.net_pay);
        bankCurrEmp++;
        if (!prevIds.has(e.user_id)) bankAdd++;
      } else {
        cashCurrNet += Number(e.net_pay);
        cashCurrEmp++;
        if (!prevIds.has(e.user_id)) cashAdd++;
      }
    });

    dummyData.prevEmps.forEach((e: any) => {
      const isCard = Number(e.is_card) === 1;
      if (isCard) {
        bankPrevNet += Number(e.net_pay);
        if (!currIds.has(e.user_id)) bankRemove++;
      } else {
        cashPrevNet += Number(e.net_pay);
        if (!currIds.has(e.user_id)) cashRemove++;
      }
    });

    // Dept Map for Tables 3 & 4
    const allDepts = Array.from(new Set([
      ...dummyData.currEmps.map((e: any) => (e.department_name_snapshot || e.department_name || "Unknown")),
      ...dummyData.prevEmps.map((e: any) => (e.department_name_snapshot || e.department_name || "Unknown"))
    ]));

    allDepts.forEach(dName => {
      let d = deptMap.get(dName);
      if (!d) {
        d = {
          name: dName,
          bank: { prevEmp: 0, currEmp: 0, prevNet: 0, currNet: 0, add: 0, remove: 0 },
          cash: { prevEmp: 0, currEmp: 0, prevNet: 0, currNet: 0, add: 0, remove: 0 },
        };
        deptMap.set(dName, d);
      }

      const cDepts = dummyData.currEmps.filter((e: any) => (e.department_name_snapshot || e.department_name) === dName);
      const pDepts = dummyData.prevEmps.filter((e: any) => (e.department_name_snapshot || e.department_name) === dName);
      const cIds = new Set(cDepts.map((e: any) => e.user_id));
      const pIds = new Set(pDepts.map((e: any) => e.user_id));

      cDepts.forEach((e: any) => {
        const isCard = Number(e.is_card) === 1;
        if (isCard) {
          d!.bank.currEmp++;
          d!.bank.currNet += Number(e.net_pay);
          if (!pIds.has(e.user_id)) d!.bank.add++;
        } else {
          d!.cash.currEmp++;
          d!.cash.currNet += Number(e.net_pay);
          if (!pIds.has(e.user_id)) d!.cash.add++;
        }
      });

      pDepts.forEach((e: any) => {
        const isCard = Number(e.is_card) === 1;
        if (isCard) {
          d!.bank.prevEmp++;
          d!.bank.prevNet += Number(e.net_pay);
          if (!cIds.has(e.user_id)) d!.bank.remove++;
        } else {
          d!.cash.prevEmp++;
          d!.cash.prevNet += Number(e.net_pay);
          if (!cIds.has(e.user_id)) d!.cash.remove++;
        }
      });
    });
  }

  // --- 2. DRAWING ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PAYROLL SUMMARY", pageW / 2, marginTop, { align: "center" });

  doc.setFontSize(12);
  doc.text("Company Name", pageW / 2, marginTop + 20, { align: "center" });

  const cutoffLabel = args.meta.currentCutoff
    ? `Cutoff: ${args.meta.currentCutoff.start} to ${args.meta.currentCutoff.end}`
    : "Cutoff: All";
  doc.setFont("helvetica", "normal");
  doc.text(cutoffLabel, pageW / 2, marginTop + 36, { align: "center" });

  let cy = marginTop + 70;

  // TABLE 1: SUMMARY
  const drawTable1 = () => {
    const colW = [60, 100, 100, 50, 60, 100];
    const x0 = marginX;
    const headers = ["", "Total Employee", "Prev. Cutoff", "ADD", "REMOVE", "Current Cutoff"];
    const subHeaders = ["", "(No. of Employees)", "(Total Net)", "", "", "(Total Net)"];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    // Header
    let cx = x0;
    headers.forEach((h, i) => {
      doc.text(h, cx + colW[i] / 2, cy, { align: "center" });
      doc.setFontSize(8);
      doc.text(subHeaders[i], cx + colW[i] / 2, cy + 10, { align: "center" });
      doc.setFontSize(10);
      cx += colW[i];
    });

    cy += 20;
    doc.line(x0, cy, x0 + 470, cy);
    cy += 15;

    const rows = [
      { label: "BANK", emp: bankCurrEmp, prev: bankPrevNet, add: bankAdd, rem: bankRemove, curr: bankCurrNet },
      { label: "CASH", emp: cashCurrEmp, prev: cashPrevNet, add: cashAdd, rem: cashRemove, curr: cashCurrNet },
      {
        label: "TOTAL:",
        emp: bankCurrEmp + cashCurrEmp,
        prev: bankPrevNet + cashPrevNet,
        add: bankAdd + cashAdd,
        rem: bankRemove + cashRemove,
        curr: bankCurrNet + cashCurrNet
      },
    ];

    rows.forEach((r, idx) => {
      if (idx === 2) doc.setFont("helvetica", "bold");
      else doc.setFont("helvetica", "normal");

      cx = x0;
      doc.text(r.label, cx, cy);
      doc.text(String(r.emp), cx + colW[0] + colW[1] / 2, cy, { align: "center" });
      doc.text(fmt(r.prev), cx + colW[0] + colW[1] + colW[2] / 2, cy, { align: "center" });
      doc.text(r.add > 0 ? String(r.add) : "-", cx + colW[0] + colW[1] + colW[2] + colW[3] / 2, cy, { align: "center" });
      doc.text(r.rem > 0 ? String(r.rem) : "-", cx + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] / 2, cy, { align: "center" });
      doc.text(fmt(r.curr), cx + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] / 2, cy, { align: "center" });
      cy += 15;
    });

    // Bottom border of Table 1
    doc.line(x0, cy - 5, x0 + 470, cy - 5);
  };

  // TABLE 2: COMPANY LIST
  const drawTable2 = () => {
    const table2X = pageW - marginX - 250;
    let ty = marginTop + 70;
    const colW = [110, 70, 70];

    doc.setFont("helvetica", "bold");
    doc.text("Company Name", table2X + colW[0] / 2, ty, { align: "center" });
    doc.text("Prev. Cutoff", table2X + colW[0] + colW[1] / 2, ty, { align: "center" });
    doc.text("Current Cutoff", table2X + colW[0] + colW[1] + colW[2] / 2, ty, { align: "center" });

    ty += 12;
    doc.setFontSize(8);
    doc.text("Net", table2X + colW[0] + colW[1] / 2, ty, { align: "center" });
    doc.text("Net", table2X + colW[0] + colW[1] + colW[2] / 2, ty, { align: "center" });

    ty += 8;
    doc.line(table2X, ty, table2X + 250, ty);
    ty += 15;

    let tPrev = 0;
    let tCurr = 0;

    companySums.forEach(c => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(c.name, table2X, ty);
      doc.text(fmt(c.prevNet), table2X + colW[0] + colW[1] / 2, ty, { align: "center" });
      doc.text(fmt(c.currNet), table2X + colW[0] + colW[1] + colW[2] / 2, ty, { align: "center" });
      tPrev += c.prevNet;
      tCurr += c.currNet;
      ty += 15;
    });

    doc.setFont("helvetica", "bold");
    doc.text("Total =", table2X, ty);
    doc.text(fmt(tPrev), table2X + colW[0] + colW[1] / 2, ty, { align: "center" });
    doc.text(fmt(tCurr), table2X + colW[0] + colW[1] + colW[2] / 2, ty, { align: "center" });

    doc.line(table2X, ty + 5, table2X + 250, ty + 5);
  };

  drawTable1();
  drawTable2();

  cy += 40;

  const drawDeptTable = (title: string, isBank: boolean) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, marginX, cy);
    cy += 15;

    const colW = [140, 80, 80, 50, 60, 80, 80];
    const headers = ["Department", "Total Employees", "Prev. Cutoff", "Add", "Remove", "Total Employees", "Current Cutoff"];

    doc.setFontSize(8.5);
    let cx = marginX;
    headers.forEach((h, i) => {
      doc.text(h, cx + colW[i] / 2, cy, { align: "center" });
      cx += colW[i];
    });
    cy += 10;
    doc.setFontSize(7.5);
    cx = marginX + colW[0] + colW[1];
    doc.text("Total Net", cx + colW[2] / 2, cy, { align: "center" });
    cx += colW[2] + colW[3] + colW[4] + colW[5];
    doc.text("Total Net", cx + colW[6] / 2, cy, { align: "center" });

    cy += 5;
    doc.line(marginX, cy, pageW - marginX, cy);
    cy += 15;

    let tPrevEmp = 0, tCurrEmp = 0, tPrevNet = 0, tCurrNet = 0, tAdd = 0, tRem = 0;

    const depts = Array.from(deptMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    depts.forEach(d => {
      const data = isBank ? d.bank : d.cash;
      if (data.currEmp === 0 && data.prevEmp === 0) return;

      doc.setFont("helvetica", "normal");
      cx = marginX;
      doc.text(d.name, cx, cy);
      doc.text(String(data.prevEmp), cx + colW[0] + colW[1] / 2, cy, { align: "center" });
      doc.text(fmt(data.prevNet), cx + colW[0] + colW[1] + colW[2] / 2, cy, { align: "center" });
      doc.text(data.add > 0 ? String(data.add) : "-", cx + colW[0] + colW[1] + colW[2] + colW[3] / 2, cy, { align: "center" });
      doc.text(data.remove > 0 ? String(data.remove) : "-", cx + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] / 2, cy, { align: "center" });
      doc.text(String(data.currEmp), cx + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] / 2, cy, { align: "center" });
      doc.text(fmt(data.currNet), cx + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] + colW[6] / 2, cy, { align: "center" });

      tPrevEmp += data.prevEmp;
      tCurrEmp += data.currEmp;
      tPrevNet += data.prevNet;
      tCurrNet += data.currNet;
      tAdd += data.add;
      tRem += data.remove;
      cy += 15;
    });

    doc.setFont("helvetica", "bold");
    doc.text("Total =", marginX, cy);
    cx = marginX + colW[0];
    doc.text(String(tPrevEmp), cx + colW[1] / 2, cy, { align: "center" });
    doc.text(fmt(tPrevNet), cx + colW[1] + colW[2] / 2, cy, { align: "center" });
    doc.text(tAdd > 0 ? String(tAdd) : "-", cx + colW[1] + colW[2] + colW[3] / 2, cy, { align: "center" });
    doc.text(tRem > 0 ? String(tRem) : "-", cx + colW[1] + colW[2] + colW[3] + colW[4] / 2, cy, { align: "center" });
    doc.text(String(tCurrEmp), cx + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] / 2, cy, { align: "center" });
    doc.text(fmt(tCurrNet), cx + colW[1] + colW[2] + colW[3] + colW[4] + colW[5] + colW[6] / 2, cy, { align: "center" });

    cy += 5;
    doc.line(marginX, cy, pageW - marginX, cy);
    cy += 30;
  };

  const dummyName = dummyData?.companyName || "Company";
  drawDeptTable(`${dummyName} [BANK]`, true);
  if (cy > pageH - 100) { doc.addPage(); cy = marginTop; }
  drawDeptTable(`${dummyName} [CASH]`, false);

  const fileName = `Payroll_Summary_${args.meta.currentCutoff?.start || "All"}.pdf`;
  doc.save(fileName);
}
