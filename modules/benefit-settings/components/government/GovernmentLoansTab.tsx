// modules/benefit-settings/components/government/GovernmentLoansTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, RefreshCcw, Pencil, Trash2, Calendar, Shield, Landmark } from "lucide-react";

import type {
  UserData,
  BenefitLoan,
  CutoffSetting,
  LoanBenefitCode,
  BenefitLoanStatus,
} from "../../types";
import {
  fetchBenefitLoans,
  fetchCutoffSettings,
  deleteBenefitLoan,
  cutoffLabel,
  computeLoanCutoffSchedule,
  formatMoney,
} from "../../providers/benefitApi";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import BenefitLoanModal from "../BenefitLoanModal";
import LoanScheduleDialog from "../LoanScheduleDialog";
import { BenefitTableSkeleton } from "../BenefitSettingsSkeleton";

function userName(users: UserData[], userId: number) {
  const u = users.find((x) => x.user_id === userId);
  return u ? `${u.user_fname} ${u.user_lname}`.trim() : `User #${userId}`;
}

function statusBadge(status: BenefitLoanStatus) {
  if (status === "ACTIVE")
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        Active
      </Badge>
    );
  if (status === "CLOSED") return <Badge variant="secondary">Closed</Badge>;
  return <Badge variant="destructive">Cancelled</Badge>;
}

export default function GovernmentLoansTab({ users }: { users: UserData[] }) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [cutoffs, setCutoffs] = React.useState<CutoffSetting[]>([]);
  const [rows, setRows] = React.useState<BenefitLoan[]>([]);

  // Filters
  const [q, setQ] = React.useState("");
  const [benefit, setBenefit] = React.useState<LoanBenefitCode | "ALL">("ALL");
  const [status, setStatus] = React.useState<BenefitLoanStatus | "ALL">("ALL");

  // Modals
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BenefitLoan | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<BenefitLoan | null>(null);

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleLoan, setScheduleLoan] = React.useState<BenefitLoan | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([
        fetchBenefitLoans(),
        fetchCutoffSettings(),
      ]);
      setRows(l);
      setCutoffs(c);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load government loans.";
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
      toast.success("Government loans refreshed.");
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (benefit !== "ALL" && r.benefit_code !== benefit) return false;
      if (status !== "ALL" && r.status !== status) return false;

      if (q.trim()) {
        const query = q.trim().toLowerCase();
        const uname = userName(users, r.user_id).toLowerCase();
        const ref = (r.reference_no || "").toLowerCase();
        const lname = (r.loan_name || "").toLowerCase();
        if (!uname.includes(query) && !ref.includes(query) && !lname.includes(query))
          return false;
      }

      return true;
    });
  }, [rows, benefit, status, q, users]);

  const onDeleteConfirm = async () => {
    if (!toDelete) return;
    try {
      await deleteBenefitLoan(toDelete.loan_id);
      toast.success("Government loan record deleted.");
      setDeleteOpen(false);
      setToDelete(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete loan.";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-2">
            <span>GSIS &amp; Pag-IBIG Government Loans</span>
            <Badge variant="outline" className="text-[10px] font-mono border-blue-300 text-blue-700 dark:text-blue-400">
              Public Sector
            </Badge>
          </div>
          <div className="text-xs text-slate-500 dark:text-gray-400">
            Pamahalaan ang mga loan amortization ng mga kawani para sa GSIS Conso-Loan, Policy Loan, at Pag-IBIG MPL.
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
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Gov&apos;t Loan
          </Button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between bg-slate-50 dark:bg-gray-800/40 p-3 rounded-lg border border-slate-200 dark:border-gray-800">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search employee, loan type, ref #..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 text-xs bg-white dark:bg-gray-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={benefit}
            onValueChange={(val) => setBenefit(val as LoanBenefitCode | "ALL")}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs bg-white dark:bg-gray-900">
              <SelectValue placeholder="Agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Agencies</SelectItem>
              <SelectItem value="SSS">GSIS (Conso/Policy)</SelectItem>
              <SelectItem value="PAGIBIG">Pag-IBIG (MPL)</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(val) => setStatus(val as BenefitLoanStatus | "ALL")}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs bg-white dark:bg-gray-900">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
              <TableHead>Agency</TableHead>
              <TableHead>Loan Name</TableHead>
              <TableHead className="text-right">Total Payable</TableHead>
              <TableHead className="text-right">Amortization</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
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
                  Walang nakitang government loans.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const sched = computeLoanCutoffSchedule({ loan: r, cutoffs });
                const start = cutoffs.find((c) => c.id === r.start_cutoff_id);
                const payments = sched.all.length
                  ? `${sched.paid.length}/${sched.all.length}`
                  : start
                  ? `0/${r.terms_installments}`
                  : "—";

                const isGsis = r.benefit_code === "SSS";

                return (
                  <TableRow
                    key={r.loan_id}
                    className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 border-b dark:border-gray-800 text-xs"
                  >
                    <TableCell className="font-medium">
                      {userName(users, r.user_id)}
                      {r.reference_no ? (
                        <div className="text-[11px] text-slate-500 dark:text-gray-400">
                          Ref: {r.reference_no}
                        </div>
                      ) : null}
                    </TableCell>

                    <TableCell>
                      {isGsis ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200 text-[10px] font-semibold flex items-center gap-1 w-fit">
                          <Shield className="h-3 w-3" />
                          GSIS
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200 text-[10px] font-semibold flex items-center gap-1 w-fit">
                          <Landmark className="h-3 w-3" />
                          Pag-IBIG
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-gray-100">
                        {r.loan_name || (isGsis ? "GSIS Loan" : "Pag-IBIG Loan")}
                      </div>
                      {start ? (
                        <div className="text-[11px] text-slate-500 dark:text-gray-400">
                          Start: {cutoffLabel(start)}
                        </div>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-right font-medium tabular-nums text-slate-900 dark:text-gray-100">
                      ₱{formatMoney(r.total_payable)}
                      <div className="text-[11px] text-slate-500 dark:text-gray-400">
                        Bal: ₱{formatMoney(r.remaining_balance)}
                      </div>
                    </TableCell>

                    <TableCell className="text-right font-medium tabular-nums text-blue-700 dark:text-blue-400">
                      ₱{formatMoney(r.amortization_amount)}
                      <div className="text-[11px] text-slate-500 dark:text-gray-400">
                        Terms: {r.terms_installments}
                      </div>
                    </TableCell>

                    <TableCell className="tabular-nums text-slate-700 dark:text-gray-300">
                      {payments}
                      <div className="text-[11px] text-slate-500 dark:text-gray-400">
                        Cutoff: {r.deduct_on}
                      </div>
                    </TableCell>

                    <TableCell className="text-slate-700 dark:text-gray-300">
                      {sched.nextDue ? cutoffLabel(sched.nextDue) : "—"}
                    </TableCell>

                    <TableCell>{statusBadge(r.status)}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-600 hover:text-blue-600"
                          title="View Amortization Schedule"
                          onClick={() => {
                            setScheduleLoan(r);
                            setScheduleOpen(true);
                          }}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-600 hover:text-blue-600"
                          title="Edit Loan"
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-600 hover:text-red-600"
                          title="Delete Loan"
                          onClick={() => {
                            setToDelete(r);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Loan Create/Edit Modal */}
      <BenefitLoanModal
        open={open}
        onOpenChange={setOpen}
        users={users}
        cutoffs={cutoffs}
        initial={editing}
        onSaved={async () => {
          setOpen(false);
          await load();
        }}
      />

      {/* Schedule Dialog */}
      <LoanScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        loan={scheduleLoan}
        cutoffs={cutoffs}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Government Loan?</AlertDialogTitle>
            <AlertDialogDescription>
              Sigurado ka bang nais mong tanggalin ang loan record na ito para kay &quot;
              {toDelete ? userName(users, toDelete.user_id) : ""}&quot;? Hindi na ito maibabalik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
