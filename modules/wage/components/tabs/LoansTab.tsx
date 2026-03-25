// @modules/wage/components/tabs/LoansTab.tsx
"use client";

import * as React from "react";
import { Pencil, Trash2, Plus, Search, X } from "lucide-react";

import type { Employee, EmployeeLoanRecord, LoanType } from "../../types";

import { money } from "../../utils/loanMath";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type PayrollUiTokens = {
  primary: string;
  outline: string;
  iconBtn: string;
  iconEdit: string;
  iconDelete: string;
};

type LoanDraft = {
  loan_type: LoanType;
  loan_amount: string;
  months_to_pay: string;
  monthly_payment: string;

  start_date: string;
  end_date: string;

  interest_rate: string;
  interest_amount: string;
  net_amount_released: string;

  accumulated_amount: string;

  status: string;
};

function statusPill(statusRaw: string | undefined | null) {
  const s = String(statusRaw ?? "").trim();
  const u = s.toUpperCase();

  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";

  if (u === "ACTIVE") {
    return {
      label: "ACTIVE",
      className:
        `${base} ` +
        "border-emerald-200 bg-emerald-50 text-emerald-700 " +
        "dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
      dot: "bg-emerald-500",
    };
  }

  if (u === "PENDING") {
    return {
      label: "PENDING",
      className:
        `${base} ` +
        "border-amber-200 bg-amber-50 text-amber-800 " +
        "dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
      dot: "bg-amber-500",
    };
  }

  if (u === "COMPLETED" || u === "PAID" || u === "DONE") {
    return {
      label: u === "PAID" ? "PAID" : "COMPLETED",
      className:
        `${base} ` +
        "border-sky-200 bg-sky-50 text-sky-800 " +
        "dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300",
      dot: "bg-sky-500",
    };
  }

  if (u === "CANCELLED" || u === "CANCELED" || u === "INACTIVE") {
    return {
      label: u === "INACTIVE" ? "INACTIVE" : "CANCELLED",
      className:
        `${base} ` +
        "border-rose-200 bg-rose-50 text-rose-800 " +
        "dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300",
      dot: "bg-rose-500",
    };
  }

  return {
    label: s || "—",
    className:
      `${base} ` +
      "border-slate-200 bg-slate-50 text-slate-700 " +
      "dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200",
    dot: "bg-slate-400",
  };
}

function normalize(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .trim();
}

function buildLoanHaystack(l: EmployeeLoanRecord) {
  const status = l.status ?? "";
  return normalize(
    [
      l.loan_type,
      l.loan_amount,
      l.monthly_payment,
      l.months_to_pay,
      l.interest_rate,
      l.interest_amount,
      l.net_amount_released,
      l.start_date,
      status,
    ].join(" ")
  );
}

function getPageItems(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: Array<number | "ellipsis"> = [];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  items.push(1);

  if (left > 2) items.push("ellipsis");

  for (let p = left; p <= right; p++) items.push(p);

  if (right < totalPages - 1) items.push("ellipsis");

  items.push(totalPages);

  return items;
}

export function LoansTab({
  ui,
  selectedEmployee,

  loanPanelOpen,
  setLoanPanelOpen,

  loanDraft,
  setLoanDraft,
  recomputeLoanDraft,

  editingLoanId,
  resetLoanDraft,

  loanSaving,
  loanLoading,

  saveLoan,
  loans,
  startEditLoan,
  deleteLoan,
}: {
  ui: PayrollUiTokens;
  selectedEmployee: Employee | null;

  loanPanelOpen: boolean;
  setLoanPanelOpen: (v: boolean | ((p: boolean) => boolean)) => void;

  loanDraft: LoanDraft;
  setLoanDraft: React.Dispatch<React.SetStateAction<LoanDraft>>;
  recomputeLoanDraft: (d: LoanDraft) => LoanDraft;

  editingLoanId: number | null;
  resetLoanDraft: () => void;

  loanSaving: boolean;
  loanLoading: boolean;

  saveLoan: () => Promise<void> | void;
  loans: EmployeeLoanRecord[];
  startEditLoan: (l: EmployeeLoanRecord) => void;
  deleteLoan: (loanId: number) => Promise<void> | void;
}) {
  // ---------- Search + Pagination (client-side) ----------
  const [q, setQ] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);

  React.useEffect(() => {
    setPage(1);
  }, [selectedEmployee, q, pageSize]);

  const filteredLoans = React.useMemo(() => {
    const needle = normalize(q);
    if (!needle) return loans;
    return loans.filter((l) => buildLoanHaystack(l).includes(needle));
  }, [loans, q]);

  const totalFiltered = filteredLoans.length;

  const totalPages = React.useMemo(() => {
    const n = Math.ceil(totalFiltered / Math.max(1, pageSize));
    return Math.max(1, n);
  }, [totalFiltered, pageSize]);

  const currentPage = Math.min(Math.max(1, page), totalPages);

  React.useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, totalFiltered);

  const pagedLoans = React.useMemo(() => {
    return filteredLoans.slice(pageStartIndex, pageEndIndex);
  }, [filteredLoans, pageStartIndex, pageEndIndex]);

  const pageItems = React.useMemo(() => {
    return getPageItems(totalPages, currentPage);
  }, [totalPages, currentPage]);

  const showingLabel = React.useMemo(() => {
    if (loanLoading) return "Loading…";
    if (totalFiltered === 0) return "Showing 0 of 0";
    return `Showing ${pageStartIndex + 1}–${pageEndIndex} of ${totalFiltered}`;
  }, [loanLoading, totalFiltered, pageStartIndex, pageEndIndex]);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Title + Description (requested) */}
        <div className="space-y-0.5">
          <div className="text-m font-medium text-gray-700 dark:text-gray-200">
            Loans
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-300">
            Track employee loans, monthly amortization, and status. Use search
            and pagination to quickly locate records.
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className={`h-9 px-4 ${ui.outline}`}
          onClick={() => {
            setLoanPanelOpen((v) => {
              const next = !v;
              if (!next) resetLoanDraft();
              return next;
            });
          }}
          disabled={!selectedEmployee}
        >
          <Plus className="h-4 w-4 mr-2" />
          {editingLoanId ? "Editing Loan" : "Add Loan"}
        </Button>
      </div>

      {loanPanelOpen && (
        <div className="rounded-lg border bg-gray-50 dark:bg-gray-900/30 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Loan Type
              </label>
              <Select
                value={loanDraft.loan_type}
                onValueChange={(val) => {
                  setLoanDraft((p) =>
                    recomputeLoanDraft({ ...p, loan_type: val as LoanType })
                  );
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VALE">VALE</SelectItem>
                  <SelectItem value="CAR LOAN">Car Loan</SelectItem>
                  <SelectItem value="COOP">COOP</SelectItem>
                </SelectContent>
              </Select>

              {loanDraft.loan_type === "COOP" && (
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  COOP loans auto-compute 3% interest and net amount released.
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Loan Amount
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  ₱
                </span>
                <Input
                  type="text"
                  value={loanDraft.loan_amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!/^\d*\.?\d*$/.test(v)) return;
                    setLoanDraft((p) =>
                      recomputeLoanDraft({ ...p, loan_amount: v })
                    );
                  }}
                  onBlur={() => {
                    setLoanDraft((p) =>
                      recomputeLoanDraft({
                        ...p,
                        loan_amount: money(p.loan_amount),
                      })
                    );
                  }}
                  className="h-10 pl-6"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Months to Pay
              </label>
              <Input
                type="number"
                min={1}
                value={loanDraft.months_to_pay}
                onChange={(e) => {
                  const raw = e.target.value;
                  setLoanDraft((p) =>
                    recomputeLoanDraft({ ...p, months_to_pay: raw })
                  );
                }}
                onBlur={() => {
                  setLoanDraft((p) => {
                    const months = Number(p.months_to_pay);
                    const normalized =
                      Number.isInteger(months) && months > 0
                        ? String(months)
                        : "1";
                    return recomputeLoanDraft({
                      ...p,
                      months_to_pay: normalized,
                    });
                  });
                }}
                className="h-10"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Monthly Payment (Auto)
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  ₱
                </span>
                <Input
                  type="text"
                  value={loanDraft.monthly_payment}
                  disabled
                  className="h-10 pl-6 bg-gray-100 dark:bg-gray-800/60"
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Auto-calculated: Loan Amount ÷ Months to Pay
              </div>
            </div>

            {loanDraft.loan_type === "COOP" && (
              <>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={loanDraft.start_date}
                    onChange={(e) =>
                      setLoanDraft((p) => ({
                        ...p,
                        start_date: e.target.value,
                      }))
                    }
                    className="h-10"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Interest (3%) — Auto
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={`${money(loanDraft.interest_rate)}%`}
                      disabled
                      className="h-10 bg-gray-100 dark:bg-gray-800/60"
                    />
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                        ₱
                      </span>
                      <Input
                        type="text"
                        value={loanDraft.interest_amount}
                        disabled
                        className="h-10 pl-6 bg-gray-100 dark:bg-gray-800/60"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Interest Amount = Loan Amount × 3%
                  </div>
                </div>

                <div className="flex flex-col col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Net Amount Released (Auto)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                      ₱
                    </span>
                    <Input
                      type="text"
                      value={loanDraft.net_amount_released}
                      disabled
                      className="h-10 pl-6 bg-gray-100 dark:bg-gray-800/60"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Net Amount Released = Loan Amount − Interest Amount
                  </div>
                </div>

                <div className="flex flex-col col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Accumulated Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                      ₱
                    </span>
                    <Input
                      type="text"
                      value={loanDraft.accumulated_amount || ""}
                      disabled
                      className="h-10 pl-6 bg-gray-100 dark:bg-gray-800/60"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total amount deducted from payroll so far
                  </div>
                </div>
              </>
            )}

            {loanDraft.loan_type !== "COOP" && (
              <div className="flex flex-col col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Accumulated Amount
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                    ₱
                  </span>
                <Input
                  type="text"
                  value={loanDraft.accumulated_amount || ""}
                  disabled
                  className="h-10 pl-6 bg-gray-100 dark:bg-gray-800/60"
                  placeholder="0.00"
                />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Total amount deducted from payroll so far
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetLoanDraft();
                setLoanPanelOpen(false);
              }}
              className={`h-9 ${ui.outline}`}
              disabled={loanSaving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className={`h-9 ${ui.primary}`}
              onClick={saveLoan}
              disabled={loanSaving}
            >
              {loanSaving
                ? "Saving..."
                : editingLoanId
                ? "Update Loan"
                : "Save Loan"}
            </Button>
          </div>
        </div>
      )}

      {/* Search + Page Size Controls */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="w-full md:max-w-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search loans (type, status, date, amount, months)…"
              className="h-9 pl-9 pr-10"
              disabled={loanLoading || !selectedEmployee}
            />
            {q ? (
              <Button
                type="button"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setQ("")}
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {showingLabel}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Rows
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                const next = Number(val);
                setPageSize(Number.isFinite(next) && next > 0 ? next : 10);
              }}
              disabled={loanLoading || !selectedEmployee}
            >
              <SelectTrigger className="h-9 w-[92px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-3 border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Type
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Amount
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Months
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">Net</TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Accumulated
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Start
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Status
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loanLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-12 text-center text-gray-500 text-sm"
                >
                  Loading loans...
                </TableCell>
              </TableRow>
            ) : loans.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-12 text-center text-gray-500 text-sm"
                >
                  No loans found.
                </TableCell>
              </TableRow>
            ) : totalFiltered === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-12 text-center text-gray-500 text-sm"
                >
                  No results{q ? ` for "${q}"` : ""}.
                </TableCell>
              </TableRow>
            ) : (
              pagedLoans.map((l) => {
                const s = String(l.status ?? "").toUpperCase();
                const isPaid = s === "PAID" || s === "COMPLETED" || s === "DONE";

                return (
                  <TableRow
                    key={l.loan_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell className="font-medium text-sm">{l.loan_type}</TableCell>
                    <TableCell className="text-sm">₱ {money(l.loan_amount)}</TableCell>
                    <TableCell className="text-sm">{l.months_to_pay}</TableCell>
                    <TableCell className="text-sm">
                      {Number(l.net_amount_released || 0) > 0
                        ? `₱ ${money(l.net_amount_released)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      ₱ {money(l.accumulated_amount || 0)}
                    </TableCell>
                    <TableCell className="text-sm">{(l.start_date || "").substring(0, 10)}</TableCell>

                    <TableCell>
                      {(() => {
                        const p = statusPill(l.status);
                        return (
                          <span className={p.className}>
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${p.dot}`}
                            />
                            {p.label}
                          </span>
                        );
                      })()}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className={`${ui.iconBtn} ${ui.iconEdit}`}
                          onClick={() => startEditLoan(l)}
                          disabled={loanSaving || isPaid}
                          title={
                            isPaid
                              ? "This loan is already paid and cannot be edited."
                              : "Edit"
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          className={`${ui.iconBtn} ${ui.iconDelete}`}
                          onClick={() => deleteLoan(l.loan_id)}
                          disabled={loanSaving || isPaid}
                          title={
                            isPaid
                              ? "This loan is already paid and cannot be deleted."
                              : "Delete"
                          }
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

      {/* Pagination (BOTTOM RIGHT CORNER) */}
      <div className="mt-3 flex justify-end items-center">
        <Pagination
          className="ml-auto w-auto  mx-0"
          aria-label="Loans pagination"
        >
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={!canPrev}
                className={!canPrev ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  if (!canPrev) return;
                  setPage((p) => Math.max(1, p - 1));
                }}
              />
            </PaginationItem>

            {pageItems.map((it, idx) =>
              it === "ellipsis" ? (
                <PaginationItem key={`e-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={it}>
                  <PaginationLink
                    href="#"
                    isActive={it === currentPage}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(it);
                    }}
                  >
                    {it}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={!canNext}
                className={!canNext ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  if (!canNext) return;
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </>
  );
}
