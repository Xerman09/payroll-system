// @modules/wage/components/tabs/OtherADTab.tsx
"use client";

import * as React from "react";
import { Trash2, Plus, Search, X } from "lucide-react";

import type {
  Employee,
  CutoffSetting,
  PayrollOtherAdditionRecord,
  PayrollOtherDeductionRecord,
  PayrollOtherADDraft,
} from "../../types";

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

function cutoffLabel(c: CutoffSetting) {
  const typeLabel = c.cutoff_type === "FIRST" ? "1st Cutoff" : "2nd Cutoff";
  return `${typeLabel} (${c.start_date} → ${c.end_date})`;
}

type UnifiedRow =
  | { kind: "add"; row: PayrollOtherAdditionRecord }
  | { kind: "ded"; row: PayrollOtherDeductionRecord };

// ---------- Search + Pagination helpers ----------
function normalize(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .trim();
}

function buildOtherAdHaystack(u: UnifiedRow) {
  const r = u.row;
  return normalize(
    [
      u.kind === "add" ? "addition" : "deduction",
      r.description,
      r.amount,
      String(r.cutoff_start || "").substring(0, 10),
      String(r.cutoff_end || "").substring(0, 10),
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

const CutoffSelect = ({
  value,
  onChange,
  disabled,
  loading,
  cutoffs,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  loading?: boolean;
  cutoffs: CutoffSetting[];
}) => {
  return (
    <Select
      value={value ? String(value) : ""}
      onValueChange={(val) => onChange(val ? Number(val) : null)}
      disabled={disabled}
    >
      <SelectTrigger className="h-10">
        <SelectValue
          placeholder={loading ? "Loading cutoff periods..." : "Select cutoff"}
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
  );
};

export function OtherADTab({
  ui,
  selectedEmployee,

  cutoffs,
  cutoffsLoading,
  ensureCutoffs,

  // additions
  addLoading,
  addSaving,
  addRows,
  addFormOpen,
  setAddFormOpen,
  editingAddId,
  addDraft,
  setAddDraft,
  resetAddDraft,
  saveOtherAddition,
  deleteOtherAddition,

  // deductions
  dedLoading,
  dedSaving,
  dedRows,
  dedFormOpen,
  setDedFormOpen,
  editingDedId,
  dedDraft,
  setDedDraft,
  resetDedDraft,
  saveOtherDeduction,
  deleteOtherDeduction,

  // cutoff mapper
  applyCutoffToOtherDraft,
}: {
  ui: PayrollUiTokens;
  selectedEmployee: Employee | null;

  cutoffs: CutoffSetting[];
  cutoffsLoading: boolean;
  ensureCutoffs: () => void;

  addLoading: boolean;
  addSaving: boolean;
  addRows: PayrollOtherAdditionRecord[];
  addFormOpen: boolean;
  setAddFormOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  editingAddId: number | null;
  addDraft: PayrollOtherADDraft;
  setAddDraft: React.Dispatch<React.SetStateAction<PayrollOtherADDraft>>;
  resetAddDraft: () => void;
  saveOtherAddition: () => Promise<void> | void;
  startEditOtherAddition?: (r: PayrollOtherAdditionRecord) => void;
  deleteOtherAddition: (id: number) => Promise<void> | void;

  dedLoading: boolean;
  dedSaving: boolean;
  dedRows: PayrollOtherDeductionRecord[];
  dedFormOpen: boolean;
  setDedFormOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  editingDedId: number | null;
  dedDraft: PayrollOtherADDraft;
  setDedDraft: React.Dispatch<React.SetStateAction<PayrollOtherADDraft>>;
  resetDedDraft: () => void;
  saveOtherDeduction: () => Promise<void> | void;
  startEditOtherDeduction?: (r: PayrollOtherDeductionRecord) => void;
  deleteOtherDeduction: (id: number) => Promise<void> | void;

  applyCutoffToOtherDraft: (
    cutoffId: number | null,
    kind: "add" | "ded"
  ) => void;
}) {
  const formOpen = addFormOpen || dedFormOpen;
  const anySaving = addSaving || dedSaving;
  const anyLoading = addLoading || dedLoading;

  const isEditing = Boolean(editingAddId || editingDedId);

  const [formKind, setFormKind] = React.useState<"add" | "ded">("add");

  React.useEffect(() => {
    if (editingAddId) setFormKind("add");
    else if (editingDedId) setFormKind("ded");
    else if (addFormOpen) setFormKind("add");
    else if (dedFormOpen) setFormKind("ded");
  }, [editingAddId, editingDedId, addFormOpen, dedFormOpen]);

  const openForm = React.useCallback(
    (kind: "add" | "ded") => {
      // close the other form to keep UI single-form
      if (kind === "add") {
        setDedFormOpen(false);
        resetDedDraft();
        setAddFormOpen(true);
      } else {
        setAddFormOpen(false);
        resetAddDraft();
        setDedFormOpen(true);
      }

      setFormKind(kind);

      if (cutoffs.length === 0 && !cutoffsLoading) ensureCutoffs();
    },
    [
      cutoffs.length,
      cutoffsLoading,
      ensureCutoffs,
      resetAddDraft,
      resetDedDraft,
      setAddFormOpen,
      setDedFormOpen,
    ]
  );

  const closeForms = React.useCallback(() => {
    setAddFormOpen(false);
    setDedFormOpen(false);
    resetAddDraft();
    resetDedDraft();
  }, [resetAddDraft, resetDedDraft, setAddFormOpen, setDedFormOpen]);

  const mergedRows = React.useMemo<UnifiedRow[]>(() => {
    const a: UnifiedRow[] = addRows.map((row) => ({ kind: "add", row }));
    const d: UnifiedRow[] = dedRows.map((row) => ({ kind: "ded", row }));

    const safeDate = (s: string | number | null | undefined) =>
      String(s || "").substring(0, 10);

    return [...a, ...d].sort((x, y) => {
      const xs = safeDate(x.row.cutoff_start);
      const ys = safeDate(y.row.cutoff_start);
      if (xs !== ys) return ys.localeCompare(xs); // newest first
      return x.kind.localeCompare(y.kind);
    });
  }, [addRows, dedRows]);

  const draft = formKind === "add" ? addDraft : dedDraft;
  const setDraft = formKind === "add" ? setAddDraft : setDedDraft;
  const resetDraft = formKind === "add" ? resetAddDraft : resetDedDraft;
  const saveDraft = formKind === "add" ? saveOtherAddition : saveOtherDeduction;
  const activeEditingId = formKind === "add" ? editingAddId : editingDedId;

  const onTypeChange = (next: "add" | "ded") => {
    if (isEditing) return;
    if (next === formKind) return;

    // preserve typed values when switching type
    const current = draft;
    if (next === "add") setAddDraft(current);
    else setDedDraft(current);

    openForm(next);
  };

  // const startEditUnified = (u: UnifiedRow) => {
  //   if (u.kind === "add") {
  //     setFormKind("add");
  //     setDedFormOpen(false);
  //     resetDedDraft();
  //     setAddFormOpen(true);
  //     startEditOtherAddition(u.row);
  //   } else {
  //     setFormKind("ded");
  //     setAddFormOpen(false);
  //     resetAddDraft();
  //     setDedFormOpen(true);
  //     startEditOtherDeduction(u.row);
  //   }

  //   if (cutoffs.length === 0 && !cutoffsLoading) ensureCutoffs();
  // };

  const deleteUnified = (u: UnifiedRow) => {
    if (u.kind === "add") return deleteOtherAddition(u.row.id);
    return deleteOtherDeduction(u.row.id);
  };

  const typePill = (k: "add" | "ded") => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
    if (k === "add") {
      return (
        <span className={`${base} bg-emerald-100 text-emerald-700`}>
          Addition
        </span>
      );
    }
    return (
      <span className={`${base} bg-rose-100 text-rose-700`}>Deduction</span>
    );
  };

  // =========================
  // Search + Pagination (UI only)
  // =========================
  const [q, setQ] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);

  React.useEffect(() => {
    setPage(1);
  }, [q, pageSize, selectedEmployee, addRows.length, dedRows.length]);

  const filteredRows = React.useMemo(() => {
    const needle = normalize(q);
    if (!needle) return mergedRows;
    return mergedRows.filter((u) => buildOtherAdHaystack(u).includes(needle));
  }, [mergedRows, q]);

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
    if (anyLoading) return "Loading…";
    if (totalFiltered === 0) return "Showing 0–0 of 0";
    return `Showing ${pageStartIndex + 1}–${pageEndIndex} of ${totalFiltered}`;
  }, [anyLoading, totalFiltered, pageStartIndex, pageEndIndex]);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-m font-medium text-gray-700 dark:text-gray-200">
              Payroll Other Additions / Deductions
            </div>
            <div className="text-xs text-gray-500">
              These are one-off entries tied to a cutoff period.
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className={`h-9 px-4 ${ui.outline}`}
            onClick={() => {
              if (!selectedEmployee) return;
              if (formOpen) {
                closeForms();
                return;
              }
              openForm("add");
            }}
            disabled={!selectedEmployee}
          >
            <Plus className="h-4 w-4 mr-2" />
            {formOpen ? "Close" : isEditing ? "Editing" : "Add"}
          </Button>
        </div>

        {formOpen && (
          <div className="mt-4 rounded-lg border bg-gray-50 dark:bg-gray-900/30 p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Type */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Type
                </label>
                <Select
                  value={formKind}
                  onValueChange={(v) => onTypeChange(v as "add" | "ded")}
                  disabled={isEditing}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Addition</SelectItem>
                    <SelectItem value="ded">Deduction</SelectItem>
                  </SelectContent>
                </Select>
                {isEditing && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    Type cannot be changed while editing.
                  </div>
                )}
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
                      setDraft((p) => ({ ...p, amount: money(p.amount) }))
                    }
                    className="h-10 pl-6"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col col-span-2">
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
                  placeholder="Optional"
                />
              </div>

              {/* Cutoff */}
              <div className="flex flex-col col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Cutoff Period
                </label>

                <CutoffSelect
                  value={draft.cutoff_setting_id}
                  onChange={(id) => applyCutoffToOtherDraft(id, formKind)}
                  disabled={cutoffsLoading}
                  loading={cutoffsLoading}
                  cutoffs={cutoffs}
                />

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
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetDraft();
                  closeForms();
                }}
                className={`h-9 ${ui.outline}`}
                disabled={anySaving}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className={`h-9 ${ui.primary}`}
                onClick={saveDraft}
                disabled={anySaving}
              >
                {anySaving ? "Saving..." : activeEditingId ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {/* Search + Rows */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="w-full md:max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search entries (type, description, amount, cutoff)…"
                className="h-9 pl-9 pr-10"
                disabled={anyLoading || !selectedEmployee}
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
                disabled={anyLoading || !selectedEmployee}
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

        {/* Unified Table */}
        <div className="mt-3 border rounded-md overflow-hidden">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="text-gray-600 font-semibold w-[120px]">
                  Type
                </TableHead>
                <TableHead className="text-gray-600 font-semibold">
                  Description
                </TableHead>
                <TableHead className="text-gray-600 font-semibold w-[260px]">
                  Cutoff
                </TableHead>
                <TableHead className="text-gray-600 font-semibold w-[150px]">
                  Amount
                </TableHead>
                <TableHead className="text-gray-600 font-semibold w-[120px] text-right pr-4">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {anyLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-12 text-center text-gray-500"
                  >
                    Loading entries...
                  </TableCell>
                </TableRow>
              ) : mergedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-12 text-center text-gray-500"
                  >
                    No other additions/deductions found.
                  </TableCell>
                </TableRow>
              ) : totalFiltered === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-12 text-center text-gray-500"
                  >
                    No results{q ? ` for "${q}"` : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((u) => {
                  const r = u.row;
                  const start = String(r.cutoff_start || "").substring(0, 10);
                  const end = String(r.cutoff_end || "").substring(0, 10);

                  return (
                    <TableRow
                      key={`${u.kind}-${r.id}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <TableCell>{typePill(u.kind)}</TableCell>

                      <TableCell className="font-medium">
                        <div className="truncate">
                          {r.description || (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="truncate">
                          {start} → {end}
                        </div>
                      </TableCell>

                      <TableCell>₱ {money(r.amount)}</TableCell>

                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* 
                          <Button
                            type="button"
                            variant="ghost"
                            className={`${ui.iconBtn} ${ui.iconEdit} h-9 w-9 p-0 shrink-0`}
                            onClick={() => startEditUnified(u)}
                            disabled={anySaving}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          */}

                          <Button
                            type="button"
                            variant="ghost"
                            className={`${ui.iconBtn} ${ui.iconDelete} h-9 w-9 p-0 shrink-0`}
                            onClick={() => deleteUnified(u)}
                            disabled={anySaving}
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

        {/* Pagination (BOTTOM RIGHT) */}
        <div className="mt-3 flex items-center justify-end">
          <Pagination
            className="w-auto justify-end mx-0"
            aria-label="Other A/D pagination"
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
      </div>
    </div>
  );
}
