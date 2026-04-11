// modules/payroll-records/components/TapSheetTab.tsx
// modules/payroll-records/components/TapSheetTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileDown, Loader2, ArrowUpDown, Eye } from "lucide-react";

import type {
  CutoffHistoryRow,
  Department,
  Employee,
  TapSortKey,
  TapSheetRow,
} from "../types";
import { fetchTapSheet } from "../providers/payrollRecordsApi";
import {
  uniqCutoffs,
  parseCutoffValue,
  buildCutoffLabel,
} from "../utils/cutoff";
import {
  buildTapSheetRows,
  dedupeByUserKeepLatestRun,
} from "../utils/tapSheet";
import { toNumberSafe } from "../utils/money";
import { buildTapSheetPdf } from "../utils/tapSheetPdf";
import { buildPayslipsPdf } from "../../payroll-run/utils/payslipPdf";
import { CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PayrollRecordsSkeleton } from "./PayrollRecordsSkeleton";

/** Handles 1/0, true/false, "1"/"0", and Directus buffer-ish { data: [1] } */
function isTruthyFlag(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  if (typeof v === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyV = v as any;
    const d0 = anyV?.data?.[0];
    if (d0 === 1 || d0 === "1" || d0 === true) return true;
    if (d0 === 0 || d0 === "0" || d0 === false || d0 == null) return false;
  }

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string")
    return v.trim() === "1" || v.trim().toLowerCase() === "true";

  return false;
}

/** Format number ONLY (no currency symbol) */
function formatAmountOnly(v: unknown) {
  const n = Math.abs(toNumberSafe(v as number | string));
  try {
    return n.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

/** 
 * Show whole numbers without decimals (12), 
 * but fractionals with up to 2 (12.5) 
 */
function formatSmartDecimal(v: unknown) {
  const n = Math.abs(toNumberSafe(v as number | string));
  if (Number.isInteger(n)) return n.toString();
  try {
    return n.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } catch {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
}

/** UI Peso format: single symbol, ABS */
function peso(v: unknown) {
  return `₱ ${formatAmountOnly(v)}`;
}

export default function TapSheetTab({
  loading: isInitialLoading,
  employees,
  departments,
  cutoffs,
  selectedCutoff,
  setSelectedCutoff,
  deptId,
  setDeptId,
  companyName: passedCompanyName,
}: {
  loading: boolean;
  employees: Employee[];
  departments: Department[];
  cutoffs: CutoffHistoryRow[];
  selectedCutoff: string;
  setSelectedCutoff: (v: string) => void;
  deptId: number | null;
  setDeptId: (v: number | null) => void;
  companyName: string;
}) {
  const uniqueCutoffs = React.useMemo(() => uniqCutoffs(cutoffs), [cutoffs]);

  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<TapSortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [rowsRaw, setRowsRaw] = React.useState<Record<string, unknown>[]>([]);
  const [companyName, setCompanyName] = React.useState<string>(passedCompanyName || "");

  React.useEffect(() => {
    if (passedCompanyName) setCompanyName(passedCompanyName);
  }, [passedCompanyName]);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = React.useState<string>("");
  const [pdfFilter, setPdfFilter] = React.useState<"ALL" | "BANK" | "CASH">("ALL");

  React.useEffect(() => {
    if (!selectedCutoff && uniqueCutoffs.length) {
      setSelectedCutoff(
        `${uniqueCutoffs[0].start_date}|${uniqueCutoffs[0].end_date}`,
      );
    }
  }, [selectedCutoff, uniqueCutoffs, setSelectedCutoff]);

  const departmentName = React.useMemo(() => {
    if (!deptId || deptId === -1) return "";
    return (
      departments.find((d) => d.department_id === deptId)?.department_name ?? ""
    );
  }, [deptId, departments]);

  const cutoff = React.useMemo(
    () => parseCutoffValue(selectedCutoff),
    [selectedCutoff],
  );

  React.useEffect(() => {
    const run = async () => {
      if (!cutoff?.start || !cutoff?.end) return;
      if (deptId !== -1 && !departmentName) return;

      try {
        setLoading(true);
        const res = await fetchTapSheet({
          cutoffStart: cutoff.start,
          cutoffEnd: cutoff.end,
          departmentName,
        });

        // ✅ safety-net filter (backend should already filter, but keep this)
        const filtered = res.data.filter(
          (r: Record<string, unknown>) => !isTruthyFlag(r?.on_hold),
        );
        setRowsRaw(filtered);
        if (res.meta?.companyName) {
          setCompanyName(res.meta.companyName);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load Top Sheet data.");
        setRowsRaw([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [cutoff?.start, cutoff?.end, departmentName, deptId]);

  const tapRows: TapSheetRow[] = React.useMemo(() => {
    if (!cutoff?.start || !cutoff?.end) return [];
    if (deptId !== -1 && !departmentName) return [];

    // ✅ safety-net again
    const safeRaw = (rowsRaw as Record<string, unknown>[]).filter(
      (r) => !isTruthyFlag(r?.on_hold),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deduped = dedupeByUserKeepLatestRun(safeRaw as any);

    const masters = employees.map((e) => ({
      user_id: e.user_id,
      user_fname: e.user_fname,
      user_mname: e.user_mname,
      user_lname: e.user_lname,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const built = buildTapSheetRows(deduped as any, masters);

    const q = search.trim().toLowerCase();
    const filtered = q
      ? built.filter((r) => r.name_display.toLowerCase().includes(q))
      : built;

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name_sort_key.localeCompare(b.name_sort_key);
          break;
        case "gross":
          cmp = a.gross_pay - b.gross_pay;
          break;
        case "adds":
          cmp = a.total_additions - b.total_additions;
          break;
        case "deds":
          cmp = a.total_deductions - b.total_deductions;
          break;
        case "net":
          cmp = a.net_pay - b.net_pay;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [
    rowsRaw,
    employees,
    cutoff?.start,
    cutoff?.end,
    departmentName,
    search,
    sortKey,
    sortDir,
    deptId,
  ]);

  const totals = React.useMemo(() => {
    return tapRows.reduce(
      (acc, r) => {
        acc.gross += Math.abs(toNumberSafe(r.gross_pay));
        acc.adds += Math.abs(toNumberSafe(r.total_additions));
        acc.deds += Math.abs(toNumberSafe(r.total_deductions));
        acc.net += Math.abs(toNumberSafe(r.net_pay));
        return acc;
      },
      { gross: 0, adds: 0, deds: 0, net: 0 },
    );
  }, [tapRows]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const buildSafeFilename = (filter: string) => {
    const safeDept = (deptId === -1 ? "all_depts" : departmentName || "dept").replace(/[^\w\-]+/g, "_");
    const start = cutoff?.start ?? "start";
    const end = cutoff?.end ?? "end";
    return `top-sheet_${filter}_${safeDept}_${start}_${end}.pdf`;
  };

  const generatePdfBlob = async (filter: "ALL" | "BANK" | "CASH") => {
    if (!cutoff?.start || !cutoff?.end) return null;
    if (deptId !== -1 && !departmentName) return null;

    let filteredRows = tapRows;
    if (filter === "BANK") {
      filteredRows = tapRows.filter(r => r.payment_type === "BANK");
    } else if (filter === "CASH") {
      filteredRows = tapRows.filter(r => r.payment_type === "CASH");
    }

    // Recalculate totals for PDF
    const pdfTotals = filteredRows.reduce(
      (acc, r) => {
        acc.gross += Math.abs(toNumberSafe(r.gross_pay));
        acc.adds += Math.abs(toNumberSafe(r.total_additions));
        acc.deds += Math.abs(toNumberSafe(r.total_deductions));
        acc.net += Math.abs(toNumberSafe(r.net_pay));
        return acc;
      },
      { gross: 0, adds: 0, deds: 0, net: 0 }
    );

    const doc = await buildTapSheetPdf({
      companyName,
      departmentName,
      cutoffStart: cutoff.start,
      cutoffEnd: cutoff.end,
      rows: filteredRows,
      totals: pdfTotals,
      filterType: filter, // Pass the filter type
      payrollRefNo: filteredRows.find(r => r.payroll_ref_no)?.payroll_ref_no,
      postedAt: filteredRows.find(r => r.posted_at)?.posted_at,
    });
    return doc.output("blob");
  };

  const onDownloadAllPayslips = async () => {
    if (!tapRows.length) return toast.error("No payslips to download.");
    
    setExporting(true);
    try {
      // ✅ Map tapRows back to their raw counterparts because buildPayslipsPdf
      // requires breakdown_json, basic_pay, employee_name, etc. (tapRows strips them)
      const safeRaw = (rowsRaw as Record<string, unknown>[]).filter(
        (r) => !isTruthyFlag(r?.on_hold),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dedupedRaw = dedupeByUserKeepLatestRun(safeRaw as any);

      const payslipRowsToPrint = tapRows.map((tr) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = dedupedRaw.find((r: any) => r.user_id === tr.user_id);
        const emp = employees.find((e) => e.user_id === tr.user_id);

        if (raw) {
          return {
            ...raw,
            employee_name: tr.name_display, // inject compiled name back
            department_name_snapshot: departmentName || "", // Ensure department is passed
            position_name: emp?.user_position || "", // Ensure job title is passed
          };
        }
        return tr;
      });

      const doc = await buildPayslipsPdf({
        rows: payslipRowsToPrint,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payrollPeriodLabel: buildCutoffLabel(cutoff as any),
        pageSize: "LEGAL",
        companyName: (companyName || "").toUpperCase(),
      });
      
      doc.save(buildSafeFilename("all_payslips"));
      toast.success("Bulk payslips generated.");
    } catch (e: unknown) {
      console.error(e);
      toast.error("Failed to generate bulk payslips.");
    } finally {
      setExporting(false);
    }
  };

  const openPreview = async () => {
    if (!cutoff?.start || !cutoff?.end)
      return toast.error("Please select a cutoff date.");
    if (deptId !== -1 && !departmentName) return toast.error("Please select a department.");
    if (!tapRows.length) return toast.error("No Top Sheet rows to preview.");

    setPdfFilter("ALL");
    setPreviewOpen(true);
  };

  React.useEffect(() => {
    if (!previewOpen) return;
    
    let active = true;
    (async () => {
       setExporting(true);
       try {
         const blob = await generatePdfBlob(pdfFilter);
         if (!active) return;
         if (blob) {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            setPreviewFilename(buildSafeFilename(pdfFilter));
         }
       } catch (e) {
         console.error(e);
         toast.error("Failed to generate PDF.");
       } finally {
         if (active) setExporting(false);
       }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, pdfFilter]);


  return (
    <div className="space-y-6">
      <CardHeader className="px-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Payroll Records</h1>
            <p className="text-sm text-muted-foreground">
              Generate a final Top Sheet per department and cutoff.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onDownloadAllPayslips}
              disabled={loading || exporting || tapRows.length === 0}
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5"
            >
               {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
               Download All Payslips
            </Button>

            <Button
              onClick={openPreview}
              disabled={loading || tapRows.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
            >
               <Eye className="mr-2 h-4 w-4" />
               Preview & Download PDF
            </Button>
          </div>
        </div>

        {/* ... filters ... */}
        {/* Header Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Select Cutoff Date</Label>
            <Select value={selectedCutoff} onValueChange={setSelectedCutoff}>
              <SelectTrigger>
                <SelectValue placeholder="Select cutoff..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueCutoffs.map((c) => (
                  <SelectItem
                    key={`${c.start_date}|${c.end_date}`}
                    value={`${c.start_date}|${c.end_date}`}
                  >
                    {buildCutoffLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select Department</Label>
            <Select
              value={String(deptId ?? "")}
              onValueChange={(v) => setDeptId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-1">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem
                    key={d.department_id}
                    value={String(d.department_id)}
                  >
                    {d.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Search Employee</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Last, First..."
            />
          </div>
        </div>

        {/* Sorting row */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Sort by</Label>
              <Select
                value={sortKey}
                onValueChange={(v: TapSortKey) => setSortKey(v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Employee Name</SelectItem>
                  <SelectItem value="gross">Gross Pay</SelectItem>
                  <SelectItem value="adds">Total Additions</SelectItem>
                  <SelectItem value="deds">Total Deductions</SelectItem>
                  <SelectItem value="net">Net Pay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              {sortDir.toUpperCase()}
            </Button>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Top Sheet...
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            Rows:{" "}
            <span className="font-medium text-foreground">
              {tapRows.length}
            </span>
          </div>
        </div>
      </CardHeader>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[260px]">Employee Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Payment Type</TableHead>
              <TableHead className="text-right">Gross Pay</TableHead>
              <TableHead className="text-right">Total Additions</TableHead>
              <TableHead className="text-right">Total Deductions</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {!cutoff || (deptId !== -1 && !departmentName) ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-muted-foreground"
                >
                  Select a cutoff date and department to generate the Top Sheet.
                </TableCell>
              </TableRow>
            ) : (isInitialLoading || loading) ? (
              <PayrollRecordsSkeleton type="top-sheet" />
            ) : tapRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-muted-foreground"
                >
                  No records found for the selected cutoff and department.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {tapRows.map((r) => (
                  <TableRow key={r.user_id} className="border-b">
                    <TableCell className="font-medium">
                      {r.name_display}
                    </TableCell>
                    <TableCell>{r.employee_no}</TableCell>
                    <TableCell>{formatSmartDecimal(r.days_worked)}</TableCell>
                    <TableCell>{formatSmartDecimal(r.work_hours)}</TableCell>
                    <TableCell>
                      {r.payment_type}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {peso(r.gross_pay)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {peso(r.total_additions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {peso(r.total_deductions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-700">
                      {peso(r.net_pay)}
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow className="bg-muted/40">
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-bold tabular-nums">
                    {peso(totals.gross)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {peso(totals.adds)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {peso(totals.deds)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {peso(totals.net)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ✅ PDF Preview Dialog */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open && previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            setPreviewFilename("");
          }
        }}
      >
        <DialogContent className="w-full max-w-[95vw] sm:max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="pl-6 pr-12 py-4 border-b bg-background">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <DialogTitle className="text-lg">
                   Top Sheet PDF Preview
                 </DialogTitle>
                 
                 <div className="flex items-center gap-2">
                   <Label className="text-sm font-medium">Payment Type:</Label>
                   <Select value={pdfFilter} onValueChange={(v: "ALL" | "BANK" | "CASH") => setPdfFilter(v)}>
                     <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="BANK">Bank Only</SelectItem>
                        <SelectItem value="CASH">Cash Only</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
              </div>

              <div className="flex items-center gap-2">
                {exporting && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                    </div>
                )}
                {previewUrl && !exporting && (
                  <>
                    {/* Optional: open in new tab */}
                    <Button variant="outline" size="sm" asChild>
                      <a href={previewUrl} target="_blank" rel="noreferrer">
                        Open in Tab
                      </a>
                    </Button>

                    {/* Optional: download from preview */}
                    <Button variant="default" size="sm" asChild>
                      <a href={previewUrl} download={previewFilename}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 bg-muted/20 w-full h-full relative">
            {exporting ? (
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                     <Loader2 className="h-10 w-10 animate-spin text-primary" />
                     <p className="text-sm text-muted-foreground">Rendering PDF...</p>
                  </div>
               </div>
            ) : previewUrl ? (
              <iframe
                title="Top Sheet PDF Preview"
                src={`${previewUrl}#toolbar=0&view=FitH`}
                className="w-full h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No preview available.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
