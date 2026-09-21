// modules/unified/benefits-logs/components/UnifiedSummaryDialog.tsx
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, Layers, Landmark, HeartPulse, Wallet } from "lucide-react";
import type { UnifiedBenefitLogRow, CompanySummary } from "../types";

function formatMoney(v: number) {
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface UnifiedSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: UnifiedBenefitLogRow[];
  companies: CompanySummary[];
}

export default function UnifiedSummaryDialog({
  open,
  onOpenChange,
  rows,
  companies,
}: UnifiedSummaryDialogProps) {
  // Aggregate data by company
  const companyAggregates = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        count: number;
        sss: number;
        philhealth: number;
        pagibig: number;
        loans: number;
        total: number;
      }
    >();

    // Initialize with all companies
    for (const c of companies) {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        color: c.color,
        count: 0,
        sss: 0,
        philhealth: 0,
        pagibig: 0,
        loans: 0,
        total: 0,
      });
    }

    for (const r of rows) {
      let entry = map.get(r.company_id);
      if (!entry) {
        entry = {
          id: r.company_id,
          name: r.company_name,
          color: r.company_color,
          count: 0,
          sss: 0,
          philhealth: 0,
          pagibig: 0,
          loans: 0,
          total: 0,
        };
        map.set(r.company_id, entry);
      }

      const amt = r.deducted_amount || 0;
      entry.count += 1;
      entry.total += amt;

      if (r.benefit_code === "SSS") entry.sss += amt;
      if (r.benefit_code === "PHILHEALTH") entry.philhealth += amt;
      if (r.benefit_code === "PAGIBIG") entry.pagibig += amt;
      if (r.log_type === "LOAN") entry.loans += amt;
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows, companies]);

  // Overall totals
  const overall = React.useMemo(() => {
    let grandTotal = 0;
    let sss = 0;
    let philhealth = 0;
    let pagibig = 0;
    let loans = 0;

    for (const r of rows) {
      const amt = r.deducted_amount || 0;
      grandTotal += amt;
      if (r.benefit_code === "SSS") sss += amt;
      if (r.benefit_code === "PHILHEALTH") philhealth += amt;
      if (r.benefit_code === "PAGIBIG") pagibig += amt;
      if (r.log_type === "LOAN") loans += amt;
    }

    return { grandTotal, sss, philhealth, pagibig, loans };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Building2 className="h-5 w-5 text-primary" />
            Compiled Enterprise Benefits Summary
          </DialogTitle>
          <DialogDescription>
            High-level statistical breakdown of statutory deductions and loans across all enterprise entities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Top Quick Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/50 p-3">
              <span className="text-xs text-slate-500 dark:text-gray-400">Grand Total</span>
              <div className="text-lg font-bold text-slate-900 dark:text-gray-100">
                ₱{formatMoney(overall.grandTotal)}
              </div>
            </div>
            <div className="rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 p-3">
              <span className="text-xs text-blue-600 dark:text-blue-400">Total SSS / GSIS</span>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                ₱{formatMoney(overall.sss)}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Total PhilHealth</span>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                ₱{formatMoney(overall.philhealth)}
              </div>
            </div>
            <div className="rounded-lg border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 p-3">
              <span className="text-xs text-amber-600 dark:text-amber-400">Total Pag-IBIG</span>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                ₱{formatMoney(overall.pagibig)}
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="rounded-lg border border-slate-200 dark:border-gray-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-gray-800">
                  <TableHead>Company Entity</TableHead>
                  <TableHead className="text-center">Records</TableHead>
                  <TableHead className="text-right">SSS / GSIS</TableHead>
                  <TableHead className="text-right">PhilHealth</TableHead>
                  <TableHead className="text-right">Pag-IBIG</TableHead>
                  <TableHead className="text-right font-bold">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyAggregates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span>{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">{c.count}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      ₱{formatMoney(c.sss)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      ₱{formatMoney(c.philhealth)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      ₱{formatMoney(c.pagibig)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-gray-100">
                      ₱{formatMoney(c.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="bg-slate-50/80 dark:bg-gray-800/80 font-bold border-t-2">
                  <TableCell>Grand Total</TableCell>
                  <TableCell className="text-center font-mono">{rows.length}</TableCell>
                  <TableCell className="text-right font-mono">₱{formatMoney(overall.sss)}</TableCell>
                  <TableCell className="text-right font-mono">
                    ₱{formatMoney(overall.philhealth)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₱{formatMoney(overall.pagibig)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-primary text-base">
                    ₱{formatMoney(overall.grandTotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
