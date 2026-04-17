import jsPDF from "jspdf";

type CompanySummary = {
  name: string;
  prevNet: number;
  currNet: number;
};

type DeptSummary = {
  name: string;
  bank: { prevEmp: number; currEmp: number; prevNet: number; currNet: number; add: number; rem: number };
  cash: { prevEmp: number; currEmp: number; prevNet: number; currNet: number; add: number; rem: number };
};

type RGB = { r: number; g: number; b: number };

type ReportEmployee = {
  user_id: number;
  net_pay: number;
  is_card: number | boolean;
  department_name?: string;
  department_name_snapshot?: string;
  [key: string]: unknown;
};

type ReportCompany = {
  companyName: string;
  isMain?: boolean;
  currEmps: ReportEmployee[];
  prevEmps: ReportEmployee[];
  [key: string]: unknown;
};

type ReportMeta = {
  companyName: string;
  start?: string;
  end?: string;
  currentCutoff?: { start: string; end: string };
  createdAt?: string;
  [key: string]: unknown;
};

export async function buildPayrollSummaryPdf(args: { data: ReportCompany[]; meta: ReportMeta }) {
  // ✅ Landscape + Legal (one page only)
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "legal" });
  const pageW = doc.internal.pageSize.getWidth();  // ~1008
  const pageH = doc.internal.pageSize.getHeight(); // ~612

  // Layout
  const M = 28;
  const innerW = pageW - M * 2;
  const footerH = 20;

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

  const safeStr = (v: unknown, fb = "") => {
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
    doc.roundedRect(x, y, w, h, 8, 8, "FD");
  };

  const drawPill = (x: number, y: number, text: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    const padX = 8;
    const tw = doc.getTextWidth(text);
    const w = tw + padX * 2;
    const h = 16;

    setFill(BLUE_50);
    setDraw(GRAY_200);
    doc.roundedRect(x, y - 12, w, h, 8, 8, "FD");

    setText(BLUE_900);
    doc.text(text, x + padX, y);
    return w;
  };

  const sectionTitle = (x: number, y: number, t: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
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
    rows: Record<string, string | number | boolean | null | undefined>[];
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
    const headerH = opts.headerH ?? 16;
    const rowH = opts.rowH ?? 14;
    const fontSize = opts.fontSize ?? 6.8;
    const headerFontSize = opts.headerFontSize ?? 7.2;

    // Scale columns
    const sumW = opts.cols.reduce((total, c) => total + c.w, 0);
    if (sumW !== w) {
      const ratio = w / sumW;
      let running = 0;
      for (let i = 0; i < opts.cols.length; i++) {
        const nw = i === opts.cols.length - 1 ? w - running : Math.max(18, Math.floor(opts.cols[i].w * ratio));
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
        c.align === "right" ? cx + c.w - 4 : c.align === "center" ? cx + c.w / 2 : cx + 4;
      doc.text(c.label, tx, y + 11, {
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
        const rawValue = rows[i]?.[c.key];
        const raw = rawValue != null ? String(rawValue) : "—";

        const tx =
          c.align === "right" ? cx + c.w - 4 : c.align === "center" ? cx + c.w / 2 : cx + 4;

        setText(SLATE_900);
        doc.text(raw, tx, y + 10, {
          align: c.align === "right" ? "right" : c.align === "center" ? "center" : "left",
        });

        cx += c.w;
      }

      // row line (even subtler)
      setDraw(GRAY_200);
      doc.setLineWidth(0.5);
      doc.line(x + 4, y + rowH, x + w - 4, y + rowH);

      y += rowH;
    }

    return y;
  };

  // ─────────────────────────────────────────────
  // 1) PROCESS DATA (Aggregate across ALL companies)
  // ─────────────────────────────────────────────
  const companySums: CompanySummary[] = [];

  let bankAdd = 0, bankRemove = 0, bankPrevNet = 0, bankCurrNet = 0, bankCurrEmp = 0, bankPrevEmp = 0;
  let cashAdd = 0, cashRemove = 0, cashPrevNet = 0, cashCurrNet = 0, cashCurrEmp = 0, cashPrevEmp = 0;

  for (const c of args.data || []) {
    const cCurrEmps = c?.currEmps || [];
    const cPrevEmps = c?.prevEmps || [];

    const calculatedCurrNet = cCurrEmps.reduce((sum: number, e: ReportEmployee) => sum + Number(e.net_pay || 0), 0);
    const calculatedPrevNet = cPrevEmps.reduce((sum: number, e: ReportEmployee) => sum + Number(e.net_pay || 0), 0);

    companySums.push({
      name: safeStr(c?.companyName, "—"),
      prevNet: calculatedPrevNet,
      currNet: calculatedCurrNet,
    });
  }

  // ─────────────────────────────────────────────
  // 1.1) PROCESS DATA FOR SUMMARIES (Main Entity Detection)
  // ─────────────────────────────────────────────
  const mainDeptMap = new Map<string, DeptSummary>();
  const mainCompany = (args.data || []).find(c => c.isMain) || (args.data || [])[0];

  if (mainCompany) {
    const mCurrEmps = mainCompany.currEmps || [];
    const mPrevEmps = mainCompany.prevEmps || [];
    const mCurrIds = new Set(mCurrEmps.map((e: ReportEmployee) => e.user_id));
    const mPrevIds = new Set(mPrevEmps.map((e: ReportEmployee) => e.user_id));

    // Aggregate BANK/CASH totals from Main Company
    mCurrEmps.forEach((e: ReportEmployee) => {
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

    mPrevEmps.forEach((e: ReportEmployee) => {
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
      ...mCurrEmps.map((e: ReportEmployee) => e.department_name_snapshot || e.department_name || "Unknown"),
      ...mPrevEmps.map((e: ReportEmployee) => e.department_name_snapshot || e.department_name || "Unknown"),
    ]));

    depts.forEach(dName => {
      const d: DeptSummary = {
        name: dName,
        bank: { prevEmp: 0, currEmp: 0, prevNet: 0, currNet: 0, add: 0, rem: 0 },
        cash: { prevEmp: 0, currEmp: 0, prevNet: 0, currNet: 0, add: 0, rem: 0 },
      };

      const cIn = mCurrEmps.filter((e: ReportEmployee) => (e.department_name_snapshot || e.department_name || "Unknown") === dName);
      const pIn = mPrevEmps.filter((e: ReportEmployee) => (e.department_name_snapshot || e.department_name || "Unknown") === dName);

      cIn.forEach((e: ReportEmployee) => {
        const isCard = Number(e.is_card) === 1;
        const target = isCard ? d.bank : d.cash;
        target.currEmp++;
        target.currNet += Number(e.net_pay);
        if (!mPrevIds.has(e.user_id)) target.add++;
      });
      pIn.forEach((e: ReportEmployee) => {
        const isCard = Number(e.is_card) === 1;
        const target = isCard ? d.bank : d.cash;
        target.prevEmp++;
        target.prevNet += Number(e.net_pay);
        if (!mCurrIds.has(e.user_id)) target.rem++;
      });
      mainDeptMap.set(dName, d);
    });
  }


  const reportCompany =
    safeStr(args?.meta?.companyName) ||
    safeStr(mainCompany?.companyName) ||
    "All Companies";

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
  const HEADER_H = 55;

  // Header bar
  setFill(BLUE_800);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setText(WHITE);
  doc.text("Payroll Summary Report", M, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(WHITE);
  doc.text(`${reportCompany} • Cutoff: ${cutoffLabel}`, M, 42);
  doc.text(`Created: ${createdAt}`, pageW - M, 42, { align: "right" });

  setDraw(GRAY_300);
  doc.setLineWidth(1);
  doc.line(M, HEADER_H, pageW - M, HEADER_H);

  let y = HEADER_H + 10;

  // Ribbon
  const ribbonH = 20;
  setFill(BLUE_900);
  doc.roundedRect(M, y, innerW, ribbonH, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(WHITE);
  doc.text(`Report Totals for: ${cutoffLabel}`, M + 10, y + 13);
  y += ribbonH + 8;

  // KPI row (wider in landscape)
  {
    const gap = 10;
    const cardW = (innerW - gap * 2) / 3;
    const cardH = 50;

    const drawKpi = (x: number, title: string, value: string, sub?: string) => {
      drawCard(x, y, cardW, cardH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(SLATE_600);
      doc.text(title, x + 10, y + 15);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      setText(SLATE_900);
      doc.text(value, x + 10, y + 32);

      if (sub) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        setText(SLATE_600);
        doc.text(sub, x + 10, y + 44);
      }
    };

    drawKpi(M, "Total Employees", `${fmtInt(bankCurrEmp + cashCurrEmp)} / ${fmtInt(bankPrevEmp + cashPrevEmp)}`, `Add: ${fmtInt(bankAdd + cashAdd)}  •  Remove: ${fmtInt(bankRemove + cashRemove)}`);
    drawKpi(M + cardW + gap, "Previous Cutoff • Total Net", `PHP ${fmtMoney(bankPrevNet + cashPrevNet)}`);
    drawKpi(M + (cardW + gap) * 2, "Current Cutoff • Total Net", `PHP ${fmtMoney(bankCurrNet + cashCurrNet)}`);

    y += cardH + 10;
  }

  // Two-column row: Payment + Company totals
  {
    const gap = 10;
    const colWLeft = Math.floor(innerW * 0.40);
    const colWRight = innerW - gap - colWLeft;
    const leftX = M;
    const rightX = M + colWLeft + gap;

    const cardH = 105;

    // LEFT: Payment Method Summary
    drawCard(leftX, y, colWLeft, cardH);
    sectionTitle(leftX + 10, y + 16, "Payment Method Summary");

    const tablePad = 8;
    const tX = leftX + tablePad;
    const tW = colWLeft - tablePad * 2;
    const tY = y + 24;

    const payCols: Col[] = [
      { key: "m", label: "Method", w: 45, align: "left" },
      { key: "pEmp", label: "Prev", w: 35, align: "right" },
      { key: "cEmp", label: "Curr", w: 35, align: "right" },
      { key: "add", label: "+", w: 15, align: "right" },
      { key: "rem", label: "-", w: 15, align: "right" },
      { key: "prev", label: "Previous Net", w: (tW - 145) / 2, align: "right" },
      { key: "net", label: "Current Net", w: (tW - 145) / 2, align: "right" },
    ];

    const payRows = [
      { m: "BANK", pEmp: fmtInt(bankPrevEmp), cEmp: fmtInt(bankCurrEmp), add: dashIfZero(bankAdd), rem: dashIfZero(bankRemove), prev: fmtMoney(bankPrevNet), net: fmtMoney(bankCurrNet) },
      { m: "CASH", pEmp: fmtInt(cashPrevEmp), cEmp: fmtInt(cashCurrEmp), add: dashIfZero(cashAdd), rem: dashIfZero(cashRemove), prev: fmtMoney(cashPrevNet), net: fmtMoney(cashCurrNet) },
      { m: "TOTAL", pEmp: fmtInt(bankPrevEmp + cashPrevEmp), cEmp: fmtInt(bankCurrEmp + cashCurrEmp), add: dashIfZero(bankAdd + cashAdd), rem: dashIfZero(bankRemove + cashRemove), prev: fmtMoney(bankPrevNet + cashPrevNet), net: fmtMoney(bankCurrNet + cashCurrNet) },
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

    // RIGHT: Company Totals
    drawCard(rightX, y, colWRight, cardH);
    sectionTitle(rightX + 10, y + 16, "Company Totals");

    const ctX = rightX + tablePad;
    const ctW = colWRight - tablePad * 2;
    const ctY = y + 24;

    const compSorted = [...companySums].sort((a, b) => Math.abs(b.currNet) - Math.abs(a.currNet));
    const totalCurrAll = compSorted.reduce((a, c) => a + (c.currNet || 0), 0);

    // Split into up to 3 columns if more than 3 companies
    const useMultiCols = compSorted.length > 3;

    if (useMultiCols) {
      const colGap = 8;
      const maxCols = 3;
      // We need space for companies + 1 Total row
      const totalItems = compSorted.length + 1;
      const rowsPerCol = Math.ceil(totalItems / maxCols);
      const subTW = (ctW - colGap * (maxCols - 1)) / maxCols;

      const subCols: Col[] = [
        { key: "c", label: "Company", w: Math.floor(subTW * 0.55), align: "left" },
        { key: "net", label: "Curr. Net", w: subTW - Math.floor(subTW * 0.55), align: "right" },
      ];

      for (let i = 0; i < maxCols; i++) {
        const start = i * rowsPerCol;
        const end = start + rowsPerCol;
        const chunk = compSorted.slice(start, end);
        if (chunk.length === 0 && i > 0) continue; // Skip empty columns unless it's the first

        const sx = ctX + i * (subTW + colGap);
        const rows = chunk.map(c => ({
          c: ellipsize(c.name, subCols[0].w - 4),
          net: fmtMoney(c.currNet)
        }));

        // If this is the last item of the last column that contains data, or the very last column
        const isLastColumnPotential = (i === maxCols - 1) || (end >= compSorted.length);
        
        // Add TOTAL to the last possible spot
        if (isLastColumnPotential && end >= compSorted.length) {
          // If the column is full, the total might need to go to the next one, 
          // but rowsPerCol already accounts for the +1 item.
          rows.push({
            c: "TOTAL",
            net: fmtMoney(totalCurrAll)
          });
        }

        drawTable({
          x: sx,
          y: ctY,
          w: subTW,
          cols: subCols,
          rows: rows as Record<string, string | number | boolean | null | undefined>[],
          maxRows: rowsPerCol,
          highlightLastRow: end >= compSorted.length,
        });

        if (end >= compSorted.length) break; // Done drawing
      }

    } else {
      const compCols: Col[] = [
        { key: "c", label: "Company", w: Math.floor(ctW * 0.50), align: "left" },
        { key: "prev", label: "Prev. Net", w: Math.floor(ctW * 0.25), align: "right" },
        { key: "net", label: "Curr. Net", w: ctW - Math.floor(ctW * 0.50) - Math.floor(ctW * 0.25), align: "right" },
      ];

      const compRows = compSorted.map((c) => ({
        c: ellipsize(c.name, compCols[0].w - 6),
        prev: fmtMoney(c.prevNet),
        net: fmtMoney(c.currNet),
      }));

      const totalPrevAll = compSorted.reduce((a, c) => a + (c.prevNet || 0), 0);
      compRows.push({ c: "TOTAL", prev: fmtMoney(totalPrevAll), net: fmtMoney(totalCurrAll) });

      drawTable({
        x: ctX,
        y: ctY,
        w: ctW,
        cols: compCols,
        rows: compRows as Record<string, string | number | boolean | null | undefined>[],
        maxRows: 5,
        highlightLastRow: true,
      });
    }

    y += cardH + 10;
  }

  // 3-COLUMN DEPARTMENT BREAKDOWN
  {
    const cardH = pageH - M - footerH - y + 5;
    drawCard(M, y, innerW, cardH);

    sectionTitle(M + 12, y + 16, "Department Breakdown");

    const breakdownPill = safeStr(mainCompany?.companyName, "Company");
    const breakdownPillW = doc.getTextWidth(breakdownPill) + 16;
    drawPill(M + innerW - breakdownPillW - 10, y + 16, breakdownPill);

    const pad = 10;
    const gap = 10;
    const tW = (innerW - pad * 2 - gap * 2) / 3;
    const commonY = y + 36;

    const allDepts = Array.from(mainDeptMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const drawSection = (label: string, x: number, dataKey: "bank" | "cash" | "total") => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setText(BLUE_900);
      doc.text(label, x, commonY - 5);

      const rows: Record<string, string | number>[] = allDepts.map(d => {
        let data;
        if (dataKey === "total") {
          data = {
            prevEmp: d.bank.prevEmp + d.cash.prevEmp,
            currEmp: d.bank.currEmp + d.cash.currEmp,
            prevNet: d.bank.prevNet + d.cash.prevNet,
            currNet: d.bank.currNet + d.cash.currNet,
            add: d.bank.add + d.cash.add,
            rem: d.bank.rem + d.cash.rem,
          };
        } else if (dataKey === "bank") {
          data = d.bank;
        } else {
          data = d.cash;
        }

        return {
          d: ellipsize(d.name, 60),
          pEmp: fmtInt(data.prevEmp),
          pNet: fmtMoney(data.prevNet),
          add: dashIfZero(data.add),
          rem: dashIfZero(data.rem),
          cEmp: fmtInt(data.currEmp),
          cNet: fmtMoney(data.currNet),
        };
      });

      // Calculate totals for section
      const secTotals = allDepts.reduce((acc, d) => {
        let val;
        if (dataKey === "total") {
          val = {
            pEmp: d.bank.prevEmp + d.cash.prevEmp,
            cEmp: d.bank.currEmp + d.cash.currEmp,
            pNet: d.bank.prevNet + d.cash.prevNet,
            cNet: d.bank.currNet + d.cash.currNet,
            a: d.bank.add + d.cash.add,
            r: d.bank.rem + d.cash.rem
          };
        } else if (dataKey === "bank") {
          const v = d.bank;
          val = { pEmp: v.prevEmp, cEmp: v.currEmp, pNet: v.prevNet, cNet: v.currNet, a: v.add, r: v.rem };
        } else {
          const v = d.cash;
          val = { pEmp: v.prevEmp, cEmp: v.currEmp, pNet: v.prevNet, cNet: v.currNet, a: v.add, r: v.rem };
        }
        acc.pEmp += val.pEmp; acc.cEmp += val.cEmp; acc.pNet += val.pNet; acc.cNet += val.cNet; acc.a += val.a; acc.r += val.r;
        return acc;
      }, { pEmp: 0, cEmp: 0, pNet: 0, cNet: 0, a: 0, r: 0 });

      rows.push({
        d: "TOTAL",
        pEmp: fmtInt(secTotals.pEmp),
        pNet: fmtMoney(secTotals.pNet),
        add: dashIfZero(secTotals.a),
        rem: dashIfZero(secTotals.r),
        cEmp: fmtInt(secTotals.cEmp),
        cNet: fmtMoney(secTotals.cNet)
      });

      const cols: Col[] = [
        { key: "d", label: dataKey === "bank" ? "Dept" : "—", w: 60, align: "left" },
        { key: "pNet", label: "Prev Net", w: 60, align: "right" },
        { key: "add", label: "+", w: 15, align: "right" },
        { key: "rem", label: "-", w: 15, align: "right" },
        { key: "cNet", label: "Curr Net", w: 60, align: "right" },
      ];

      drawTable({
        x,
        y: commonY,
        w: tW,
        cols,
        rows,
        maxRows: 22,
        highlightLastRow: true,
      });
    };

    drawSection("BANK", M + pad, "bank");
    drawSection("CASH", M + pad + tW + gap, "cash");
    drawSection("TOTAL", M + pad + (tW + gap) * 2, "total");
  }

  // Footer (Page 1 of 1)
  {
    const fy = pageH - M + 8;
    setDraw(GRAY_200);
    doc.setLineWidth(1);
    doc.line(M, fy - 8, pageW - M, fy - 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(SLATE_600);
    doc.text(`${reportCompany} • Payroll Summary`, M, fy);
    doc.text("Page 1 of 1", pageW - M, fy, { align: "right" });
  }

  return doc;
}
