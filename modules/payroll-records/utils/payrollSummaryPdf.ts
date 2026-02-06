// modules/payroll-records/utils/payrollSummaryPdf.ts
import jsPDF from "jspdf";

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

type RGB = { r: number; g: number; b: number };

export async function buildPayrollSummaryPdf(args: { data: any[]; meta: any }) {
  // ✅ Portrait + Legal (one page only)
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "legal" });
  const pageW = doc.internal.pageSize.getWidth();  // ~612
  const pageH = doc.internal.pageSize.getHeight(); // ~1008

  // Layout
  const M = 28;
  const innerW = pageW - M * 2;
  const footerH = 22;

  // Theme (blue-800)
  const BLUE_800: RGB = { r: 30, g: 64, b: 175 };
  const BLUE_900: RGB = { r: 30, g: 58, b: 138 };
  const BLUE_50: RGB = { r: 239, g: 246, b: 255 };
  const SLATE_900: RGB = { r: 15, g: 23, b: 42 };
  const SLATE_600: RGB = { r: 71, g: 85, b: 105 };
  const GRAY_200: RGB = { r: 226, g: 232, b: 240 };
  const GRAY_300: RGB = { r: 203, g: 213, b: 225 };
  const WHITE: RGB = { r: 255, g: 255, b: 255 };
  const ROW_ZEBRA: RGB = { r: 248, g: 250, b: 252 };

  const setFill = (c: RGB) => doc.setFillColor(c.r, c.g, c.b);
  const setDraw = (c: RGB) => doc.setDrawColor(c.r, c.g, c.b);
  const setText = (c: RGB) => doc.setTextColor(c.r, c.g, c.b);

  const safeStr = (v: any, fb = "") => {
    const s = String(v ?? "").trim();
    return s ? s : fb;
  };

  const fmtMoney = (n: number) =>
    (Number(n || 0) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtInt = (n: number) =>
    (Number(n || 0) || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 });

  const fmtDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const dashIfZero = (n: number) => (Number(n || 0) > 0 ? String(n) : "—");

  const ellipsize = (text: string, maxW: number) => {
    const raw = safeStr(text, "—");
    if (doc.getTextWidth(raw) <= maxW) return raw;
    let t = raw;
    while (t.length > 0 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
    return t.length ? `${t}…` : "—";
  };

  // Card helpers
  const drawCard = (x: number, y: number, w: number, h: number) => {
    setFill(WHITE);
    setDraw(GRAY_200);
    doc.setLineWidth(1);
    doc.roundedRect(x, y, w, h, 10, 10, "FD");
  };

  const drawPill = (x: number, y: number, text: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    const padX = 10;
    const padY = 6;
    const tw = doc.getTextWidth(text);
    const w = tw + padX * 2;
    const h = 20;

    setFill(BLUE_50);
    setDraw(GRAY_200);
    doc.roundedRect(x, y - 14, w, h, 10, 10, "FD");

    setText(BLUE_900);
    doc.text(text, x + padX, y);
    return w;
  };

  const sectionTitle = (x: number, y: number, t: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(SLATE_900);
    doc.text(t, x, y);
  };

  // Simple table drawer (NO page breaks — one page only)
  type Col = { key: string; label: string; w: number; align?: "left" | "right" | "center" };

  const drawTable = (opts: {
    x: number;
    y: number;
    w: number;
    cols: Col[];
    rows: any[];
    maxRows: number;
    headerH?: number;
    rowH?: number;
    fontSize?: number;
    headerFontSize?: number;
    highlightLastRow?: boolean;
  }) => {
    const x = opts.x;
    let y = opts.y;
    const w = opts.w;
    const headerH = opts.headerH ?? 20;
    const rowH = opts.rowH ?? 18;
    const fontSize = opts.fontSize ?? 7.5;
    const headerFontSize = opts.headerFontSize ?? 8;

    // Scale columns
    const sumW = opts.cols.reduce((total, c) => total + c.w, 0);
    if (sumW !== w) {
      const ratio = w / sumW;
      let running = 0;
      for (let i = 0; i < opts.cols.length; i++) {
        const nw = i === opts.cols.length - 1 ? w - running : Math.max(24, Math.floor(opts.cols[i].w * ratio));
        opts.cols[i].w = nw;
        running += nw;
      }
    }

    // Header Background (Flat)
    setFill(BLUE_50);
    doc.rect(x + 1, y, w - 2, headerH, "F");

    // Header Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headerFontSize);
    setText(BLUE_900);

    let cx = x;
    for (const c of opts.cols) {
      const tx =
        c.align === "right" ? cx + c.w - 8 : c.align === "center" ? cx + c.w / 2 : cx + 8;
      doc.text(c.label, tx, y + 13, {
        align: c.align === "right" ? "right" : c.align === "center" ? "center" : "left",
      });
      cx += c.w;
    }

    // Sub-header Divider
    setDraw(GRAY_200);
    doc.setLineWidth(0.5);
    doc.line(x + 1, y + headerH, x + w - 1, y + headerH);

    y += headerH;

    // rows (truncate)
    const rows = opts.rows.slice(0, Math.max(0, opts.maxRows));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);

    for (let i = 0; i < rows.length; i++) {
      // zebra
      if (i % 2 === 0) {
        setFill(ROW_ZEBRA);
        doc.rect(x + 1, y, w - 2, rowH, "F");
      }

      const isLast = opts.highlightLastRow && i === rows.length - 1;
      if (isLast) {
        setFill(BLUE_50);
        doc.rect(x + 1, y, w - 2, rowH, "F");
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }

      cx = x;
      for (const c of opts.cols) {
        const raw = rows[i]?.[c.key] ?? "—";

        const tx =
          c.align === "right" ? cx + c.w - 8 : c.align === "center" ? cx + c.w / 2 : cx + 8;

        setText(SLATE_900);
        doc.text(raw, tx, y + 12, {
          align: c.align === "right" ? "right" : c.align === "center" ? "center" : "left",
        });

        cx += c.w;
      }

      // row line (even subtler)
      setDraw(GRAY_200);
      doc.setLineWidth(0.5);
      doc.line(x + 8, y + rowH, x + w - 8, y + rowH);

      y += rowH;
    }

    return y;
  };

  // ─────────────────────────────────────────────
  // 1) PROCESS DATA (Aggregate across ALL companies)
  // ─────────────────────────────────────────────
  const companySums: CompanySummary[] = [];
  const deptMap = new Map<string, DeptSummary>();

  let bankAdd = 0, bankRemove = 0, bankPrevNet = 0, bankCurrNet = 0, bankCurrEmp = 0, bankPrevEmp = 0;
  let cashAdd = 0, cashRemove = 0, cashPrevNet = 0, cashCurrNet = 0, cashCurrEmp = 0, cashPrevEmp = 0;

  for (const c of args.data || []) {
    companySums.push({
      name: safeStr(c?.companyName, "—"),
      prevNet: Number(c?.prevRun?.total_net || 0),
      currNet: Number(c?.currentRun?.total_net || 0),
    });
  }

  // ─────────────────────────────────────────────
  // 1.1) PROCESS DATA FOR SUMMARIES (Main Company ONLY - 8056)
  // ─────────────────────────────────────────────
  const mainDeptMap = new Map<string, DeptSummary>();
  const mainCompany = (args.data || []).find(c => c.companyName?.includes("8056")) || (args.data || [])[0];

  if (mainCompany) {
    const mCurrEmps = mainCompany.currEmps || [];
    const mPrevEmps = mainCompany.prevEmps || [];
    const mCurrIds = new Set(mCurrEmps.map((e: any) => e.user_id));
    const mPrevIds = new Set(mPrevEmps.map((e: any) => e.user_id));

    // Aggregate BANK/CASH totals from Main Company
    mCurrEmps.forEach((e: any) => {
      const isCard = Number(e.is_card) === 1;
      if (isCard) {
        bankCurrNet += Number(e.net_pay);
        bankCurrEmp++;
        if (!mPrevIds.has(e.user_id)) bankAdd++;
      } else {
        cashCurrNet += Number(e.net_pay);
        cashCurrEmp++;
        if (!mPrevIds.has(e.user_id)) cashAdd++;
      }
    });

    mPrevEmps.forEach((e: any) => {
      const isCard = Number(e.is_card) === 1;
      if (isCard) {
        bankPrevNet += Number(e.net_pay);
        bankPrevEmp++;
        if (!mCurrIds.has(e.user_id)) bankRemove++;
      } else {
        cashPrevNet += Number(e.net_pay);
        cashPrevEmp++;
        if (!mCurrIds.has(e.user_id)) cashRemove++;
      }
    });

    // Populate Department Map
    const depts = Array.from(new Set([
      ...mCurrEmps.map((e: any) => e.department_name_snapshot || e.department_name || "Unknown"),
      ...mPrevEmps.map((e: any) => e.department_name_snapshot || e.department_name || "Unknown"),
    ]));

    depts.forEach(dName => {
      const d: DeptSummary = {
        name: dName,
        bank: { prevEmp: 0, currEmp: 0, prevNet: 0, currNet: 0, add: 0, remove: 0 },
        cash: { prevEmp: 0, currEmp: 0, prevNet: 0, currNet: 0, add: 0, remove: 0 },
      };

      const cIn = mCurrEmps.filter((e: any) => (e.department_name_snapshot || e.department_name || "Unknown") === dName);
      const pIn = mPrevEmps.filter((e: any) => (e.department_name_snapshot || e.department_name || "Unknown") === dName);

      cIn.forEach((e: any) => {
        const isCard = Number(e.is_card) === 1;
        const target = isCard ? d.bank : d.cash;
        target.currEmp++;
        target.currNet += Number(e.net_pay);
        if (!mPrevIds.has(e.user_id)) target.add++;
      });
      pIn.forEach((e: any) => {
        const isCard = Number(e.is_card) === 1;
        const target = isCard ? d.bank : d.cash;
        target.prevEmp++;
        target.prevNet += Number(e.net_pay);
        if (!mCurrIds.has(e.user_id)) target.remove++;
      });
      mainDeptMap.set(dName, d);
    });
  }

  const grandPrevNet = bankPrevNet + cashPrevNet;
  const grandCurrNet = bankCurrNet + cashCurrNet;
  const grandCurrEmp = bankCurrEmp + cashCurrEmp;
  const grandPrevEmp = bankPrevEmp + cashPrevEmp;

  const reportCompany =
    safeStr(args?.meta?.companyName) ||
    (args?.data?.length > 0 ? safeStr(args?.data?.[0]?.companyName, "Men2 Marketing Corporation") : "All Companies");

  const cutoffLabel = args?.meta?.currentCutoff
    ? `${fmtDate(args.meta.currentCutoff.start)} to ${fmtDate(args.meta.currentCutoff.end)}`
    : "All";

  const createdAt =
    args?.meta?.createdAt ||
    new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ─────────────────────────────────────────────
  // 2) DRAW (ONE PAGE ONLY)
  // ─────────────────────────────────────────────
  const HEADER_H = 70;

  // Header bar
  setFill(BLUE_800);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  setText(WHITE);
  doc.text("Payroll Summary Report", M, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(WHITE);
  doc.text(`${reportCompany} • Cutoff: ${cutoffLabel}`, M, 50);
  doc.text(`Created: ${createdAt}`, pageW - M, 50, { align: "right" });

  setDraw(GRAY_300);
  doc.setLineWidth(1);
  doc.line(M, HEADER_H, pageW - M, HEADER_H);

  let y = HEADER_H + 14;

  // Ribbon
  const ribbonH = 24;
  setFill(BLUE_900);
  doc.roundedRect(M, y, innerW, ribbonH, 8, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(WHITE);
  doc.text(`Report Totals for: ${cutoffLabel}`, M + 12, y + 16);
  y += ribbonH + 12;

  // KPI row (smaller to save space)
  {
    const gap = 10;
    const cardW = (innerW - gap * 2) / 3;
    const cardH = 58;

    const drawKpi = (x: number, title: string, value: string, sub?: string) => {
      drawCard(x, y, cardW, cardH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setText(SLATE_600);
      doc.text(title, x + 12, y + 18);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      setText(SLATE_900);
      doc.text(value, x + 12, y + 40);

      if (sub) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        setText(SLATE_600);
        doc.text(sub, x + 12, y + 54);
      }
    };

    drawKpi(M, "Total Employees", `${fmtInt(grandCurrEmp)} / ${fmtInt(grandPrevEmp)}`, `Add: ${fmtInt(bankAdd + cashAdd)}  •  Remove: ${fmtInt(bankRemove + cashRemove)}`);
    drawKpi(M + cardW + gap, "Previous Cutoff • Total Net", `PHP ${fmtMoney(bankPrevNet + cashPrevNet)}`);
    drawKpi(M + (cardW + gap) * 2, "Current Cutoff • Total Net", `PHP ${fmtMoney(bankCurrNet + cashCurrNet)}`);

    y += cardH + 12;
  }

  // Two-column row: Payment + Company totals (to save vertical space)
  {
    const gap = 12;
    const colWLeft = Math.floor(innerW * 0.56); // ~62% for payment summary
    const colWRight = innerW - gap - colWLeft;
    const leftX = M;
    const rightX = M + colWLeft + gap;

    const cardH = 190;

    // LEFT: Payment Method Summary (expanded)
    drawCard(leftX, y, colWLeft, cardH);
    sectionTitle(leftX + 14, y + 24, "Payment Method Summary");

    const pillText = "BANK vs CASH";
    const pillW = doc.getTextWidth(pillText) + 20;
    drawPill(leftX + colWLeft - pillW - 12, y + 24, pillText); // align with tablePad

    const tablePad = 12;
    const tX = leftX + tablePad;
    const tW = colWLeft - tablePad * 2;
    let tY = y + 38;

    const payCols: Col[] = [
      { key: "m", label: "Method", w: 45, align: "left" },
      { key: "pEmp", label: "Prev Emp", w: 45, align: "right" },
      { key: "cEmp", label: "Curr Emp", w: 45, align: "right" },
      { key: "add", label: "+", w: 20, align: "right" },
      { key: "rem", label: "-", w: 20, align: "right" },
      { key: "prev", label: "Previous Net", w: (tW - 175) / 2, align: "right" },
      { key: "net", label: "Current Net", w: (tW - 175) / 2, align: "right" },
    ];

    const payRows = [
      { m: "BANK", pEmp: fmtInt(bankPrevEmp), cEmp: fmtInt(bankCurrEmp), add: dashIfZero(bankAdd), rem: dashIfZero(bankRemove), prev: fmtMoney(bankPrevNet), net: fmtMoney(bankCurrNet) },
      { m: "CASH", pEmp: fmtInt(cashPrevEmp), cEmp: fmtInt(cashCurrEmp), add: dashIfZero(cashAdd), rem: dashIfZero(cashRemove), prev: fmtMoney(cashPrevNet), net: fmtMoney(cashCurrNet) },
      { m: "TOTAL", pEmp: fmtInt(grandPrevEmp), cEmp: fmtInt(grandCurrEmp), add: dashIfZero(bankAdd + cashAdd), rem: dashIfZero(bankRemove + cashRemove), prev: fmtMoney(grandPrevNet), net: fmtMoney(grandCurrNet) },
    ];

    drawTable({
      x: tX,
      y: tY,
      w: tW,
      cols: payCols,
      rows: payRows,
      maxRows: 3,
      highlightLastRow: true,
    });

    // RIGHT: Company Totals (narrower card)
    drawCard(rightX, y, colWRight, cardH);
    sectionTitle(rightX + 14, y + 24, "Company Totals");

    const compPill = `${companySums.length} Cos`;
    const compPillW = doc.getTextWidth(compPill) + 20;
    drawPill(rightX + colWRight - compPillW - 12, y + 24, compPill);

    const ctX = rightX + tablePad;
    const ctW = colWRight - tablePad * 2;
    const ctY = y + 38;

    const compSorted = [...companySums].sort((a, b) => Math.abs(b.currNet) - Math.abs(a.currNet));
    const totalPrevAll = compSorted.reduce((a, c) => a + (c.prevNet || 0), 0);
    const totalCurrAll = compSorted.reduce((a, c) => a + (c.currNet || 0), 0);

    // rows that fit inside this card
    // available height for rows = cardH - (top padding area ~ 38) - headerH - bottom padding (~18)
    const headerH = 20;
    const rowH = 18;
    const availableRows = Math.max(3, Math.floor((cardH - 38 - headerH - 18) / rowH));
    // reserve 1 row for TOTAL
    const usable = Math.max(1, availableRows - 1);

    const rowsShown = compSorted.slice(0, usable);
    const remaining = Math.max(0, compSorted.length - rowsShown.length);

    const compCols: Col[] = [
      { key: "c", label: "Company", w: Math.floor(ctW * 0.40), align: "left" },
      { key: "prev", label: "Prev. Net", w: Math.floor(ctW * 0.30), align: "right" },
      { key: "net", label: "Curr. Net", w: ctW - Math.floor(ctW * 0.40) - Math.floor(ctW * 0.30), align: "right" },
    ];

    const compRows: Record<string, string>[] = rowsShown.map((c) => ({
      c: ellipsize(c.name, compCols[0].w - 8),
      prev: fmtMoney(c.prevNet),
      net: fmtMoney(c.currNet),
    }));

    if (remaining > 0 && compRows.length > 0) {
      // replace last company row with “+X more” if tight
      compRows[compRows.length - 1] = { c: `… +${remaining} more`, prev: "—", net: "—" };
    }

    // append TOTAL row always
    compRows.push({ c: "TOTAL", prev: fmtMoney(totalPrevAll), net: fmtMoney(totalCurrAll) });

    drawTable({
      x: ctX,
      y: ctY,
      w: ctW,
      cols: compCols,
      rows: compRows,
      maxRows: rowsShown.length + 1,
      highlightLastRow: true,
    });

    y += cardH + 12;
  }

  // Department Breakdown (BANK + CASH) — INCLUDED ON FIRST PAGE (one page only)
  {
    const cardH = pageH - M - footerH - y; // fill remaining space
    drawCard(M, y, innerW, cardH);

    sectionTitle(M + 14, y + 24, "Department Breakdown");

    const breakdownPill = safeStr(mainCompany?.companyName, "Company");
    const breakdownPillW = doc.getTextWidth(breakdownPill) + 20;
    drawPill(M + innerW - breakdownPillW - 12, y + 24, breakdownPill);

    const pad = 12;
    const sectionGap = 16;

    const innerX = M + pad;
    let currentY = y + 42;
    const innerW2 = innerW - pad * 2;

    const drawDeptSection = (label: "BANK" | "CASH", sx: number, sy: number, sw: number) => {
      const allDepts = Array.from(mainDeptMap.values());

      // build rows
      const rowsRaw = allDepts
        .map((d) => {
          const data = label === "BANK" ? d.bank : d.cash;
          if (data.prevEmp === 0 && data.currEmp === 0) return null;
          return {
            dept: d.name,
            prevEmp: data.prevEmp,
            prevNet: data.prevNet,
            add: data.add,
            rem: data.remove,
            currEmp: data.currEmp,
            currNet: data.currNet,
          };
        })
        .filter(Boolean) as any[];

      if (rowsRaw.length === 0) return sy;

      // section label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setText(BLUE_900);
      doc.text(label, sx, sy);

      const tableTop = sy + 6;
      const tableW = sw;

      const deptCols: Col[] = [
        { key: "d", label: "Department", w: 0, align: "left" }, // computed below
        { key: "pEmp", label: "Previous Employee", w: 85, align: "right" },
        { key: "pNet", label: "Previous Net", w: 85, align: "right" },
        { key: "add", label: "+", w: 25, align: "right" },
        { key: "rem", label: "-", w: 25, align: "right" },
        { key: "cEmp", label: "Current Employee", w: 85, align: "right" },
        { key: "cNet", label: "Current Net", w: 85, align: "right" },
      ];

      const fixed = deptCols.slice(1).reduce((a, c) => a + c.w, 0);
      deptCols[0].w = tableW - fixed;

      // sort by currNet desc
      rowsRaw.sort((a, b) => Math.abs(b.currNet) - Math.abs(a.currNet));

      const totals = rowsRaw.reduce(
        (acc, r) => {
          acc.pEmp += r.prevEmp;
          acc.pNet += r.prevNet;
          acc.add += r.add;
          acc.rem += r.rem;
          acc.cEmp += r.currEmp;
          acc.cNet += r.currNet;
          return acc;
        },
        { pEmp: 0, pNet: 0, add: 0, rem: 0, cEmp: 0, cNet: 0 },
      );

      const headerH = 20;
      const rowH = 18;

      const rows: Record<string, string>[] = rowsRaw.map((r) => ({
        d: ellipsize(r.dept, deptCols[0].w - 8),
        pEmp: fmtInt(r.prevEmp),
        pNet: fmtMoney(r.prevNet),
        add: dashIfZero(r.add),
        rem: dashIfZero(r.rem),
        cEmp: fmtInt(r.currEmp),
        cNet: fmtMoney(r.currNet),
      }));

      // TOTAL row always
      rows.push({
        d: "TOTAL",
        pEmp: fmtInt(totals.pEmp),
        pNet: fmtMoney(totals.pNet),
        add: dashIfZero(totals.add),
        rem: dashIfZero(totals.rem),
        cEmp: fmtInt(totals.cEmp),
        cNet: fmtMoney(totals.cNet),
      });

      const nextY = drawTable({
        x: sx + pad,
        y: sy + 10,
        w: sw - pad * 2,
        cols: deptCols,
        rows: rows,
        maxRows: 100,
        highlightLastRow: true,
      });

      return nextY + 20; // added small margin before next section label
    };

    currentY = drawDeptSection("BANK", innerX, currentY, innerW2);
    currentY = drawDeptSection("CASH", innerX, currentY, innerW2);
  }

  // Footer (Page 1 of 1)
  {
    const fy = pageH - M + 2;
    setDraw(GRAY_200);
    doc.setLineWidth(1);
    doc.line(M, fy - 10, pageW - M, fy - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(SLATE_600);
    doc.text("Men2 Market Corps • Payroll Summary", M, fy);
    doc.text("Page 1 of 1", pageW - M, fy, { align: "right" });
  }

  // const fileName = `Payroll_Summary_${args?.meta?.currentCutoff?.start || "All"}.pdf`;
  // doc.save(fileName);
  return doc;
}
