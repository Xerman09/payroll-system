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

import { CardHeader, CardTitle } from "@/components/ui/card";
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

/** Handles 1/0, true/false, "1"/"0", and Directus buffer-ish { data: [1] } */
function isTruthyFlag(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  if (typeof v === "object") {
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
function formatAmountOnly(v: any) {
  const n = Math.abs(toNumberSafe(v));
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

/** UI Peso format: single symbol, ABS */
function peso(v: any) {
  return `₱ ${formatAmountOnly(v)}`;
}

export default function TapSheetTab({
  employees,
  departments,
  cutoffs,
}: {
  employees: Employee[];
  departments: Department[];
  cutoffs: CutoffHistoryRow[];
}) {
  const uniqueCutoffs = React.useMemo(() => uniqCutoffs(cutoffs), [cutoffs]);

  const [selectedCutoff, setSelectedCutoff] = React.useState<string>("");
  const [deptId, setDeptId] = React.useState<number | null>(null);

  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<TapSortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [rowsRaw, setRowsRaw] = React.useState<any[]>([]);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = React.useState<string>("");

  React.useEffect(() => {
    if (!selectedCutoff && uniqueCutoffs.length) {
      setSelectedCutoff(
        `${uniqueCutoffs[0].start_date}|${uniqueCutoffs[0].end_date}`,
      );
    }
  }, [selectedCutoff, uniqueCutoffs]);

  const departmentName = React.useMemo(() => {
    if (!deptId) return "";
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
      if (!cutoff?.start || !cutoff?.end || !departmentName) return;

      try {
        setLoading(true);
        const data = await fetchTapSheet({
          cutoffStart: cutoff.start,
          cutoffEnd: cutoff.end,
          departmentName,
        });

        // ✅ safety-net filter (backend should already filter, but keep this)
        const filtered = (Array.isArray(data) ? data : []).filter(
          (r: any) => !isTruthyFlag(r?.on_hold),
        );
        setRowsRaw(filtered);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load tap sheet data.");
        setRowsRaw([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [cutoff?.start, cutoff?.end, departmentName]);

  const tapRows: TapSheetRow[] = React.useMemo(() => {
    if (!cutoff?.start || !cutoff?.end || !departmentName) return [];

    // ✅ safety-net again
    const safeRaw = (rowsRaw as any[]).filter(
      (r) => !isTruthyFlag((r as any)?.on_hold),
    );

    const deduped = dedupeByUserKeepLatestRun(safeRaw as any);

    const masters = employees.map((e) => ({
      user_id: e.user_id,
      user_fname: e.user_fname,
      user_mname: e.user_mname,
      user_lname: e.user_lname,
    }));

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

  const buildSafeFilename = () => {
    const safeDept = (departmentName || "dept").replace(/[^\w\-]+/g, "_");
    const start = cutoff?.start ?? "start";
    const end = cutoff?.end ?? "end";
    return `tap-sheet_${safeDept}_${start}_${end}.pdf`;
  };

  const previewPdf = async () => {
    if (!cutoff?.start || !cutoff?.end)
      return toast.error("Please select a cutoff date.");
    if (!departmentName) return toast.error("Please select a department.");
    if (!tapRows.length) return toast.error("No tap sheet rows to preview.");

    try {
      setExporting(true);

      const doc = await buildTapSheetPdf({
        departmentName,
        cutoffStart: cutoff.start,
        cutoffEnd: cutoff.end,
        rows: tapRows, // ✅ already filtered
        totals,
      });

      if (previewUrl) URL.revokeObjectURL(previewUrl);

      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);

      setPreviewFilename(buildSafeFilename());
      setPreviewUrl(url);
      setPreviewOpen(true);

      toast.success("Tap Sheet ready for preview.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to generate PDF preview.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Tap Sheet</CardTitle>

          <Button
            onClick={previewPdf}
            disabled={loading || exporting || tapRows.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Preview & Download PDF
              </>
            )}
          </Button>
        </div>

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
              value={deptId ? String(deptId) : ""}
              onValueChange={(v) => setDeptId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
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
                Loading tap sheet...
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
              <TableHead className="text-right">Gross Pay</TableHead>
              <TableHead className="text-right">Total Additions</TableHead>
              <TableHead className="text-right">Total Deductions</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {!departmentName || !cutoff ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  Select a cutoff date and department to generate the Tap Sheet.
                </TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : tapRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-base">
                Tap Sheet PDF Preview
              </DialogTitle>

              <div className="flex items-center gap-2">
                {previewUrl && (
                  <>
                    {/* Optional: open in new tab */}
                    <Button variant="outline" size="sm" asChild>
                      <a href={previewUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </Button>

                    {/* Optional: download from preview */}
                    <Button variant="outline" size="sm" asChild>
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

          <div className="h-[80vh] bg-muted/20">
            {previewUrl ? (
              <iframe
                title="Tap Sheet PDF Preview"
                src={previewUrl}
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
