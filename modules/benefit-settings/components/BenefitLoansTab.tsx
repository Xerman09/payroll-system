// modules/benefit-settings/components/BenefitLoansTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, RefreshCcw, Pencil, Trash2, Calendar } from "lucide-react";

import type {
  UserData,
  BenefitLoan,
  CutoffSetting,
  LoanBenefitCode,
  BenefitLoanStatus,
} from "../types";
import {
  fetchBenefitLoans,
  fetchCutoffSettings,
  deleteBenefitLoan,
  cutoffLabel,
  computeLoanCutoffSchedule,
  formatMoney,
} from "../providers/benefitApi";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

import BenefitLoanModal from "./BenefitLoanModal";
import LoanScheduleDialog from "./LoanScheduleDialog";
import { BenefitTableSkeleton } from "./BenefitSettingsSkeleton";

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

export default function BenefitLoansTab({ users }: { users: UserData[] }) {
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
  const [scheduleLoan, setScheduleLoan] = React.useState<BenefitLoan | null>(
    null
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        fetchCutoffSettings(),
        fetchBenefitLoans(),
      ]);
      setCutoffs(c);
      setRows(l);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load benefit loans.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const l = await fetchBenefitLoans();
      setRows(l);
      toast.success("Loans refreshed.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to refresh loans.";
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (benefit !== "ALL" && r.benefit_code !== benefit) return false;
      if (status !== "ALL" && r.status !== status) return false;

      if (!needle) return true;
      const name = userName(users, r.user_id).toLowerCase();
      const ref = (r.reference_no ?? "").toLowerCase();
      const ln = (r.loan_name ?? "").toLowerCase();
      return (
        name.includes(needle) || ref.includes(needle) || ln.includes(needle)
      );
    });
  }, [rows, q, benefit, status, users]);

  const onCreate = React.useCallback(() => {
    setEditing(null);
    setOpen(true);
  }, []);

  const onEdit = React.useCallback((row: BenefitLoan) => {
    setEditing(row);
    setOpen(true);
  }, []);

  const onAskDelete = React.useCallback((row: BenefitLoan) => {
    setToDelete(row);
    setDeleteOpen(true);
  }, []);

  const onConfirmDelete = React.useCallback(async () => {
    if (!toDelete) return;
    try {
      await deleteBenefitLoan(toDelete.loan_id);
      toast.success("Loan deleted.");
      setRows((prev) => prev.filter((x) => x.loan_id !== toDelete.loan_id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete loan.";
      toast.error(msg);
    } finally {
      setDeleteOpen(false);
      setToDelete(null);
    }
  }, [toDelete]);

  const openSchedule = React.useCallback((row: BenefitLoan) => {
    setScheduleLoan(row);
    setScheduleOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Filters + actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600 dark:text-gray-400">Search</div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Employee, reference, loan name…"
              className="h-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600 dark:text-gray-400">Benefit</div>
            <Select value={benefit} onValueChange={(v) => setBenefit(v as LoanBenefitCode | "ALL")}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="SSS">SSS</SelectItem>
                <SelectItem value="PAGIBIG">PAGIBIG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600 dark:text-gray-400">Status</div>
            <Select value={status} onValueChange={(v) => setStatus(v as BenefitLoanStatus | "ALL")}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Loan
          </Button>
        </div>
      </div>

      <Separator />

      {/* Table */}
      <div className="rounded-lg border border-slate-200 dark:border-gray-800">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-gray-800/50">
              <TableHead>Employee</TableHead>
              <TableHead>Benefit</TableHead>
              <TableHead>Loan</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Amort.</TableHead>
              <TableHead>Payments</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
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
                  No loans found.
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

                return (
                  <TableRow key={r.loan_id} className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 border-b dark:border-gray-800">
                    <TableCell className="font-medium">
                      {userName(users, r.user_id)}
                      {r.reference_no ? (
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          Ref: {r.reference_no}
                        </div>
                      ) : null}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] dark:border-gray-700 dark:text-gray-300"
                      >
                        {r.benefit_code}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm dark:text-gray-200">{r.loan_name || "—"}</div>
                      {start ? (
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          Start: {cutoffLabel(start)}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-700">
                          Start cutoff not found
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right tabular-nums dark:text-gray-200">
                      {formatMoney(r.total_payable)}
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        Rem: {formatMoney(r.remaining_balance)}
                      </div>
                    </TableCell>

                    <TableCell className="text-right tabular-nums dark:text-gray-200">
                      {formatMoney(r.amortization_amount)}
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        Terms: {r.terms_installments}
                      </div>
                    </TableCell>

                    <TableCell className="tabular-nums dark:text-gray-200">
                      {payments}
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        Deduct: {r.deduct_on}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm dark:text-gray-200">
                      {sched.nextDue ? (
                        <div className="flex items-center gap-2">
                          <span className="truncate">
                            {cutoffLabel(sched.nextDue)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-gray-500">—</span>
                      )}
                    </TableCell>

                    <TableCell>{statusBadge(r.status)}</TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSchedule(r)}
                          className="h-8"
                          title="View schedule"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(r)}
                          className="h-8"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAskDelete(r)}
                          className="h-8"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Modals */}
      <BenefitLoanModal
        open={open}
        onOpenChange={setOpen}
        users={users}
        cutoffs={cutoffs}
        initial={editing}
        onSaved={(saved) => {
          setRows((prev) => {
            const exists = prev.some((x) => x.loan_id === saved.loan_id);
            return exists
              ? prev.map((x) => (x.loan_id === saved.loan_id ? saved : x))
              : [saved, ...prev];
          });
          toast.success(editing ? "Loan updated." : "Loan created.");
        }}
      />

      <LoanScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        loan={scheduleLoan}
        cutoffs={cutoffs}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete loan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the loan record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
