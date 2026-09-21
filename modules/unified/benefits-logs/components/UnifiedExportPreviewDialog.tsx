// modules/unified/benefits-logs/components/UnifiedExportPreviewDialog.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileDown, Download, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { exportUnifiedBenefitLogsPdf, BenefitLogsPaperSize } from "../utils/unifiedBenefitLogsPdf";
import type { UnifiedBenefitLogRow, BenefitCode, BenefitLogType } from "../types";

function formatMoney(v: number) {
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface UnifiedExportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: UnifiedBenefitLogRow[];
  cutoffRange: string;
  companyFilter: string;
  benefit: BenefitCode | "ALL";
  type: BenefitLogType | "ALL";
  search: string;
}

export default function UnifiedExportPreviewDialog({
  open,
  onOpenChange,
  rows,
  cutoffRange,
  companyFilter,
  benefit,
  type,
  search,
}: UnifiedExportPreviewDialogProps) {
  const [paper, setPaper] = React.useState<BenefitLogsPaperSize>("LETTER");
  const [exporting, setExporting] = React.useState(false);

  const totalAmount = React.useMemo(
    () => rows.reduce((sum, r) => sum + (r.deducted_amount || 0), 0),
    [rows]
  );

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportUnifiedBenefitLogsPdf({
        paper,
        title: "Compiled Enterprise Benefits Logs Report",
        cutoffRange,
        companyFilter,
        benefit,
        type,
        search,
        rows,
      });
      onOpenChange(false);
    } catch (e) {
      console.error("PDF export error:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Export Compiled Benefits Report
          </DialogTitle>
          <DialogDescription>
            Generate a standardized landscape PDF report with company breakdowns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Metadata Card */}
          <div className="rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Records to export:</span>
              <span className="font-semibold text-slate-800 dark:text-gray-200">
                {rows.length.toLocaleString()} rows
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Deducted Value:</span>
              <span className="font-semibold text-slate-800 dark:text-gray-200">
                ₱{formatMoney(totalAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Selected Entity:</span>
              <span className="font-semibold text-slate-800 dark:text-gray-200">
                {companyFilter}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Agency Filter:</span>
              <span className="font-semibold text-slate-800 dark:text-gray-200">
                {benefit}
              </span>
            </div>
          </div>

          {/* Paper Size Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
              Document Paper Size
            </label>
            <Select
              value={paper}
              onValueChange={(v) => setPaper(v as BenefitLogsPaperSize)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LETTER">Letter (8.5 × 11 in) - Standard</SelectItem>
                <SelectItem value="A4">A4 (210 × 297 mm) - International</SelectItem>
                <SelectItem value="LEGAL">Legal (8.5 × 14 in) - Extended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExportPdf}
            disabled={exporting || rows.length === 0}
            className="gap-1.5"
          >
            <FileDown className="h-4 w-4" />
            {exporting ? "Generating PDF..." : "Generate PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
