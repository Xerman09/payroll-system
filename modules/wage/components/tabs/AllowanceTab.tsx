// @modules/wage/components/AllowanceTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, RefreshCcw, Search, X } from "lucide-react";

import type {
  Employee,
  CutoffSetting,
  EmployeeAllowanceRecord,
  AllowancePayCycle,
} from "../../types";
import { getLoggedUser } from "@/lib/auth";
import * as wageApi from "../../providers/wageApi";
import ConfirmDialog from "../ConfirmDialog";

import { toLocalYmd, round2, money } from "../../utils/loanMath";

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

  cutoffs: CutoffSetting[];
  cutoffsLoading: boolean;
  ensureCutoffs: () => void;
};

type AllowanceMode = "RECURRING" | "ONE_TIME";

type AllowanceDraft = {
  amount: string;
  description: string;

  mode: AllowanceMode;
  pay_cycle: AllowancePayCycle;

  // recurring window
  start_date: string; // YYYY-MM-DD or ""
  end_date: string; // YYYY-MM-DD or ""

  // one-time cutoff window
  cutoff_setting_id: number | null; // UI helper
  cutoff_start: string; // YYYY-MM-DD or ""
  cutoff_end: string; // YYYY-MM-DD or ""

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
  if (!logged) {
    return null;
  }
  const n = Number(logged?.user_id);
  return Number.isFinite(n) ? n : null;
}

function cutoffLabel(c: CutoffSetting) {
  const typeLabel = c.cutoff_type === "FIRST" ? "1st Cutoff" : "2nd Cutoff";
  return `${typeLabel} (${c.start_date} → ${c.end_date})`;
}

function modeBadge(mode: AllowanceMode) {
  return mode === "RECURRING" ? (
    <Badge
      variant="secondary"
      className="bg-primary text-primary-foreground hover:bg-primary/90"
    >
      Recurring
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className="bg-slate-700 text-white hover:bg-slate-700"
    >
      One-time
    </Badge>
  );
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

function processedBadge(isProcessed: unknown) {
  return flagToBool(isProcessed) ? (
    <Badge
      variant="secondary"
      className="bg-emerald-600 text-white hover:bg-emerald-600"
    >
      Processed
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className="bg-amber-500 text-white hover:bg-amber-500"
    >
      Pending
    </Badge>
  );
}

// ---------- Search + Pagination helpers ----------
function normalize(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .trim();
}

function buildAllowanceHaystack(r: EmployeeAllowanceRecord) {
  const isRecurring = flagToBool(r.is_recurring);
  const mode = isRecurring ? "recurring" : "one-time";
  const active = flagToBool(r.is_active) ? "active" : "inactive";
  const processed = flagToBool(r.is_processed)
    ? "processed"
    : "pending";

  return normalize(
    [
      r.description,
      mode,
      r.pay_cycle,
      r.amount,
      r.start_date,
      r.end_date,
      r.cutoff_start,
      r.cutoff_end,
      active,
      processed,
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

export function AllowanceTab({
  selectedEmployee,
  open,
  cutoffs,
  cutoffsLoading,
  ensureCutoffs,
}: Props) {
  // Theme tokens (match WageModal)
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
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmConfig, setConfirmConfig] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [rows, setRows] = React.useState<EmployeeAllowanceRecord[]>([]);

  const [formOpen, setFormOpen] = React.useState(false);

  // ---------- Search + Pagination state ----------
  const [q, setQ] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);

  React.useEffect(() => {
    setPage(1);
  }, [selectedEmployee, q, pageSize, open]);

  const defaultDraft = React.useCallback((): AllowanceDraft => {
    const today = toLocalYmd(new Date());
    return {
      amount: "0.00",
      description: "",

      mode: "RECURRING",
      pay_cycle: "PER_CUTOFF",

      start_date: today,
      end_date: "",

      cutoff_setting_id: null,
      cutoff_start: "",
      cutoff_end: "",

      is_active: true,
    };
  }, []);

  const [draft, setDraft] = React.useState<AllowanceDraft>(defaultDraft);

  const resetDraft = React.useCallback(() => {
    setDraft(defaultDraft());
    setEditingId(null);
  }, [defaultDraft]);

  const applyCutoffSelection = React.useCallback(
    (cutoffId: number | null) => {
      if (!cutoffId) {
        setDraft((p) => ({
          ...p,
          cutoff_setting_id: null,
          cutoff_start: "",
          cutoff_end: "",
        }));
        return;
      }

      const c = cutoffs.find((x) => x.id === cutoffId);
      if (!c) {
        setDraft((p) => ({
          ...p,
          cutoff_setting_id: null,
          cutoff_start: "",
          cutoff_end: "",
        }));
        return;
      }

      setDraft((p) => ({
        ...p,
        cutoff_setting_id: cutoffId,
        cutoff_start: c.start_date,
        cutoff_end: c.end_date,
      }));
    },
    [cutoffs]
  );

  const loadAllowances = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const list = await wageApi.fetchEmployeeAllowancesByUser(
        selectedEmployee.user_id
      );
      setRows(list);
    } catch (e: unknown) {
      console.error("[AllowanceTab] load failed", e);
      const msg = e instanceof Error ? e.message : "Failed to load employee allowances.";
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
    void loadAllowances();
  }, [open, selectedEmployee, loadAllowances, resetDraft]);

  const validateDraft = React.useCallback(() => {
    if (!selectedEmployee) return null;

    const amt = Number(draft.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Allowance amount must be greater than 0.");
      return null;
    }

    const desc = draft.description?.trim();
    if (!desc) {
      toast.error("Description is required.");
      return null;
    }

    if (draft.mode === "RECURRING") {
      if (draft.pay_cycle === "N/A") {
        toast.error("Pay cycle is required for recurring allowances.");
        return null;
      }

      if (!draft.start_date || !isYmd(draft.start_date)) {
        toast.error("Start date is required for recurring allowances.");
        return null;
      }

      if (draft.end_date) {
        if (!isYmd(draft.end_date)) {
          toast.error("End date is invalid.");
          return null;
        }
        if (draft.end_date < draft.start_date) {
          toast.error("End date cannot be earlier than start date.");
          return null;
        }
      }

      return {
        amount: round2(amt),
        description: desc,
        is_recurring: 1 as const,
        pay_cycle: draft.pay_cycle,
        start_date: draft.start_date,
        end_date: draft.end_date ? draft.end_date : null,
        cutoff_start: null,
        cutoff_end: null,
      };
    }

    // ONE_TIME
    if (!draft.cutoff_start || !draft.cutoff_end) {
      toast.error("Please select a cutoff period for one-time allowances.");
      return null;
    }
    if (!isYmd(draft.cutoff_start) || !isYmd(draft.cutoff_end)) {
      toast.error("Selected cutoff period is invalid.");
      return null;
    }
    if (draft.cutoff_start > draft.cutoff_end) {
      toast.error("Selected cutoff period is invalid.");
      return null;
    }

    return {
      amount: round2(amt),
      description: desc,
      is_recurring: 0 as const,
      pay_cycle: "N/A" as const,
      start_date: null,
      end_date: null,
      cutoff_start: draft.cutoff_start,
      cutoff_end: draft.cutoff_end,
    };
  }, [draft, selectedEmployee]);

  const saveAllowance = React.useCallback(async () => {
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
        const row = rows.find((x) => x.allowance_id === editingId);
        if (row && flagToBool(row.is_processed)) {
          toast.error("Processed allowances cannot be updated.");
          return;
        }

        await wageApi.patchEmployeeAllowance(editingId, {
          amount: v.amount,
          description: v.description,

          is_recurring: v.is_recurring,
          pay_cycle: v.pay_cycle,

          start_date: v.start_date,
          end_date: v.end_date,

          cutoff_start: v.cutoff_start,
          cutoff_end: v.cutoff_end,

          is_active: boolToFlag(!!draft.is_active),

          updated_by: loggedUserId,
        });

        toast.success("Allowance updated.");
      } else {
        await wageApi.createEmployeeAllowance({
          user_id: selectedEmployee.user_id,

          amount: v.amount,
          description: v.description,

          cutoff_start: v.cutoff_start,
          cutoff_end: v.cutoff_end,

          is_recurring: v.is_recurring,
          is_active: boolToFlag(!!draft.is_active),

          pay_cycle: v.pay_cycle,

          start_date: v.start_date,
          end_date: v.end_date,

          is_processed: 0,

          created_by: loggedUserId,
          updated_by: loggedUserId,
        });

        toast.success("Allowance added.");
      }

      resetDraft();
      setFormOpen(false);
      await loadAllowances();
    } catch (e: unknown) {
      console.error("[AllowanceTab] save failed", e);
      const msg = e instanceof Error ? e.message : "Failed to save allowance.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [
    draft.is_active,
    editingId,
    loadAllowances,
    resetDraft,
    rows,
    selectedEmployee,
    validateDraft,
  ]);

  const startEdit = React.useCallback(
    (r: EmployeeAllowanceRecord) => {
      if (flagToBool(r.is_processed)) {
        toast.error("Processed allowances cannot be edited.");
        return;
      }

      setEditingId(r.allowance_id);
      setFormOpen(true);

      const isRecurring = flagToBool(r.is_recurring);
      const mode: AllowanceMode = isRecurring ? "RECURRING" : "ONE_TIME";

      const start_date = (r.start_date || "").substring(0, 10);
      const end_date = (r.end_date || "").substring(0, 10);

      const cutoff_start = (r.cutoff_start || "").substring(0, 10);
      const cutoff_end = (r.cutoff_end || "").substring(0, 10);

      const matchedCutoff =
        cutoffs.find(
          (c) => c.start_date === cutoff_start && c.end_date === cutoff_end
        ) || null;

      setDraft({
        amount: money(r.amount),
        description: r.description ?? "",

        mode,
        pay_cycle: isRecurring ? (r.pay_cycle as AllowancePayCycle) : "N/A",

        start_date: isRecurring ? start_date || toLocalYmd(new Date()) : "",
        end_date: isRecurring ? end_date || "" : "",

        cutoff_setting_id: matchedCutoff?.id ?? null,
        cutoff_start: isRecurring ? "" : cutoff_start,
        cutoff_end: isRecurring ? "" : cutoff_end,

        is_active: flagToBool(r.is_active),
      });

      if (!isRecurring && cutoffs.length === 0 && !cutoffsLoading) {
        ensureCutoffs();
      }
    },
    [cutoffs, cutoffsLoading, ensureCutoffs]
  );

  const executeDeleteAllowance = React.useCallback(
    async (r: EmployeeAllowanceRecord) => {
      setSaving(true);
      try {
        await wageApi.deleteEmployeeAllowance(r.allowance_id);
        toast.success("Allowance deleted.");

        if (editingId === r.allowance_id) {
          resetDraft();
          setFormOpen(false);
        }

        await loadAllowances();
      } catch (e: unknown) {
        console.error("[AllowanceTab] delete failed", e);
        const msg =
          e instanceof Error ? e.message : "Failed to delete allowance.";
        toast.error(msg);
      } finally {
        setSaving(false);
      }
    },
    [editingId, loadAllowances, resetDraft],
  );

  const deleteAllowance = React.useCallback(
    async (r: EmployeeAllowanceRecord) => {
      if (flagToBool(r.is_processed)) {
        toast.error("Processed allowances cannot be deleted.");
        return;
      }

      setConfirmConfig({
        title: "Delete this allowance?",
        description: "This action cannot be undone.",
        onConfirm: () => executeDeleteAllowance(r),
      });
      setConfirmOpen(true);
    },
    [executeDeleteAllowance],
  );

  const totals = React.useMemo(() => {
    const active = rows.filter((x) => flagToBool(x.is_active));
    const totalActiveAmt = active.reduce(
      (sum, x) => sum + Number(x.amount || 0),
      0
    );
    return {
      count: rows.length,
      activeCount: active.length,
      totalActiveAmt,
    };
  }, [rows]);

  // ---------- Filter + paginate ----------
  const filteredRows = React.useMemo(() => {
    const needle = normalize(q);
    if (!needle) return rows;
    return rows.filter((r) => buildAllowanceHaystack(r).includes(needle));
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
    <div className="mt-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-m font-medium text-gray-700 dark:text-gray-200">
            Employee Allowances
          </div>
          <div className="text-xs text-gray-500">
            Manage recurring and one-time allowances (per cutoff / per month).
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Total: {totals.count} • Active: {totals.activeCount} • Active Amount
            (sum):{" "}
            <span className="font-medium">
              ₱ {money(totals.totalActiveAmt)}
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
              void loadAllowances();
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
              if (cutoffs.length === 0 && !cutoffsLoading) ensureCutoffs();
            }}
            disabled={!selectedEmployee}
          >
            <Plus className="h-4 w-4 mr-2" />
            {editingId ? "Editing Allowance" : "Add Allowance"}
          </Button>
        </div>
      </div>

      {formOpen && (
        <div className="rounded-lg border bg-gray-50 dark:bg-gray-900/30 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Mode */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Type
              </label>
              <Select
                value={draft.mode}
                onValueChange={(val: AllowanceMode) => {
                  setDraft((p) => {
                    if (val === "RECURRING") {
                      const today = toLocalYmd(new Date());
                      return {
                        ...p,
                        mode: "RECURRING",
                        pay_cycle:
                          p.pay_cycle === "N/A" ? "PER_CUTOFF" : p.pay_cycle,
                        start_date: p.start_date || today,
                        end_date: p.end_date || "",
                        cutoff_setting_id: null,
                        cutoff_start: "",
                        cutoff_end: "",
                      };
                    }
                    // ONE_TIME
                    const next = {
                      ...p,
                      mode: "ONE_TIME" as AllowanceMode,
                      pay_cycle: "N/A" as const,
                      start_date: "",
                      end_date: "",
                    };
                    if (cutoffs.length === 0 && !cutoffsLoading)
                      ensureCutoffs();
                    return next;
                  });
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECURRING">Recurring</SelectItem>
                  <SelectItem value="ONE_TIME">One-time (Cutoff)</SelectItem>
                </SelectContent>
              </Select>
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

            {/* Amount */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  ₱
                </span>
                <Input
                  type="text"
                  value={draft.amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!/^\d*\.?\d*$/.test(v)) return;
                    setDraft((p) => ({ ...p, amount: v }));
                  }}
                  onBlur={() =>
                    setDraft((p) => ({
                      ...p,
                      amount: money(p.amount),
                    }))
                  }
                  className="h-10 pl-6"
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Description
              </label>
              <Input
                type="text"
                value={draft.description}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, description: e.target.value }))
                }
                className="h-10"
                placeholder="e.g. Motor Allowance, Meals"
              />
            </div>

            {/* Recurring config */}
            {draft.mode === "RECURRING" ? (
              <>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Pay Cycle
                  </label>
                  <Select
                    value={draft.pay_cycle}
                    onValueChange={(val: AllowancePayCycle) =>
                      setDraft((p) => ({ ...p, pay_cycle: val }))
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select pay cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PER_CUTOFF">PER_CUTOFF</SelectItem>
                      <SelectItem value="PER_MONTH">PER_MONTH</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-gray-500 mt-1">
                    For recurring, prefer PER_CUTOFF or PER_MONTH.
                  </div>
                </div>

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

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Type Badge
                  </label>
                  <div className="h-10 rounded-md border bg-white/60 dark:bg-transparent px-3 flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-200">
                      This allowance repeats automatically.
                    </span>
                    {modeBadge("RECURRING")}
                  </div>
                </div>
              </>
            ) : (
              /* One-time config */
              <div className="flex flex-col col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Cutoff Period (One-time)
                </label>

                <Select
                  value={
                    draft.cutoff_setting_id
                      ? String(draft.cutoff_setting_id)
                      : ""
                  }
                  onValueChange={(val) =>
                    applyCutoffSelection(val ? Number(val) : null)
                  }
                  disabled={cutoffsLoading}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={
                        cutoffsLoading
                          ? "Loading cutoff periods..."
                          : "Select cutoff"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cutoffs.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No OPEN cutoff periods found
                      </SelectItem>
                    ) : (
                      cutoffs.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {cutoffLabel(c)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500">Cutoff Start</span>
                    <Input
                      value={draft.cutoff_start || ""}
                      disabled
                      className="h-9 bg-gray-100 dark:bg-gray-800/60"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500">Cutoff End</span>
                    <Input
                      value={draft.cutoff_end || ""}
                      disabled
                      className="h-9 bg-gray-100 dark:bg-gray-800/60"
                    />
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between rounded-md border bg-white/60 dark:bg-transparent p-3">
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      One-time allowance
                    </div>
                    <div className="text-xs text-gray-500">
                      This will apply only to the selected cutoff period.
                    </div>
                  </div>
                  {modeBadge("ONE_TIME")}
                </div>
              </div>
            )}
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
              onClick={saveAllowance}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Allowance"
                : "Save Allowance"}
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
              placeholder="Search allowances (description, type, period, amount, status)…"
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
              <TableHead className="text-gray-600 font-semibold">
                Description
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Type
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Period
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Amount
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Active
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Processed
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-12 text-center text-gray-500"
                >
                  Loading allowances...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-12 text-center text-gray-500"
                >
                  No allowances found.
                </TableCell>
              </TableRow>
            ) : totalFiltered === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-12 text-center text-gray-500"
                >
                  No results{q ? ` for "${q}"` : ""}.
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((r) => {
                const isRecurring = flagToBool(r.is_recurring);
                const mode: AllowanceMode = isRecurring
                  ? "RECURRING"
                  : "ONE_TIME";

                const period = isRecurring
                  ? `${r.pay_cycle} • ${
                      (r.start_date || "").substring(0, 10) || "—"
                    }${
                      r.end_date
                        ? ` → ${(r.end_date || "").substring(0, 10)}`
                        : ""
                    }`
                  : `${(r.cutoff_start || "").substring(0, 10) || "—"} → ${
                      (r.cutoff_end || "").substring(0, 10) || "—"
                    }`;

                return (
                  <TableRow
                    key={r.allowance_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell className="font-medium">
                      {r.description || (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>{modeBadge(mode)}</TableCell>
                    <TableCell className="text-sm text-gray-700 dark:text-gray-200">
                      {period}
                    </TableCell>
                    <TableCell>₱ {money(r.amount)}</TableCell>
                    <TableCell>
                      {activeBadge(flagToBool(r.is_active))}
                    </TableCell>
                    <TableCell>{processedBadge(r.is_processed)}</TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className={`${PAYROLL_ICON_BTN} ${PAYROLL_ICON_EDIT}`}
                          onClick={() => startEdit(r)}
                          disabled={saving || flagToBool(r.is_processed)}
                          title={
                            flagToBool(r.is_processed)
                              ? "Processed entries cannot be edited"
                              : "Edit"
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          className={`${PAYROLL_ICON_BTN} ${PAYROLL_ICON_DELETE}`}
                          onClick={() => deleteAllowance(r)}
                          disabled={saving || flagToBool(r.is_processed)}
                          title={
                            flagToBool(r.is_processed)
                              ? "Processed entries cannot be deleted"
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

      {/* Pagination (BOTTOM RIGHT) */}
      <div className="mt-3 flex items-center justify-end">
        <Pagination
          className="w-auto justify-end mx-0"
          aria-label="Allowance pagination"
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
