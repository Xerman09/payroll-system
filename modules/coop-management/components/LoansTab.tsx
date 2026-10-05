"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { Edit, Trash2, HandCoins } from "lucide-react";

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

import type {
  EmployeeLoan,
  LoanPayment,
  LoanRowData,
  SortConfig,
  TabContentProps,
  User,
} from "../types";
import { formatPeso } from "../helpers";
import { listItems, deleteItem, updateItem } from "../providers/coopApi";
import { SortableHeader } from "./SortableHeader";
import { AddLoanModal } from "./modals/AddLoanModal";
import { EditLoanModal } from "./modals/EditLoanModal";
import { OnboardPaymentModal } from "./modals/OnboardPaymentModal";
import { CoopTableSkeleton } from "./CoopTableSkeleton";

const LoansTab = forwardRef<{ getData: () => unknown[] }, TabContentProps>(
  function LoansTab(
    {
      searchTerm,
      statusFilter,
      refreshTrigger,
      isAddModalOpen,
      onCloseAddModal,
      isOnboardPaymentOpen,
      onCloseOnboardPayment,
    },
    ref
  ) {
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);
  const [onboardingLoan, setOnboardingLoan] = useState<EmployeeLoan | null>(null);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOnboardPaymentOpen) {
      setIsOnboardModalOpen(true);
    }
  }, [isOnboardPaymentOpen]);

  const rowsPerPage = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalLoans, setTotalLoans] = useState<number>(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  useImperativeHandle(ref, () => ({
    getData: () => processedRows,
  }));

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const offset = (currentPage - 1) * rowsPerPage;

        // ✅ IMPORTANT: Filter to COOP only (server-side)
        const { data: loanList, meta } = await listItems<EmployeeLoan>(
          "employee_loan",
          {
            limit: String(rowsPerPage),
            offset: String(offset),
            meta: "filter_count",
            ["filter[loan_type][_eq]"]: "COOP",
          },
          signal
        );

        if (signal?.aborted) return;

        const total: number =
          (meta?.filter_count as number) ?? (meta?.total as number) ?? loanList.length;

        setLoans(loanList);
        setTotalLoans(total);

        const userIds = Array.from(
          new Set(loanList.map((ln) => Number(ln.user_id)).filter(Boolean))
        );
        const loanIds = loanList
          .map((ln) => Number(ln.loan_id))
          .filter(Boolean);

        let userList: User[] = [];
        if (userIds.length > 0) {
          const ur = await listItems<User>(
            "user",
            {
              limit: String(userIds.length),
              ["filter[user_id][_in]"]: userIds.join(","),
              ["filter[is_employee][_eq]"]: "1",
            },
            signal
          );
          userList = ur.data;
        }

        if (signal?.aborted) return;
        setUsers(userList);

        // 1. Initialize payments map with each loan's persisted accumulated_amount
        const map: Record<number, number> = {};
        for (const ln of loanList) {
          const lid = Number(ln.loan_id);
          const acc = Number(ln.accumulated_amount || 0);
          if (lid) {
            map[lid] = acc;
          }
        }

        // 2. Add manual payments from employee_loan_payment table if any
        if (loanIds.length > 0) {
          try {
            const pr = await listItems<LoanPayment>(
              "employee_loan_payment",
              {
                limit: "-1",
                ["filter[loan_id][_in]"]: loanIds.join(","),
              },
              signal
            );

            for (const p of pr.data) {
              const lid = Number(p.loan_id);
              const amt = Number(p.amount_paid ?? p.amount ?? 0);
              if (!lid) continue;
              map[lid] = (map[lid] || 0) + amt;
            }
          } catch (e: unknown) {
            const err = e as Error;
            if (err?.name !== "AbortError") console.warn("Could not query employee_loan_payment", err);
          }
        }

        // 3. Query dynamic payroll run deductions from payroll_run_employee (primary DB column: loan_coop)
        if (userIds.length > 0) {
          try {
            const query = new URLSearchParams();
            query.set("aggregate[sum]", "loan_coop");
            query.set("groupBy[]", "user_id");
            query.set("filter[user_id][_in]", userIds.join(","));
            query.set("filter[loan_coop][_gt]", "0");
            query.set("filter[on_hold][_neq]", "1");

            const aggRes = await fetch(`/api/coop?collection=payroll_run_employee&${query.toString()}`, { signal });
            if (aggRes.ok) {
              const aggJson = await aggRes.json();
              if (Array.isArray(aggJson.data)) {
                for (const row of aggJson.data) {
                  const uid = Number(row.user_id);
                  const sumLoan = Number(row.sum?.loan_coop) || 0;
                  if (sumLoan > 0) {
                    const activeLoan = loanList.find((ln) => Number(ln.user_id) === uid);
                    if (activeLoan) {
                      const lid = Number(activeLoan.loan_id);
                      map[lid] = Math.max(map[lid] || 0, sumLoan);
                    }
                  }
                }
              }
            }
          } catch (e: unknown) {
            const err = e as Error;
            if (err?.name !== "AbortError") console.error("Failed to aggregate loans by loan_coop", err);
          }

          // Fallback check for coop_loan column
          try {
            const queryCoop = new URLSearchParams();
            queryCoop.set("aggregate[sum]", "coop_loan");
            queryCoop.set("groupBy[]", "user_id");
            queryCoop.set("filter[user_id][_in]", userIds.join(","));
            queryCoop.set("filter[coop_loan][_gt]", "0");
            queryCoop.set("filter[on_hold][_neq]", "1");

            const aggResCoop = await fetch(`/api/coop?collection=payroll_run_employee&${queryCoop.toString()}`, { signal });
            if (aggResCoop.ok) {
              const aggJsonCoop = await aggResCoop.json();
              if (Array.isArray(aggJsonCoop.data)) {
                for (const row of aggJsonCoop.data) {
                  const uid = Number(row.user_id);
                  const sumLoan = Number(row.sum?.coop_loan) || 0;
                  if (sumLoan > 0) {
                    const activeLoan = loanList.find((ln) => Number(ln.user_id) === uid);
                    if (activeLoan) {
                      const lid = Number(activeLoan.loan_id);
                      map[lid] = Math.max(map[lid] || 0, sumLoan);
                    }
                  }
                }
              }
            }
          } catch {
            // Ignore
          }
        }

        if (signal?.aborted) return;
        setPaymentsMap(map);
      } catch (err: unknown) {
        const e = err as Error;
        if (e?.name === "AbortError") return;
        console.error(err);
        setError("Failed to load data.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentPage]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, refreshTrigger]);

  const getUserName = useCallback(
    (userId: number) => {
      const user = users.find((u) => Number(u.user_id) === Number(userId));
      return user ? `${user.user_fname} ${user.user_lname}` : `User #${userId}`;
    },
    [users]
  );

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleConfirmDelete = async () => {
    if (!loanToDelete) return;
    setDeleting(true);
    try {
      await deleteItem("employee_loan", loanToDelete);
      setLoans((prev) => prev.filter((l) => l.loan_id !== loanToDelete));
      setTotalLoans((prev) => Math.max(0, prev - 1));
      toast.success("Deleted successfully.");
      setLoanToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete loan.");
    } finally {
      setDeleting(false);
    }
  };

  const processedRows = useMemo(() => {
    let data: LoanRowData[] = loans
      .filter((ln) => users.some((u) => Number(u.user_id) === Number(ln.user_id)))
      .map((ln) => {
      const loanAmount = Number(ln.loan_amount || 0);
      const accumulated = Number(ln.accumulated_amount || 0);
      const mappedPaid = paymentsMap[Number(ln.loan_id)] ?? 0;
      const totalPaid = Math.max(accumulated, mappedPaid);
      const balance = Math.max(0, loanAmount - totalPaid);
      const isFullyPaid = balance <= 0 && loanAmount > 0;
      if (isFullyPaid && ln.status === "ACTIVE") {
        updateItem("employee_loan", ln.loan_id, {
          status: "PAID",
          accumulated_amount: totalPaid,
        }).catch(() => {});
        ln.status = "PAID";
      }
      const name = getUserName(ln.user_id);
      return { loan: ln, name, loanAmount, totalPaid, balance };
    });

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter((row) => row.name.toLowerCase().includes(lower));
    }

    if (statusFilter !== "All") {
      data = data.filter((row) => row.loan.status === statusFilter);
    }

    if (sortConfig) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof LoanRowData];
        const bVal = b[sortConfig.key as keyof LoanRowData];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [loans, paymentsMap, getUserName, searchTerm, statusFilter, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(totalLoans / rowsPerPage));
  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, totalLoans);

  return (
    <>
      <div className="rounded-md border bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50">{error}</div>
        )}

        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-900/50">
            <TableRow>
              <TableHead className="w-[50px] text-xs font-semibold uppercase tracking-wider">
                No.
              </TableHead>

              <SortableHeader
                label="Name"
                sortKey="name"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-xs font-semibold uppercase tracking-wider"
              />

              <SortableHeader
                label="Total Loan"
                sortKey="loanAmount"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right text-xs font-semibold uppercase tracking-wider"
              />

              <SortableHeader
                label="Total Paid"
                sortKey="totalPaid"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right text-xs font-semibold uppercase tracking-wider"
              />

              <SortableHeader
                label="Total Balance"
                sortKey="balance"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right text-xs font-semibold uppercase tracking-wider"
              />

              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">
                Cutoff Payment
              </TableHead>

              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                Status
              </TableHead>

              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <CoopTableSkeleton type="loans" />
            ) : processedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              processedRows.map((row, idx) => (
                <TableRow
                  key={row.loan.loan_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <TableCell className="font-medium text-gray-500">
                    {startRow + idx}
                  </TableCell>

                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                    {row.name}
                  </TableCell>

                  <TableCell className="text-right text-gray-600 dark:text-gray-400 font-mono">
                    {formatPeso(row.loanAmount)}
                  </TableCell>

                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatPeso(row.totalPaid)}
                  </TableCell>

                  <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100 font-mono">
                    {formatPeso(row.balance)}
                  </TableCell>

                  <TableCell className="text-right text-gray-600 dark:text-gray-400 font-mono">
                    {formatPeso(row.loan.monthly_payment)}
                  </TableCell>

                  <TableCell className="text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.balance <= 0 || row.loan.status === "PAID"
                          ? "bg-primary/10 text-primary"
                          : row.loan.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {row.balance <= 0 ? "PAID" : row.loan.status}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setOnboardingLoan(row.loan);
                          setIsOnboardModalOpen(true);
                        }}
                        title="Onboard Previous Payment"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      >
                        <HandCoins size={14} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingLoan(row.loan)}
                        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5"
                      >
                        <Edit size={14} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLoanToDelete(row.loan.loan_id)}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-500">
          Showing{" "}
          <span className="font-medium">{totalLoans > 0 ? startRow : 0}</span>{" "}
          to <span className="font-medium">{endRow}</span> of{" "}
          <span className="font-medium">{totalLoans}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </Button>

          <span className="text-sm text-gray-600">
            Page {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <AddLoanModal
        isOpen={isAddModalOpen}
        onClose={onCloseAddModal}
        onCreate={(loan) => {
          // Optional guard: only show COOP loans in this tab
          if ((loan as EmployeeLoan)?.loan_type && (loan as EmployeeLoan).loan_type !== "COOP") {
            toast.message("Loan created, but not shown here (not COOP).");
            onCloseAddModal();
            return;
          }

          setLoans((prev) => [loan, ...prev]);
          setTotalLoans((prev) => prev + 1);
          onCloseAddModal();
        }}
      />

      <EditLoanModal
        isOpen={!!editingLoan}
        loan={editingLoan}
        totalPaid={
          editingLoan
            ? Math.max(
                Number(editingLoan.accumulated_amount || 0),
                paymentsMap[Number(editingLoan.loan_id)] ?? 0
              )
            : 0
        }
        onClose={() => setEditingLoan(null)}
        onOpenOnboardPayment={(loan) => {
          setEditingLoan(null);
          setOnboardingLoan(loan);
          setIsOnboardModalOpen(true);
        }}
        onUpdated={(updated) => {
          // Optional guard: if edited away from COOP, remove from list
          if (
            (updated as EmployeeLoan)?.loan_type &&
            (updated as EmployeeLoan).loan_type !== "COOP"
          ) {
            setLoans((prev) =>
              prev.filter((l) => l.loan_id !== updated.loan_id)
            );
            setTotalLoans((prev) => Math.max(0, prev - 1));
            setEditingLoan(null);
            return;
          }

          setLoans((prev) =>
            prev.map((l) => (l.loan_id === updated.loan_id ? updated : l))
          );
          setEditingLoan(null);
        }}
      />

      <OnboardPaymentModal
        isOpen={isOnboardModalOpen}
        selectedLoan={onboardingLoan}
        loans={loans}
        users={users}
        paymentsMap={paymentsMap}
        onClose={() => {
          setIsOnboardModalOpen(false);
          setOnboardingLoan(null);
          onCloseOnboardPayment?.();
        }}
        onSuccess={() => {
          loadData();
        }}
      />

      <AlertDialog open={loanToDelete !== null} onOpenChange={(open) => !open && setLoanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this loan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

export default LoansTab;
