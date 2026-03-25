// @modules/wage/components/SavingsTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, RefreshCcw, Search, X } from "lucide-react";

import type { Employee, CoopSavingsMembershipRecord } from "../../types";
import * as wageApi from "../../providers/wageApi";
import ConfirmDialog from "../ConfirmDialog";

import { toLocalYmd, round2, money } from "../../utils/loanMath";
import { getLoggedUser } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Props = {
  selectedEmployee: Employee | null;
  open: boolean;
};

type SavingsDraft = {
  membership_id: string;
  monthly_amount: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD or ""
  total_collection: string;
  is_active: boolean;
};

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function boolToFlag(v: boolean): 0 | 1 {
  return v ? 1 : 0;
}

function flagToBool(v: unknown): boolean {
  return Number(v) === 1;
}

function getLoggedUserId(): number | null {
  const logged = getLoggedUser();
  if (!logged) return null;
  const n = Number(logged?.user_id);
  return Number.isFinite(n) ? n : null;
}

// Matches sample: COOP-20260116-67223
function generateMembershipId(d = new Date()) {
  const ymd = toLocalYmd(d).replaceAll("-", "");
  const rand5 = Math.floor(10000 + Math.random() * 90000);
  return `COOP-${ymd}-${rand5}`;
}

function activeBadge(active: boolean) {
  return active ? (
    <Badge
      variant="secondary"
      className="bg-emerald-600 text-white hover:bg-emerald-600"
    >
      Active
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className="bg-slate-500 text-white hover:bg-slate-500"
    >
      Inactive
    </Badge>
  );
}

// ---------- Search + Pagination helpers ----------
function normalize(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .trim();
}

function buildSavingsHaystack(r: CoopSavingsMembershipRecord) {
  const active = flagToBool(r.is_active) ? "active" : "inactive";

  return normalize(
    [
      r.membership_id,
      r.monthly_amount,
      r.total_collection,
      r.total_months,
      r.start_date,
      r.end_date,
      active,
    ].join(" "),
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

export function SavingsTab({ selectedEmployee, open }: Props) {
  // Theme tokens (match WageModal/AllowanceTab)
  const PAYROLL_PRIMARY =
    "bg-persian-blue-800 hover:bg-persian-blue-700 text-white";
  const PAYROLL_OUTLINE =
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 " +
    "dark:bg-transparent dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-900/40";
  const PAYROLL_ICON_BTN =
    "h-9 w-9 p-0 border border-slate-200 bg-white hover:bg-slate-50 " +
    "dark:bg-transparent dark:border-slate-700 dark:hover:bg-slate-900/40";
  const PAYROLL_ICON_EDIT = "text-persian-blue-800 hover:text-persian-blue-700";
  const PAYROLL_ICON_DELETE = "text-red-600 hover:text-red-700";

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [rows, setRows] = React.useState<CoopSavingsMembershipRecord[]>([]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmConfig, setConfirmConfig] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [q, setQ] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);

  React.useEffect(() => {
    setPage(1);
  }, [selectedEmployee, q, pageSize, open]);

  const defaultDraft = React.useCallback((): SavingsDraft => {
    return {
      membership_id: generateMembershipId(),
      monthly_amount: "0.00",
      start_date: toLocalYmd(new Date()),
      end_date: "",
      total_collection: "0.00",
      is_active: true,
    };
  }, []);

  const [draft, setDraft] = React.useState<SavingsDraft>(defaultDraft);

  const resetDraft = React.useCallback(() => {
    setDraft(defaultDraft());
    setEditingId(null);
  }, [defaultDraft]);

  const loadSavings = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const list = await wageApi.fetchCoopSavingsMembershipByUser(
        selectedEmployee.user_id,
      );
      setRows(list);
    } catch (e: unknown) {
      console.error("[SavingsTab] load failed", e);
      const msg = e instanceof Error ? e.message : "Failed to load savings memberships.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee]);

  React.useEffect(() => {
    if (!open) {
      setRows([]);
      setLoading(false);
      setSaving(false);
      setFormOpen(false);
      resetDraft();
      setQ("");
      setPage(1);
      setPageSize(10);
      return;
    }
    if (!selectedEmployee) return;
    void loadSavings();
  }, [open, selectedEmployee, loadSavings, resetDraft]);

  const validateDraft = React.useCallback(() => {
    if (!selectedEmployee) return null;

    const mem = (draft.membership_id || "").trim();
    if (!mem) {
      toast.error("Membership ID is required.");
      return null;
    }

    const amt = Number(draft.monthly_amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Monthly amount must be greater than 0.");
      return null;
    }

    if (!draft.start_date || !isYmd(draft.start_date)) {
      toast.error("Start date is required.");
      return null;
    }

    const end = (draft.end_date || "").trim();
    if (end) {
      if (!isYmd(end)) {
        toast.error("End date is invalid.");
        return null;
      }
      if (end < draft.start_date) {
        toast.error("End date cannot be earlier than start date.");
        return null;
      }
    }

    return {
      membership_id: mem,
      monthly_amount: round2(amt),
      start_date: draft.start_date,
      end_date: end ? end : null,
      is_active: boolToFlag(!!draft.is_active),
    };
  }, [draft, selectedEmployee]);

  const saveMembership = React.useCallback(async () => {
    if (!selectedEmployee) return;

    const loggedUserId = getLoggedUserId();
    if (!loggedUserId) {
      toast.error("User session missing.");
      return;
    }

    const v = validateDraft();
    if (!v) return;

    setSaving(true);
    try {
      if (editingId) {
        await wageApi.patchCoopSavingsMembership(editingId, {
          // keep membership_id stable on edit
          monthly_amount: v.monthly_amount,
          start_date: v.start_date,
          end_date: v.end_date,
          is_active: v.is_active,
          updated_by: loggedUserId,
        });

        toast.success("Savings membership updated.");
      } else {
        await wageApi.createCoopSavingsMembership({
          user_id: selectedEmployee.user_id,
          membership_id: v.membership_id,

          monthly_amount: v.monthly_amount,
          total_collection: 0,
          total_months: 0,

          start_date: v.start_date,
          end_date: v.end_date,

          is_active: v.is_active,

          created_by: loggedUserId,
          updated_by: loggedUserId,
        });

        toast.success("Savings membership added.");
      }

      resetDraft();
      setFormOpen(false);
      await loadSavings();
    } catch (e: unknown) {
      console.error("[SavingsTab] save failed", e);
      const msg = e instanceof Error ? e.message : "Failed to save savings membership.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [editingId, loadSavings, resetDraft, selectedEmployee, validateDraft]);

  const startEdit = React.useCallback((r: CoopSavingsMembershipRecord) => {
    setEditingId(r.id);
    setFormOpen(true);

    setDraft({
      membership_id: r.membership_id || "",
      monthly_amount: money(r.monthly_amount),
      start_date: (r.start_date || "").substring(0, 10),
      end_date: (r.end_date || "").substring(0, 10),
      total_collection: money(r.total_collection || 0),
      is_active: flagToBool(r.is_active),
    });
  }, []);

  const executeDeleteMembership = React.useCallback(
    async (r: CoopSavingsMembershipRecord) => {
      setSaving(true);
      try {
        await wageApi.deleteCoopSavingsMembership(r.id);
        toast.success("Savings membership deleted.");

        if (editingId === r.id) {
          resetDraft();
          setFormOpen(false);
        }

        await loadSavings();
      } catch (e: unknown) {
        console.error("[SavingsTab] delete failed", e);
        const msg =
          e instanceof Error ? e.message : "Failed to delete savings membership.";
        toast.error(msg);
      } finally {
        setSaving(false);
      }
    },
    [editingId, loadSavings, resetDraft],
  );

  const deleteMembership = React.useCallback(
    async (r: CoopSavingsMembershipRecord) => {
      const tc = Number(r.total_collection || 0);
      const tm = Number(r.total_months || 0);

      if (tc > 0 || tm > 0) {
        toast.error(
          "This membership already has collections. Set it to Inactive instead of deleting.",
        );
        return;
      }

      setConfirmConfig({
        title: "Delete this savings membership?",
        description: "This action cannot be undone.",
        onConfirm: () => executeDeleteMembership(r),
      });
      setConfirmOpen(true);
    },
    [executeDeleteMembership],
  );

  const totals = React.useMemo(() => {
    const active = rows.filter((x) => flagToBool(x.is_active));
    const totalActiveMonthly = active.reduce(
      (sum, x) => sum + Number(x.monthly_amount || 0),
      0,
    );
    return {
      count: rows.length,
      activeCount: active.length,
      totalActiveMonthly,
    };
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const needle = normalize(q);
    if (!needle) return rows;
    return rows.filter((r) => buildSavingsHaystack(r).includes(needle));
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-m font-medium text-gray-700 dark:text-gray-200">
            Coop Savings Membership
          </div>
          <div className="text-xs text-gray-500">
            Manage employee savings membership schedule (monthly amount, active
            window, status).
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Total: {totals.count} • Active: {totals.activeCount} • Active
            Monthly (sum):{" "}
            <span className="font-medium">
              ₱ {money(totals.totalActiveMonthly)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={`h-9 px-3 ${PAYROLL_OUTLINE}`}
            onClick={() => {
              if (!selectedEmployee) return;
              void loadSavings();
            }}
            disabled={!selectedEmployee || loading}
            title="Refresh"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            className={`h-9 px-4 ${PAYROLL_OUTLINE}`}
            onClick={() => {
              setFormOpen((v) => {
                const next = !v;
                if (!next) resetDraft();
                return next;
              });
            }}
            disabled={!selectedEmployee}
          >
            <Plus className="h-4 w-4 mr-2" />
            {editingId ? "Editing Membership" : "Add Membership"}
          </Button>
        </div>
      </div>

      {formOpen && (
        <div className="rounded-lg border bg-gray-50 dark:bg-gray-900/30 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Membership ID */}
            <div className="flex flex-col col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Membership ID
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={draft.membership_id}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, membership_id: e.target.value }))
                  }
                  className="h-10 font-mono"
                  disabled={!!editingId} // keep stable once created
                  placeholder="COOP-YYYYMMDD-xxxxx"
                />
                {!editingId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-10 ${PAYROLL_OUTLINE}`}
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        membership_id: generateMembershipId(new Date()),
                      }))
                    }
                    disabled={saving}
                    title="Generate"
                  >
                    Generate
                  </Button>
                ) : null}
              </div>
              {editingId ? (
                <div className="text-xs text-gray-500 mt-1">
                  Membership ID is locked after creation.
                </div>
              ) : null}
            </div>

            {/* Active */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Status
              </label>
              <div className="h-10 rounded-md border bg-white/60 dark:bg-transparent px-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={draft.is_active}
                    onCheckedChange={(checked) =>
                      setDraft((p) => ({ ...p, is_active: !!checked }))
                    }
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    Active
                  </span>
                </div>
                {activeBadge(draft.is_active)}
              </div>
            </div>

            {/* Monthly Amount */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Monthly Amount
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  ₱
                </span>
                <Input
                  type="text"
                  value={draft.monthly_amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!/^\d*\.?\d*$/.test(v)) return;
                    setDraft((p) => ({ ...p, monthly_amount: v }));
                  }}
                  onBlur={() =>
                    setDraft((p) => ({
                      ...p,
                      monthly_amount: money(p.monthly_amount),
                    }))
                  }
                  className="h-10 pl-6"
                />
              </div>
            </div>

            {/* Total Collected */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Total Collected
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  ₱
                </span>
                <Input
                  type="text"
                  value={draft.total_collection || ""}
                  disabled
                  className="h-10 pl-6 bg-gray-100 dark:bg-gray-800/60"
                  placeholder="0.00"
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Total amount collected from payroll so far
              </div>
            </div>

            {/* Start Date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={draft.start_date}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, start_date: e.target.value }))
                }
                className="h-10"
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                End Date (Optional)
              </label>
              <Input
                type="date"
                value={draft.end_date}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, end_date: e.target.value }))
                }
                className="h-10"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetDraft();
                setFormOpen(false);
              }}
              className={`h-9 ${PAYROLL_OUTLINE}`}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className={`h-9 ${PAYROLL_PRIMARY}`}
              onClick={saveMembership}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Membership"
                  : "Save Membership"}
            </Button>
          </div>
        </div>
      )}

      {/* Search + Rows */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="w-full md:max-w-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search savings (membership id, dates, amount, status)…"
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

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Membership ID
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Monthly
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Start
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">End</TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Total Collected
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Months
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs">
                Active
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-xs text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-12 text-center text-gray-500 text-sm"
                >
                  Loading savings memberships...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-12 text-center text-gray-500 text-sm"
                >
                  No savings memberships found.
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
              pagedRows.map((r) => (
                <TableRow
                  key={r.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <TableCell className="font-medium font-mono text-sm">
                    {r.membership_id || (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">₱ {money(r.monthly_amount)}</TableCell>
                  <TableCell className="text-sm text-gray-700 dark:text-gray-200">
                    {(r.start_date || "").substring(0, 10) || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700 dark:text-gray-200">
                    {(r.end_date || "").substring(0, 10) || "—"}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">₱ {money(r.total_collection)}</TableCell>
                  <TableCell className="text-sm">{Number(r.total_months || 0)}</TableCell>
                  <TableCell>{activeBadge(flagToBool(r.is_active))}</TableCell>

                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className={`${PAYROLL_ICON_BTN} ${PAYROLL_ICON_EDIT}`}
                        onClick={() => startEdit(r)}
                        disabled={saving}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        className={`${PAYROLL_ICON_BTN} ${PAYROLL_ICON_DELETE}`}
                        onClick={() => deleteMembership(r)}
                        disabled={saving}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination (BOTTOM RIGHT) */}
      <div className="mt-3 flex items-center justify-end">
        <Pagination
          className="w-auto justify-end mx-0"
          aria-label="Savings pagination"
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
              ),
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

      <div className="flex justify-end">
        <Button
          variant="outline"
          className={`rounded-md px-6 py-2 ${PAYROLL_OUTLINE}`}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Back to Top
        </Button>
      </div>

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
