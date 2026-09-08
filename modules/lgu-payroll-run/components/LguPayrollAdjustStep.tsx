// modules/lgu-payroll-run/components/LguPayrollAdjustStep.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Shield,
  HeartPulse,
  Landmark,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Wallet,
  Coins,
  Lock,
  Unlock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { formatPhp } from "../utils/lguCompute";
import type { LguPayrollLine, LguPayrollSummary, Department } from "../types";

interface LguPayrollAdjustStepProps {
  lines: LguPayrollLine[];
  summary: LguPayrollSummary;
  departments: Department[];
  onToggleHold: (userId: number) => void;
  onProceed: () => void;
  onBack: () => void;
  isProcessing?: boolean;
}

export default function LguPayrollAdjustStep({
  lines,
  summary,
  departments,
  onToggleHold,
  onProceed,
  onBack,
  isProcessing = false,
}: LguPayrollAdjustStepProps) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "HOLD">("ALL");

  // Detail Modal
  const [detailLine, setDetailLine] = useState<LguPayrollLine | null>(null);

  const filteredLines = useMemo(() => {
    return lines.filter((l) => {
      if (statusFilter === "ACTIVE" && l.isOnHold) return false;
      if (statusFilter === "HOLD" && !l.isOnHold) return false;

      if (deptFilter !== "ALL" && String(l.departmentId) !== deptFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = l.employeeName.toLowerCase().includes(q);
        const matchPos = l.position.toLowerCase().includes(q);
        const matchDept = l.departmentName.toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchDept) return false;
      }

      return true;
    });
  }, [lines, search, deptFilter, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Top Aggregation Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">Aktibong Kawani</div>
          <div className="text-lg font-bold text-slate-900 dark:text-gray-100">
            {summary.activeHeadcount} <span className="text-xs font-normal text-slate-400">/ {summary.totalHeadcount}</span>
          </div>
          <div className="text-[10px] text-amber-600 font-medium">{summary.onHoldHeadcount} on-hold</div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">Gross (Basic + PERA)</div>
          <div className="text-lg font-bold text-slate-900 dark:text-gray-100">
            {formatPhp(summary.totalGrossPay)}
          </div>
          <div className="text-[10px] text-slate-400">PERA: {formatPhp(summary.totalPeraAllowance)}</div>
        </div>

        <div className="p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm">
          <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300">Bawas sa Sahod</div>
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
            {formatPhp(summary.totalPersonalDeductions)}
          </div>
          <div className="text-[10px] text-blue-600/80 dark:text-blue-400">GSIS, PhilHealth, HDMF</div>
        </div>

        <div className="p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm">
          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Net Take-Home Pay</div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {formatPhp(summary.totalNetPay)}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400">Netong Sahod ng Kawani</div>
        </div>

        <div className="p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm">
          <div className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">Sagot ng LGU</div>
          <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
            {formatPhp(summary.totalLguCounterpart)}
          </div>
          <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400">GSIS 12% + PH 2.5% + HDMF</div>
        </div>

        <div className="p-3 rounded-xl border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 shadow-sm">
          <div className="text-[11px] font-medium text-purple-700 dark:text-purple-300">Kabuuang Gastos LGU</div>
          <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
            {formatPhp(summary.grandTotalAppropriation)}
          </div>
          <div className="text-[10px] text-purple-600/80 dark:text-purple-400">Appropriation / Fund</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-900 p-3 rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Hanapin ang kawani, posisyon, o opisina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs bg-slate-50 dark:bg-gray-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Lahat ng Opisina (All Offices)</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.department_id} value={String(d.department_id)}>
                  {d.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active Lang</SelectItem>
              <SelectItem value="HOLD">On-Hold Lang</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Cost-Sharing Payroll Register Table */}
      <div className="rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/90 dark:bg-gray-800/80 text-[11px]">
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Kawani / Posisyon</TableHead>
                <TableHead>Tanggapan</TableHead>
                <TableHead className="text-right">Basic Pay</TableHead>
                <TableHead className="text-right">PERA</TableHead>
                <TableHead className="text-right font-semibold text-blue-700 dark:text-blue-400">
                  GSIS (9%)
                </TableHead>
                <TableHead className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                  PhilHealth (2.5%)
                </TableHead>
                <TableHead className="text-right font-semibold text-amber-700 dark:text-amber-400">
                  Pag-IBIG
                </TableHead>
                <TableHead className="text-right font-bold text-red-600 dark:text-red-400">
                  Total Bawas
                </TableHead>
                <TableHead className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                  Net Take-Home
                </TableHead>
                <TableHead className="text-right font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20">
                  Sagot ng LGU
                </TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-16 text-center">Aksyon</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="text-xs">
              {filteredLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-12 text-center text-slate-500">
                    Walang kawani na tumugma sa filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLines.map((l, idx) => {
                  return (
                    <TableRow
                      key={l.userId}
                      className={`hover:bg-slate-50/70 dark:hover:bg-gray-800/40 border-b dark:border-gray-800 transition-colors ${
                        l.isOnHold ? "opacity-60 bg-amber-50/30 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      <TableCell className="text-center font-mono text-[10px] text-slate-400">
                        {idx + 1}
                      </TableCell>

                      <TableCell>
                        <div className="font-semibold text-slate-900 dark:text-gray-100">
                          {l.employeeName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-gray-400">
                          {l.position}
                        </div>
                      </TableCell>

                      <TableCell className="text-slate-600 dark:text-gray-300">
                        {l.departmentName}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums">
                        {formatPhp(l.basicPay)}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums text-slate-600 dark:text-gray-300">
                        {formatPhp(l.peraAllowance)}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums font-medium text-blue-700 dark:text-blue-400">
                        {formatPhp(l.statutory.gsisEmployee)}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                        {formatPhp(l.statutory.philhealthEmployee)}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums font-medium text-amber-700 dark:text-amber-400">
                        {formatPhp(l.statutory.pagibigEmployee)}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums font-bold text-red-600 dark:text-red-400">
                        {formatPhp(l.totalPersonalDeductions)}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                        {formatPhp(l.netPay)}
                      </TableCell>

                      <TableCell className="text-right font-mono tabular-nums font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20">
                        {formatPhp(l.totalLguCounterpart)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleHold(l.userId)}
                          className={`h-7 px-2 text-[10px] font-semibold flex items-center gap-1 ${
                            l.isOnHold
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {l.isOnHold ? (
                            <>
                              <Lock className="h-3 w-3" />
                              On-Hold
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3 w-3 text-slate-400" />
                              Active
                            </>
                          )}
                        </Button>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailLine(l)}
                          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Tingnan ang Detalyadong Breakdown"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="text-xs h-9 flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Bumalik (Back)</span>
        </Button>

        <Button
          onClick={onProceed}
          disabled={isProcessing || summary.activeHeadcount === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 flex items-center gap-1.5 px-5"
        >
          <span>Ipasa sa Pagproseso (Process)</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Itemized Detail Modal */}
      <Dialog open={Boolean(detailLine)} onOpenChange={(open) => !open && setDetailLine(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-blue-600" />
              <span>LGU Payroll Breakdown: {detailLine?.employeeName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detailLine?.position} • {detailLine?.departmentName}
            </DialogDescription>
          </DialogHeader>

          {detailLine && (
            <div className="space-y-4 py-2 text-xs">
              {/* Earnings */}
              <div className="rounded-lg bg-slate-50 dark:bg-gray-800/60 p-3 border border-slate-200 dark:border-gray-700 space-y-1.5">
                <div className="font-bold text-slate-800 dark:text-gray-200 border-b border-slate-200 pb-1 flex justify-between">
                  <span>Mga Sahod at Allowance (Earnings)</span>
                  <span className="text-blue-700 font-mono">{formatPhp(detailLine.totalGrossPay)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Basic Pay (11 araw / 1st half):</span>
                  <span className="font-mono">{formatPhp(detailLine.basicPay)}</span>
                </div>
                <div className="flex justify-between">
                  <span>PERA Allowance:</span>
                  <span className="font-mono">{formatPhp(detailLine.peraAllowance)}</span>
                </div>
                {detailLine.overtimePay > 0 && (
                  <div className="flex justify-between">
                    <span>Overtime Pay:</span>
                    <span className="font-mono">{formatPhp(detailLine.overtimePay)}</span>
                  </div>
                )}
              </div>

              {/* Personal Deductions vs LGU Share Comparison */}
              <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/30 p-3 border border-blue-200 dark:border-blue-900/40 space-y-2">
                <div className="font-bold text-blue-950 dark:text-blue-200 border-b border-blue-200 pb-1">
                  Statutory Cost-Sharing Scheme (Hati ang LGU at Empleyado)
                </div>

                <div className="grid grid-cols-3 gap-2 font-semibold text-[11px] text-slate-500 pb-0.5 border-b border-slate-200/60">
                  <span>Ahensya</span>
                  <span className="text-right text-blue-700">Personal (Bawas)</span>
                  <span className="text-right text-emerald-700">LGU Share</span>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="font-sans font-medium text-slate-700 dark:text-gray-300">GSIS (9% vs 12%)</span>
                  <span className="text-right text-blue-700 font-semibold">{formatPhp(detailLine.statutory.gsisEmployee)}</span>
                  <span className="text-right text-emerald-700 font-semibold">{formatPhp(detailLine.statutory.gsisGovernment)}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="font-sans font-medium text-slate-700 dark:text-gray-300">PhilHealth (2.5% vs 2.5%)</span>
                  <span className="text-right text-blue-700 font-semibold">{formatPhp(detailLine.statutory.philhealthEmployee)}</span>
                  <span className="text-right text-emerald-700 font-semibold">{formatPhp(detailLine.statutory.philhealthGovernment)}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="font-sans font-medium text-slate-700 dark:text-gray-300">Pag-IBIG (DBM standard)</span>
                  <span className="text-right text-blue-700 font-semibold">{formatPhp(detailLine.statutory.pagibigEmployee)}</span>
                  <span className="text-right text-emerald-700 font-semibold">{formatPhp(detailLine.statutory.pagibigGovernment)}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono pt-1 border-t border-blue-200/70 font-bold">
                  <span className="font-sans text-slate-900 dark:text-gray-100">Subtotal Statutory</span>
                  <span className="text-right text-blue-800">{formatPhp(detailLine.statutory.totalEmployeeStatutory)}</span>
                  <span className="text-right text-emerald-800">{formatPhp(detailLine.statutory.totalGovernmentStatutory)}</span>
                </div>
              </div>

              {/* Net Take-Home vs LGU Budget Impact */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200">
                  <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Netong Sahod (Kawani)</div>
                  <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    {formatPhp(detailLine.netPay)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200">
                  <div className="text-[11px] font-medium text-indigo-800 dark:text-indigo-300">Kabuuang Gastos ng LGU</div>
                  <div className="text-base font-bold text-indigo-700 dark:text-indigo-400 font-mono">
                    {formatPhp(detailLine.totalLguAppropriation)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailLine(null)} className="text-xs">
              Isara (Close)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
