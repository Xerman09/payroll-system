// modules/benefit-settings/components/government/GovernmentLogsTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { RefreshCcw, FileDown, Shield, HeartPulse, Landmark, Building2, Wallet, Coins } from "lucide-react";

import type {
  BenefitCode,
  BenefitLogRow,
  CutoffSetting,
  UserData,
  Department,
} from "../../types";
import {
  fetchBenefitLogs,
  fetchCutoffSettings,
  fetchCompanyConfig,
  formatMoney,
} from "../../providers/benefitApi";
import type { BenefitLogsPaperSize } from "../../utils/benefitLogsPdf";
import { BenefitTableSkeleton } from "../BenefitSettingsSkeleton";
import BenefitExportPreviewDialog from "../BenefitExportPreviewDialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" && dateStr.includes("T") ? parseISO(dateStr) : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, "MMM dd, yyyy");
  } catch {
    return String(dateStr);
  }
}

function userName(users: UserData[], userId: number) {
  const u = users.find((x) => x.user_id === userId);
  return u ? `${u.user_fname} ${u.user_lname}`.trim() : `User #${userId}`;
}

export default function GovernmentLogsTab({
  users,
  departments,
}: {
  users: UserData[];
  departments: Department[];
}) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [companyName, setCompanyName] = React.useState("LGU / Government Unit");

  const [cutoffs, setCutoffs] = React.useState<CutoffSetting[]>([]);
  const [rows, setRows] = React.useState<BenefitLogRow[]>([]);

  // Filters
  const [q, setQ] = React.useState("");
  const [agency, setAgency] = React.useState<"ALL" | "GSIS" | "PHILHEALTH" | "PAGIBIG">("ALL");
  const [cutoffFilter, setCutoffFilter] = React.useState<string>("ALL");
  const [deptFilter, setDeptFilter] = React.useState<string>("ALL");

  // Export Dialog state
  const [exportOpen, setExportOpen] = React.useState(false);
  const [paperSize, setPaperSize] = React.useState<BenefitLogsPaperSize>("LETTER");

  const userDeptMap = React.useMemo(() => {
    const m = new Map<number, number | null>();
    for (const u of users) m.set(u.user_id, u.user_department ?? null);
    return m;
  }, [users]);

  const deptNameMap = React.useMemo(() => {
    const m = new Map<number, string>();
    for (const d of departments) m.set(d.department_id, d.department_name);
    return m;
  }, [departments]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [l, c, cfg] = await Promise.all([
        fetchBenefitLogs(),
        fetchCutoffSettings(),
        fetchCompanyConfig(),
      ]);
      setRows(l);
      setCutoffs(c);
      if (cfg?.companyName) setCompanyName(cfg.companyName);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load benefit logs.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      toast.success("Government logs refreshed.");
    } finally {
      setRefreshing(false);
    }
  };

  // Compute government counterpart for a row
  const getGovernmentShare = (row: BenefitLogRow): number => {
    const deducted = Number(row.deducted_amount) || 0;
    if (row.log_type === "LOAN") return 0; // Loans are fully personal

    if (row.benefit_code === "SSS") {
      // In government mode, SSS is GSIS: Personal 9%, Gov 12%
      // So LGU Share = deducted * (12 / 9) = deducted * 1.333333
      return Math.round((deducted * (12 / 9)) * 100) / 100;
    }
    if (row.benefit_code === "PHILHEALTH") {
      // PhilHealth: 50/50 split (2.5% personal, 2.5% LGU)
      return deducted;
    }
    if (row.benefit_code === "PAGIBIG") {
      // Pag-IBIG: LGU matches standard ₱200 (or up to deducted)
      return Math.min(deducted, 200);
    }
    return 0;
  };

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      // Agency filter: GSIS maps to SSS
      if (agency === "GSIS" && r.benefit_code !== "SSS") return false;
      if (agency === "PHILHEALTH" && r.benefit_code !== "PHILHEALTH") return false;
      if (agency === "PAGIBIG" && r.benefit_code !== "PAGIBIG") return false;

      if (cutoffFilter !== "ALL" && String(r.cutoff_id) !== cutoffFilter) return false;

      if (deptFilter !== "ALL") {
        const dId = userDeptMap.get(r.user_id);
        if (String(dId) !== deptFilter) return false;
      }

      if (q.trim()) {
        const query = q.trim().toLowerCase();
        const uname = userName(users, r.user_id).toLowerCase();
        const ref = (r.payroll_ref_no || "").toLowerCase();
        const note = (r.note || "").toLowerCase();
        if (!uname.includes(query) && !ref.includes(query) && !note.includes(query))
          return false;
      }

      return true;
    });
  }, [rows, agency, cutoffFilter, deptFilter, q, users, userDeptMap]);

  // Aggregates
  const aggregates = React.useMemo(() => {
    let employeeTotal = 0;
    let govTotal = 0;

    for (const r of filtered) {
      const emp = Number(r.deducted_amount) || 0;
      const gov = getGovernmentShare(r);
      employeeTotal += emp;
      govTotal += gov;
    }

    return {
      employeeTotal,
      govTotal,
      grandTotal: employeeTotal + govTotal,
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-2">
            <span>LGU Government Remittance &amp; Deduction Logs</span>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-300 text-emerald-700 dark:text-emerald-400">
              Cost-Sharing Transparency
            </Badge>
          </div>
          <div className="text-xs text-slate-500 dark:text-gray-400">
            Nakalista ang bawas sa sahod ng empleyado katabi ang kaukulang share o hulog ng pamahalaang lokal (LGU).
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing || loading}
            className="h-8 text-xs"
          >
            <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setExportOpen(true)}
            disabled={loading || filtered.length === 0}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            Export / Print LGU Logs
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-3">
          <div className="p-2 rounded-md bg-blue-600 text-white">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
              Total Personal Withheld (Ikaw)
            </div>
            <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
              ₱{formatMoney(aggregates.employeeTotal)}
            </div>
            <div className="text-[10px] text-slate-400">Bawas sa mga kawani</div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-3">
          <div className="p-2 rounded-md bg-emerald-600 text-white">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
              Total LGU Share (Government)
            </div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              ₱{formatMoney(aggregates.govTotal)}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Hulog ng pamahalaan</div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-3">
          <div className="p-2 rounded-md bg-indigo-600 text-white">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
              Total Agency Remittance
            </div>
            <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
              ₱{formatMoney(aggregates.grandTotal)}
            </div>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400">Personal + LGU Counterpart</div>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between bg-slate-50 dark:bg-gray-800/40 p-3 rounded-lg border border-slate-200 dark:border-gray-800">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search employee, ref #..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 text-xs bg-white dark:bg-gray-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={agency}
            onValueChange={(val) => setAgency(val as typeof agency)}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs bg-white dark:bg-gray-900">
              <SelectValue placeholder="Agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Agencies</SelectItem>
              <SelectItem value="GSIS">GSIS (9%/12%)</SelectItem>
              <SelectItem value="PHILHEALTH">PhilHealth (5%)</SelectItem>
              <SelectItem value="PAGIBIG">Pag-IBIG (₱200)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={cutoffFilter} onValueChange={setCutoffFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-white dark:bg-gray-900">
              <SelectValue placeholder="Cutoff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Cutoffs</SelectItem>
              {cutoffs.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.cutoff_type} ({formatDateSafe(c.start_date)} - {formatDateSafe(c.end_date)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-white dark:bg-gray-900">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.department_id} value={String(d.department_id)}>
                  {d.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-gray-800/60">
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Agency</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right text-blue-700 dark:text-blue-400">Personal (Bawas)</TableHead>
              <TableHead className="text-right text-emerald-700 dark:text-emerald-400">LGU Share</TableHead>
              <TableHead className="text-right font-semibold">Total Remitted</TableHead>
              <TableHead>Cutoff Period</TableHead>
              <TableHead>Date Posted</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <BenefitTableSkeleton columns={9} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-sm text-slate-500"
                >
                  Walang nakitang government benefit logs.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const isGsis = r.benefit_code === "SSS";
                const isPhilhealth = r.benefit_code === "PHILHEALTH";
                const isPagibig = r.benefit_code === "PAGIBIG";

                const govShare = getGovernmentShare(r);
                const empShare = Number(r.deducted_amount) || 0;
                const totalRemitted = empShare + govShare;

                const deptId = userDeptMap.get(r.user_id);
                const deptName = deptId ? deptNameMap.get(deptId) || "—" : "—";

                return (
                  <TableRow
                    key={r.benefit_log_id}
                    className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 border-b dark:border-gray-800 text-xs"
                  >
                    <TableCell className="font-medium">
                      {userName(users, r.user_id)}
                      {r.payroll_ref_no ? (
                        <div className="text-[10px] text-slate-400">
                          Ref: {r.payroll_ref_no}
                        </div>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-slate-600 dark:text-gray-300">
                      {deptName}
                    </TableCell>

                    <TableCell>
                      {isGsis && (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200 text-[10px] font-semibold flex items-center gap-1 w-fit">
                          <Shield className="h-3 w-3" />
                          GSIS
                        </Badge>
                      )}
                      {isPhilhealth && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200 text-[10px] font-semibold flex items-center gap-1 w-fit">
                          <HeartPulse className="h-3 w-3" />
                          PhilHealth
                        </Badge>
                      )}
                      {isPagibig && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200 text-[10px] font-semibold flex items-center gap-1 w-fit">
                          <Landmark className="h-3 w-3" />
                          Pag-IBIG
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {r.log_type}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-medium text-blue-700 dark:text-blue-400 tabular-nums">
                      ₱{formatMoney(empShare)}
                    </TableCell>

                    <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                      ₱{formatMoney(govShare)}
                    </TableCell>

                    <TableCell className="text-right font-bold text-slate-900 dark:text-white tabular-nums">
                      ₱{formatMoney(totalRemitted)}
                    </TableCell>

                    <TableCell className="text-slate-600 dark:text-gray-300">
                      {r.cutoff_start && r.cutoff_end ? (
                        <span>{formatDateSafe(r.cutoff_start)} - {formatDateSafe(r.cutoff_end)}</span>
                      ) : (
                        `Cutoff #${r.cutoff_id}`
                      )}
                    </TableCell>

                    <TableCell className="text-slate-500 dark:text-gray-400">
                      {formatDateSafe(r.created_date || r.posted_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Export Dialog */}
      <BenefitExportPreviewDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        allRows={rows}
        users={users}
        departments={departments}
        initialCutoffRange={cutoffFilter}
        initialBenefit={agency === "GSIS" ? "SSS" : agency}
        initialType="ALL"
        initialDepartment={deptFilter === "ALL" ? "ALL" : Number(deptFilter)}
        initialPaper={paperSize}
        companyName={companyName}
      />
    </div>
  );
}
