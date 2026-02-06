// modules/benefit-settings/components/BenefitExportPreviewDialog.tsx
"use client";

import * as React from "react";
import { FileDown, Search, Filter } from "lucide-react";
import { formatMoney } from "../providers/benefitApi";
import type { BenefitLogRow, BenefitCode, UserData, CutoffSetting } from "../types";
import { exportBenefitLogsPdf, type BenefitLogsPaperSize } from "./benefitLogsPdf";
import { cutoffLabel } from "../providers/benefitApi";

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
  cutoffs: CutoffSetting[];
  initialCutoffId: string;
  initialBenefit: BenefitCode | "ALL";
  initialType: "ALL" | "CONTRIBUTION" | "LOAN";
  initialPaper: BenefitLogsPaperSize;
}

export default function BenefitExportPreviewDialog({
  open,
  onOpenChange,
  allRows,
  users,
  cutoffs,
  initialCutoffId,
  initialBenefit,
  initialType,
  initialPaper,
}: BenefitExportPreviewDialogProps) {
  const [cutoffId, setCutoffId] = React.useState<string>(initialCutoffId);
  const [benefit, setBenefit] = React.useState<BenefitCode | "ALL">(initialBenefit);
  const [type, setType] = React.useState<"ALL" | "CONTRIBUTION" | "LOAN">(initialType);
  const [paper, setPaper] = React.useState<BenefitLogsPaperSize>(initialPaper);
  const [exporting, setExporting] = React.useState(false);

  const filtered = React.useMemo(() => {
    return allRows.filter((r) => {
      if (cutoffId !== "ALL" && String(r.cutoff_id) !== cutoffId) return false;
      if (benefit !== "ALL" && r.benefit_code !== benefit) return false;
      if (type !== "ALL" && r.log_type !== type) return false;
      return true;
    });
  }, [allRows, cutoffId, benefit, type]);

  const totals = React.useMemo(() => {
    return filtered.reduce((acc, r) => acc + (r.deducted_amount || 0), 0);
  }, [filtered]);

  const onDownload = async () => {
    setExporting(true);
    try {
      await exportBenefitLogsPdf({
        paper,
        companyName: "Vertex Technology Corps.",
        title: benefit === "ALL" ? "Benefit Logs Summary" : `${benefit} Benefit Logs`,
        users,
        cutoffs,
        cutoffId,
        benefit,
        type,
        search: "", 
        rows: filtered,
      });
      onOpenChange(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[95vw] !max-w-7xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-blue-600" />
            PDF Export Preview
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden p-6 gap-6">
          {/* Selections / Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cutoff
              </label>
              <Select value={cutoffId} onValueChange={setCutoffId}>
                <SelectTrigger className="bg-slate-50 h-auto min-h-[36px] py-1 flex-wrap whitespace-normal text-left">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="max-w-[400px]">
                  <SelectItem value="ALL">All Cutoffs</SelectItem>
                  {cutoffs.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {cutoffLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Benefit
              </label>
              <Select value={benefit} onValueChange={(v) => setBenefit(v as any)}>
                <SelectTrigger className="bg-slate-50 h-auto min-h-[36px]">
                  <SelectValue placeholder="All Benefits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Benefits</SelectItem>
                  <SelectItem value="SSS">SSS</SelectItem>
                  <SelectItem value="PHILHEALTH">PhilHealth</SelectItem>
                  <SelectItem value="PAGIBIG">Pag-IBIG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Type
              </label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger className="bg-slate-50 h-auto min-h-[36px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="CONTRIBUTION">Contributions</SelectItem>
                  <SelectItem value="LOAN">Loans</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Paper Size
              </label>
              <Select value={paper} onValueChange={(v) => setPaper(v as BenefitLogsPaperSize)}>
                <SelectTrigger className="bg-slate-50 h-auto min-h-[36px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LETTER">Letter</SelectItem>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="LEGAL">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Preview Table */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white border rounded-xl shadow-inner">
            <div className="bg-slate-50/80 px-4 py-2 flex justify-between items-center border-b">
              <span className="text-sm font-medium text-slate-600">
                {filtered.length} entries matching selection
              </span>
              <span className="text-sm font-bold text-slate-900 border-l pl-4">
                Total: {formatMoney(totals)}
              </span>
            </div>
            
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
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
                    filtered.map((r) => (
                      <TableRow key={r.benefit_log_id} className="text-xs">
                        <TableCell className="font-medium">{r.employee_name}</TableCell>
                        <TableCell className="font-mono text-slate-500">{r.account_no || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{formatMoney(r.deducted_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={r.log_type === "LOAN" ? "secondary" : "outline"} className="text-[10px] scale-90 origin-left">
                            {r.log_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{r.benefit_code}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]" 
            disabled={exporting || filtered.length === 0}
            onClick={onDownload}
          >
            {exporting ? (
              "Processing..."
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
