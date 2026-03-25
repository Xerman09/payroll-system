// modules/wage/components/tabs/StockPurchaseTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { getLoggedUser } from "@/lib/auth";

import type {
  Employee,
  CutoffSetting,
  DRPaymentRecord,
  DRPaymentDraft,
  DRPaymentMethod,
} from "../../types";
import * as wageApi from "../../providers/wageApi";
import ConfirmDialog from "../ConfirmDialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { money, round2, toLocalYmd } from "../../utils/loanMath";

type Props = {
  open: boolean;
  selectedEmployee: Employee | null;
  cutoffs: CutoffSetting[];
  cutoffsLoading: boolean;
  ensureCutoffs: () => void;
};

const METHODS: { value: DRPaymentMethod; label: string }[] = [
  { value: "PAYROLL_DEDUCTION", label: "Payroll Deduction" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHERS", label: "Others" },
];

function methodLabel(v: unknown) {
  const s = String(v || "PAYROLL_DEDUCTION") as DRPaymentMethod;
  return METHODS.find((m) => m.value === s)?.label ?? s;
}

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function getLoggedUserId(): number | null {
  const logged = getLoggedUser();
  if (!logged) return null;
  const n = Number(logged?.user_id);
  return Number.isFinite(n) ? n : null;
}

function normalize(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .trim();
}

function buildHaystack(r: DRPaymentRecord) {
  const cutoffFrom = (r.cutoff_from || "").substring(0, 10);
  const cutoffTo = (r.cutoff_to || "").substring(0, 10);
  const payDate = (r.payment_date || "").substring(0, 10);
  const postedLabel =
    Number(r.is_posted_to_payroll) === 1 ? "posted yes" : "posted no";

  return normalize(
    [
      r.delivery_receipt_number,
      cutoffFrom,
      cutoffTo,
      payDate,
      money(r.amount_paid),
      methodLabel(r.payment_method),
      r.payroll_ref_no ?? "",
      r.remarks ?? "",
      postedLabel,
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

export function StockPurchaseTab({
  open,
  selectedEmployee,
  cutoffs,
  cutoffsLoading,
  ensureCutoffs,
}: Props) {
  const [rows, setRows] = React.useState<DRPaymentRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmConfig, setConfirmConfig] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // Search + Pagination (RetroPay style)
  const [q, setQ] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);

  const defaultDraft = React.useCallback((): DRPaymentDraft => {
    const today = toLocalYmd(new Date());
    return {
      delivery_receipt_number: "",
      cutoff_setting_id: null,
      cutoff_from: "",
      cutoff_to: "",
      payment_date: today,
      amount_paid: "0.00",
      payment_method: "PAYROLL_DEDUCTION",
      payroll_ref_no: "",
      is_posted_to_payroll: 0,
      remarks: "",
    };
  }, []);

  const [draft, setDraft] = React.useState<DRPaymentDraft>(defaultDraft);

  const resetDraft = React.useCallback(() => {
    setDraft(defaultDraft());
    setEditingId(null);
  }, [defaultDraft]);

  const load = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const data = await wageApi.fetchDRPaymentsByEmployee(
        selectedEmployee.user_id
      );
      setRows(data);
      setPage(1);
    } catch (e: unknown) {
      console.error("[StockPurchaseTab] load failed", e);
      const loadMsg = e instanceof Error ? e.message : "Failed to load DR payments.";
      toast.error(loadMsg);
      setRows([]);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee]);

  React.useEffect(() => {
    if (!open) return;
    if (!selectedEmployee) return;
    void load();
  }, [open, selectedEmployee, load]);

  React.useEffect(() => {
    setPage(1);
  }, [selectedEmployee, q, pageSize]);

  const filteredRows = React.useMemo(() => {
    const needle = normalize(q);
    if (!needle) return rows;
    return rows.filter((r) => buildHaystack(r).includes(needle));
  }, [rows, q]);

  const totalFiltered = filteredRows.length;

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

  const pagedRows = React.useMemo(() => {
    return filteredRows.slice(pageStartIndex, pageEndIndex);
  }, [filteredRows, pageStartIndex, pageEndIndex]);

  const pageItems = React.useMemo(() => {
    return getPageItems(totalPages, currentPage);
  }, [totalPages, currentPage]);

  const showingLabel = React.useMemo(() => {
    if (loading) return "Loading…";
    if (totalFiltered === 0) return "Showing 0 of 0";
    return `Showing ${pageStartIndex + 1}–${pageEndIndex} of ${totalFiltered}`;
  }, [loading, totalFiltered, pageStartIndex, pageEndIndex]);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  const applyCutoffSelection = React.useCallback(
    (cutoffId: number | null) => {
      if (!cutoffId) {
        setDraft((p) => ({
          ...p,
          cutoff_setting_id: null,
          cutoff_from: "",
          cutoff_to: "",
        }));
        return;
      }

      const c = cutoffs.find((x) => x.id === cutoffId);
      if (!c) return;

      setDraft((p) => ({
        ...p,
        cutoff_setting_id: cutoffId,
        cutoff_from: c.start_date,
        cutoff_to: c.end_date,
      }));
    },
    [cutoffs]
  );

  const openAdd = React.useCallback(() => {
    ensureCutoffs();
    resetDraft();
    setFormOpen(true);
  }, [ensureCutoffs, resetDraft]);

  const startEdit = React.useCallback(
    (r: DRPaymentRecord) => {
      const isPosted = Number(r.is_posted_to_payroll) === 1;
      if (isPosted) {
        toast.error("Posted entries are locked.");
        return;
      }

      ensureCutoffs();

      const cf = (r.cutoff_from || "").substring(0, 10);
      const ct = (r.cutoff_to || "").substring(0, 10);

      const matched =
        cutoffs.find((c) => c.start_date === cf && c.end_date === ct) || null;

      setEditingId(r.dr_payment_id);
      setDraft({
        delivery_receipt_number: r.delivery_receipt_number ?? "",
        cutoff_setting_id: matched?.id ?? null,
        cutoff_from: cf,
        cutoff_to: ct,
        payment_date:
          (r.payment_date || "").substring(0, 10) || toLocalYmd(new Date()),
        amount_paid: money(r.amount_paid),
        payment_method:
          (r.payment_method as DRPaymentMethod) || "PAYROLL_DEDUCTION",
        payroll_ref_no: r.payroll_ref_no ?? "",
        is_posted_to_payroll: Number(r.is_posted_to_payroll) === 1 ? 1 : 0,
        remarks: r.remarks ?? "",
      });

      setFormOpen(true);
    },
    [cutoffs, ensureCutoffs]
  );

  const validate = React.useCallback(() => {
    const drNo = draft.delivery_receipt_number.trim();
    if (!drNo) return "Delivery Receipt Number is required.";

    if (!isYmd(draft.cutoff_from) || !isYmd(draft.cutoff_to)) {
      return "Cutoff From/To are required.";
    }
    if (draft.cutoff_from > draft.cutoff_to) return "Cutoff range is invalid.";

    if (!isYmd(draft.payment_date)) return "Payment date is required.";

    const amt = Number(String(draft.amount_paid || "0").replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) return "Amount must be > 0.";

    return null;
  }, [draft]);

  const save = React.useCallback(async () => {
    if (!selectedEmployee) return;

    const loggedUserId = getLoggedUserId();
    if (!loggedUserId) {
      toast.error("User session missing.");
      return;
    }

    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const amt = round2(Number(String(draft.amount_paid).replace(/,/g, "")));

    setSaving(true);
    try {
      const payloadBase = {
        delivery_receipt_number: draft.delivery_receipt_number.trim(),
        cutoff_from: draft.cutoff_from,
        cutoff_to: draft.cutoff_to,
        payment_date: draft.payment_date,
        amount_paid: amt,
        payment_method: draft.payment_method,
        payroll_ref_no: draft.payroll_ref_no.trim() || null,
        is_posted_to_payroll: draft.is_posted_to_payroll,
        remarks: draft.remarks.trim() || null,
      };

      if (editingId) {
        await wageApi.patchDRPayment(editingId, payloadBase);
        toast.success("DR payment updated.");
      } else {
        await wageApi.createDRPayment({
          ...payloadBase,
          employee_id: selectedEmployee.user_id,
          created_by: loggedUserId,
        });
        toast.success("DR payment added.");
      }

      setFormOpen(false);
      resetDraft();
      await load();
    } catch (e: unknown) {
      console.error("[StockPurchaseTab] save failed", e);
      const saveMsg = e instanceof Error ? e.message : "Failed to save DR payment.";
      toast.error(saveMsg);
    } finally {
      setSaving(false);
    }
  }, [draft, editingId, load, resetDraft, selectedEmployee, validate]);

  const executeRemove = React.useCallback(
    async (r: DRPaymentRecord) => {
      setSaving(true);
      try {
        await wageApi.deleteDRPayment(r.dr_payment_id);
        toast.success("DR payment deleted.");
        await load();
      } catch (e: unknown) {
        console.error("[StockPurchaseTab] delete failed", e);
        const delMsg =
          e instanceof Error ? e.message : "Failed to delete DR payment.";
        toast.error(delMsg);
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const remove = React.useCallback(
    async (r: DRPaymentRecord) => {
      const isPosted = Number(r.is_posted_to_payroll) === 1;
      if (isPosted) {
        toast.error("Posted entries cannot be deleted.");
        return;
      }

      setConfirmConfig({
        title: "Delete this DR payment entry?",
        description: "This cannot be undone.",
        onConfirm: () => executeRemove(r),
      });
      setConfirmOpen(true);
    },
    [executeRemove],
  );

  return (
    <div className="space-y-4">
      {/* ---------- Title row (match RetroPayTab placement) ---------- */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <div className="text-m font-medium text-gray-700 dark:text-gray-200">
                Stock Purchase (DR Payment)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-300">
                Track employee DR payments (payroll deduction/cash/check/etc.).
              </div>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-9 px-4"
          onClick={openAdd}
          disabled={!selectedEmployee || saving}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add DR Payment
        </Button>
      </div>

      {/* ---------- Search + Page Size Controls (match RetroPayTab) ---------- */}
      <div className="mt-1 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="w-full md:max-w-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search DR payment (DR no, cutoff, date, method, ref)…"
              className="h-9 pl-9 pr-10"
              disabled={loading || !selectedEmployee}
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
              disabled={loading || !selectedEmployee}
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

      {/* ---------- Table (match RetroPayTab colors + spacing) ---------- */}
      <div className="mt-3 border rounded-md overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow className="[&>th]:px-2 [&>th]:py-2">
              <TableHead className="text-gray-600 font-semibold w-[14%]">
                DR No
              </TableHead>
              <TableHead className="text-gray-600 font-semibold w-[18%]">
                Cutoff
              </TableHead>
              <TableHead className="text-gray-600 font-semibold w-[10%]">
                Pay Date
              </TableHead>
              <TableHead className="text-gray-600 font-semibold w-[10%] text-right">
                Amount
              </TableHead>
              <TableHead className="text-gray-600 font-semibold w-[16%]">
                Method
              </TableHead>
              <TableHead className="text-gray-600 font-semibold w-[12%]">
                Payroll Ref
              </TableHead>
              <TableHead className="text-gray-600 font-semibold w-[6%] text-center">
                Posted
              </TableHead>
              <TableHead className="text-gray-600 font-semibold w-[6%] text-right pr-2">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-12 text-center text-gray-500"
                >
                  Loading DR payments...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-12 text-center text-gray-500"
                >
                  No DR payment entries found.
                </TableCell>
              </TableRow>
            ) : totalFiltered === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-12 text-center text-gray-500"
                >
                  No results{q ? ` for "${q}"` : ""}.
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((r) => {
                const isPosted = Number(r.is_posted_to_payroll) === 1;
                const cutoffFrom = (r.cutoff_from || "").substring(0, 10);
                const cutoffTo = (r.cutoff_to || "").substring(0, 10);
                const payDate = (r.payment_date || "").substring(0, 10);

                return (
                  <TableRow
                    key={r.dr_payment_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 [&>td]:px-2 [&>td]:py-2"
                  >
                    <TableCell className="text-xs font-medium break-words">
                      {r.delivery_receipt_number}
                    </TableCell>

                    <TableCell className="text-xs text-slate-700 dark:text-slate-200 break-words">
                      <div className="leading-4">
                        <div>{cutoffFrom}</div>
                        <div className="text-slate-500 dark:text-slate-400">
                          to {cutoffTo}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      {payDate || "—"}
                    </TableCell>

                    <TableCell className="text-right text-xs font-semibold whitespace-nowrap">
                      ₱ {money(r.amount_paid)}
                    </TableCell>

                    <TableCell className="text-xs break-words">
                      {methodLabel(r.payment_method)}
                    </TableCell>

                    <TableCell className="text-xs break-words">
                      {r.payroll_ref_no || (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      {isPosted ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-600">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                          No
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right px-1 pr-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={saving}
                            title="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => startEdit(r)}
                            disabled={saving || isPosted}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => void remove(r)}
                            disabled={saving || isPosted}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>

                          {isPosted && (
                            <>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400">
                                Posted entries are locked.
                              </div>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---------- Pagination (BOTTOM RIGHT — match RetroPayTab) ---------- */}
      <div className="mt-3 flex items-center justify-end">
        <Pagination
          className="w-auto justify-end mx-0"
          aria-label="DR payment pagination"
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

      {/* ---------- Form Dialog (kept same, only minor spacing consistency) ---------- */}
      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          if (!v) {
            setFormOpen(false);
            resetDraft();
          } else {
            setFormOpen(true);
            ensureCutoffs();
          }
        }}
      >
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit DR Payment" : "Add DR Payment"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Delivery Receipt Number</Label>
              <Input
                value={draft.delivery_receipt_number}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    delivery_receipt_number: e.target.value,
                  }))
                }
                placeholder="e.g. DR-000123"
              />
            </div>

            <div className="grid gap-2">
              <Label>Cutoff Period</Label>
              <Select
                value={
                  draft.cutoff_setting_id
                    ? String(draft.cutoff_setting_id)
                    : "none"
                }
                onValueChange={(v) =>
                  applyCutoffSelection(v === "none" ? null : Number(v))
                }
                disabled={cutoffsLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      cutoffsLoading ? "Loading cutoffs…" : "Select cutoff"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Custom (manual dates)</SelectItem>
                  {cutoffs.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.cutoff_type} — {c.start_date} to {c.end_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Cutoff From</Label>
                  <Input
                    type="date"
                    value={draft.cutoff_from}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, cutoff_from: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cutoff To</Label>
                  <Input
                    type="date"
                    value={draft.cutoff_to}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, cutoff_to: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={draft.payment_date}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, payment_date: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label>Amount Paid</Label>
                <Input
                  value={draft.amount_paid}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, amount_paid: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <Select
                  value={draft.payment_method}
                  onValueChange={(v) =>
                    setDraft((p) => ({
                      ...p,
                      payment_method: v as DRPaymentMethod,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Payroll Ref No (optional)</Label>
                <Input
                  value={draft.payroll_ref_no}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, payroll_ref_no: e.target.value }))
                  }
                  placeholder="e.g. PR-2026-0001"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border bg-white/60 dark:bg-transparent p-3">
              <Checkbox
                checked={draft.is_posted_to_payroll === 1}
                onCheckedChange={(v) =>
                  setDraft((p) => ({
                    ...p,
                    is_posted_to_payroll: v ? 1 : 0,
                  }))
                }
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  Posted to Payroll
                </div>
                <div className="text-xs text-gray-500">
                  Posted entries are locked for edit/delete.
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Remarks (optional)</Label>
              <Textarea
                value={draft.remarks}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, remarks: e.target.value }))
                }
                placeholder="Notes…"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                resetDraft();
              }}
              disabled={saving}
              className="h-9"
            >
              Cancel
            </Button>

            <Button
              type="button"
              className="h-9 bg-persian-blue-800 hover:bg-persian-blue-700 text-white"
              onClick={save}
              disabled={saving || !selectedEmployee}
            >
              {saving ? "Saving…" : editingId ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ConfirmDialog */}
      {confirmConfig && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmConfig.title}
          description={confirmConfig.description}
          onConfirm={confirmConfig.onConfirm}
          variant="destructive"
        />
      )}
    </div>
  );
}
