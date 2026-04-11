// modules/benefit-settings/components/BenefitExportPreviewDialog.tsx
"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import { formatMoney } from "../providers/benefitApi";
import type { BenefitLogRow, BenefitCode, UserData, Department } from "../types";
import { exportBenefitLogsPdf, type BenefitLogsPaperSize } from "../utils/benefitLogsPdf";
import { fullnameFromUser } from "../providers/benefitApi";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface BenefitExportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allRows: BenefitLogRow[];
  users: UserData[];
  departments: Department[];
  initialCutoffRange: string;
  initialBenefit: BenefitCode | "ALL";
  initialType: "ALL" | "CONTRIBUTION" | "LOAN";
  initialDepartment: "ALL" | number;
  initialPaper: BenefitLogsPaperSize;
  companyName: string;
}

export default function BenefitExportPreviewDialog({
  open,
  onOpenChange,
  allRows,
  users,
  departments,
  initialCutoffRange,
  initialBenefit,
  initialType,
  initialDepartment,
  initialPaper,
  companyName,
}: BenefitExportPreviewDialogProps) {
  const [cutoffRange, setCutoffRange] = React.useState<string>(initialCutoffRange);
  const [benefit, setBenefit] = React.useState<BenefitCode | "ALL">(initialBenefit);
  const [type, setType] = React.useState<"ALL" | "CONTRIBUTION" | "LOAN">(initialType);
  const [department, setDepartment] = React.useState<"ALL" | number>(initialDepartment);
  const [paper, setPaper] = React.useState<BenefitLogsPaperSize>(initialPaper);
  const [exporting, setExporting] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [pdfBlob, setPdfBlob] = React.useState<Blob | null>(null);

  // userId → department_id lookup
  const userDeptMap = React.useMemo(() => {
    const m = new Map<number, number | null>();
    for (const u of users) m.set(u.user_id, u.user_department ?? null);
    return m;
  }, [users]);

  const filtered = React.useMemo(() => {
    return allRows.filter((r) => {
      if (cutoffRange !== "ALL") {
        if (cutoffRange === "UNKNOWN") {
          if (r.cutoff_start || r.cutoff_end) return false;
        } else {
          const key = `${r.cutoff_start}_${r.cutoff_end}`;
          if (key !== cutoffRange) return false;
        }
      }
      if (benefit !== "ALL" && r.benefit_code !== benefit) return false;
      if (type !== "ALL" && r.log_type !== type) return false;
      if (department !== "ALL") {
        const userDept = userDeptMap.get(r.user_id);
        if (userDept !== department) return false;
      }
      return true;
    });
  }, [allRows, cutoffRange, benefit, type, department, userDeptMap]);

  const totals = React.useMemo(() => {
    return filtered.reduce((acc, r) => acc + (r.deducted_amount || 0), 0);
  }, [filtered]);

  const onPreview = async () => {
    setExporting(true);
    try {
      const deptLabel =
        department === "ALL"
          ? "All Departments"
          : (departments.find((d) => d.department_id === department)?.department_name ?? String(department));

      const doc = await exportBenefitLogsPdf({
        paper,
        companyName,
        title: benefit === "ALL" ? "Benefit Logs Summary" : `${benefit} Benefit Logs`,
        users,
        cutoffRange,
        benefit,
        type,
        department: department === "ALL" ? undefined : deptLabel,
        search: "",
        rows: filtered,
      });
      const blob = doc.output("blob");
      setPdfBlob(blob);
      setPreviewOpen(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[95vw] !max-w-7xl max-h-[95vh] flex flex-col p-0 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        <DialogHeader className="px-6 py-4 border-b dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            PDF Export Preview
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden p-6 gap-6 dark:bg-gray-950/20">
          {/* Selections / Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Department
              </label>
              <Select
                value={String(department)}
                onValueChange={(v) => setDepartment(v === "ALL" ? "ALL" : Number(v))}
              >
                <SelectTrigger className="bg-slate-50 dark:bg-gray-800 h-auto min-h-[36px] dark:border-gray-700 dark:text-gray-100">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-gray-800">
                  <SelectItem value="ALL" className="dark:text-gray-200 dark:focus:bg-gray-800">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.department_id} value={String(d.department_id)} className="dark:text-gray-200 dark:focus:bg-gray-800">
                      {d.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Cutoff
              </label>
              <Select value={cutoffRange} onValueChange={setCutoffRange}>
                <SelectTrigger className="bg-slate-50 dark:bg-gray-800 h-auto min-h-[36px] py-1 flex-wrap whitespace-normal text-left dark:border-gray-700 dark:text-gray-100">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="max-w-[400px] dark:bg-gray-900 dark:border-gray-800">
                  <SelectItem value="ALL" className="dark:text-gray-200 dark:focus:bg-gray-800">All Cutoffs</SelectItem>
                  {(() => {
                    const uniqueRanges = new Map<string, string>();
                    const fmt = (dStr: string) => {
                      const d = new Date(dStr);
                      if (Number.isNaN(d.getTime())) return dStr;
                      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
                    };
                    
                    for (const r of allRows) {
                      if (r.cutoff_start && r.cutoff_end) {
                        const key = `${r.cutoff_start}_${r.cutoff_end}`;
                        if (!uniqueRanges.has(key)) {
                          uniqueRanges.set(key, `${fmt(r.cutoff_start)} – ${fmt(r.cutoff_end)}`);
                        }
                      } else {
                        uniqueRanges.set("UNKNOWN", "Unknown Cutoff");
                      }
                    }

                    // Sort ranges visually
                    const sortedRanges = Array.from(uniqueRanges.entries()).sort((a, b) => b[0].localeCompare(a[0]));

                    return sortedRanges.map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Benefit
              </label>
              <Select value={benefit} onValueChange={(v) => setBenefit(v as BenefitCode | "ALL")}>
                <SelectTrigger className="bg-slate-50 dark:bg-gray-800 h-auto min-h-[36px] dark:border-gray-700 dark:text-gray-100">
                  <SelectValue placeholder="All Benefits" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-gray-800">
                  <SelectItem value="ALL" className="dark:text-gray-200 dark:focus:bg-gray-800">All Benefits</SelectItem>
                  <SelectItem value="SSS">SSS</SelectItem>
                  <SelectItem value="PHILHEALTH">PhilHealth</SelectItem>
                  <SelectItem value="PAGIBIG">Pag-IBIG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </label>
              <Select value={type} onValueChange={(v) => setType(v as "ALL" | "CONTRIBUTION" | "LOAN")}>
                <SelectTrigger className="bg-slate-50 dark:bg-gray-800 h-auto min-h-[36px] dark:border-gray-700 dark:text-gray-100">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-gray-800">
                  <SelectItem value="ALL" className="dark:text-gray-200 dark:focus:bg-gray-800">All Types</SelectItem>
                  <SelectItem value="CONTRIBUTION">Contributions</SelectItem>
                  <SelectItem value="LOAN">Loans</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Paper Size
              </label>
              <Select value={paper} onValueChange={(v) => setPaper(v as BenefitLogsPaperSize)}>
                <SelectTrigger className="bg-slate-50 dark:bg-gray-800 h-auto min-h-[36px] dark:border-gray-700 dark:text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-gray-800">
                  <SelectItem value="LETTER">Letter</SelectItem>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="LEGAL">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Preview Table */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl shadow-inner">
            <div className="bg-slate-50/80 dark:bg-gray-800/80 px-4 py-2 flex justify-between items-center border-b dark:border-gray-800">
              <span className="text-sm font-medium text-slate-600 dark:text-gray-400">
                {filtered.length} entries matching selection
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-gray-100 border-l dark:border-gray-700 pl-4">
                Total: {formatMoney(totals)}
              </span>
            </div>
            
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-white dark:bg-gray-900 shadow-sm z-10">
                  <TableRow>
                    <TableHead className="w-[200px]">Employee</TableHead>
                    <TableHead>Account #</TableHead>
                    <TableHead className="text-right">Deducted</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Benefit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
                        No data available for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => {
                      const uId = typeof r.user_id === "object" ? (r.user_id as { user_id: number })?.user_id : r.user_id;
                      const u = users.find((x) => x.user_id === uId);
                      const name = r.employee_name || (u ? fullnameFromUser(u) : `User #${uId}`);
                      return (
                      <TableRow key={r.benefit_log_id} className="text-xs border-b dark:border-gray-800">
                        <TableCell className="font-medium dark:text-gray-200">{name}</TableCell>
                        <TableCell className="font-mono text-slate-500 dark:text-gray-400">{r.account_no || "—"}</TableCell>
                        <TableCell className="text-right font-semibold dark:text-gray-100">{formatMoney(r.deducted_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={r.log_type === "LOAN" ? "secondary" : "outline"} className="text-[10px] scale-90 origin-left dark:bg-gray-800 dark:text-gray-300">
                            {r.log_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono dark:text-gray-300">{r.benefit_code}</TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[140px]" 
            disabled={exporting || filtered.length === 0}
            onClick={onPreview}
          >
            {exporting ? (
              "Processing..."
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Preview PDF
              </>
            )}
          </Button>
        </DialogFooter>

        <PdfPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={benefit === "ALL" ? "Benefit Logs Summary" : `${benefit} Benefit Logs`}
          pdfBlob={pdfBlob}
          fileName={`benefit-logs-${new Date().toISOString().slice(0, 10)}.pdf`}
        />
      </DialogContent>
    </Dialog>
  );
}
