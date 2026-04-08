// @modules/wage/components/tabs/RetroPayTab.tsx
"use client";

import * as React from "react";
import { Pencil, Trash2, Plus, Search, X, MoreVertical } from "lucide-react";

import type {
  Employee,
  RetroPayRecord,
  RetroPayDraft,
  CutoffSetting,
} from "../../types";

import { money } from "../../utils/loanMath";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PayrollUiTokens = {
  primary: string;
  outline: string;
  iconBtn: string;
  iconEdit: string;
  iconDelete: string;
};

function boolToFlag(v: boolean): 0 | 1 {
  return v ? 1 : 0;
}
function flagToBool(v: unknown): boolean {
  return Number(v) === 1;
}
function cutoffLabel(c: CutoffSetting) {
  const typeLabel = c.cutoff_type === "FIRST" ? "1st Cutoff" : "2nd Cutoff";
  return `${typeLabel} (${c.start_date} → ${c.end_date})`;
}
function retroProcessedBadge(isProcessed: number | 0 | 1) {
  return Number(isProcessed) === 1 ? (
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

function normalize(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .trim();
}

function buildRetroHaystack(r: RetroPayRecord) {
  const statusLabel =
    Number(r.is_processed) === 1 ? "processed" : "pending";
  return normalize(
    [r.description, r.cutoff_start, r.cutoff_end, r.amount, statusLabel].join(
      " "
    )
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

export function RetroPayTab({
  ui,
  selectedEmployee,

  cutoffs,
  cutoffsLoading,
  ensureCutoffs,

  retroLoading,
  retroSaving,
  retroRows,

  retroFormOpen,
  setRetroFormOpen,

  retroDraft,
  setRetroDraft,

  editingRetroId,
  resetRetroDraft,

  applyCutoffSelection,
  saveRetro,
  startEditRetro,
  deleteRetro,
}: {
  ui: PayrollUiTokens;
  selectedEmployee: Employee | null;

  cutoffs: CutoffSetting[];
  cutoffsLoading: boolean;
  ensureCutoffs: () => void;

  retroLoading: boolean;
  retroSaving: boolean;
  retroRows: RetroPayRecord[];

  retroFormOpen: boolean;
  setRetroFormOpen: (v: boolean | ((p: boolean) => boolean)) => void;

  retroDraft: RetroPayDraft;
  setRetroDraft: React.Dispatch<React.SetStateAction<RetroPayDraft>>;

  editingRetroId: number | null;
  resetRetroDraft: () => void;

  applyCutoffSelection: (cutoffId: number | null) => void;

  saveRetro: () => Promise<void> | void;
  startEditRetro: (r: RetroPayRecord) => void;
  deleteRetro: (retroId: number) => Promise<void> | void;
}) {

  // ---------- Search + Pagination (client-side) ----------
  const [q, setQ] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);

  React.useEffect(() => {
    setPage(1);
  }, [selectedEmployee, q, pageSize]);

  const filteredRows = React.useMemo(() => {
    const needle = normalize(q);
    if (!needle) return retroRows;
    return retroRows.filter((r) => buildRetroHaystack(r).includes(needle));
  }, [retroRows, q]);

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
    if (retroLoading) return "Loading…";
    if (totalFiltered === 0) return "Showing 0 of 0";
    return `Showing ${pageStartIndex + 1}–${pageEndIndex} of ${totalFiltered}`;
  }, [retroLoading, totalFiltered, pageStartIndex, pageEndIndex]);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Title + Description (requested) */}
        <div className="space-y-0.5">
          <div className="text-m font-medium text-gray-700 dark:text-gray-200">
            Retro Pay
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-300">
            Adjustments per cutoff period. Track amount, cutoff range, and
            processing status.
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className={`h-9 px-4 ${ui.outline}`}
          onClick={() => {
            setRetroFormOpen((v) => {
              const next = !v;
              if (!next) resetRetroDraft();
              return next;
            });
            if (cutoffs.length === 0 && !cutoffsLoading) ensureCutoffs();
          }}
          disabled={!selectedEmployee}
        >
          <Plus className="h-4 w-4 mr-2" />
          {editingRetroId ? "Editing Entry" : "Add Retro Pay"}
        </Button>
      </div>

      {retroFormOpen && (
        <div className="rounded-lg border bg-gray-50 dark:bg-gray-900/30 p-4">
          <div className="grid grid-cols-2 gap-4">
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
                  value={retroDraft.amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!/^\d*\.?\d*$/.test(v)) return;
                    setRetroDraft((p) => ({ ...p, amount: v }));
                  }}
                  onBlur={() =>
                    setRetroDraft((p) => ({ ...p, amount: money(p.amount) }))
                  }
                  className="h-10 pl-6"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Description
              </label>
              <Input
                type="text"
                value={retroDraft.description}
                onChange={(e) =>
                  setRetroDraft((p) => ({ ...p, description: e.target.value }))
                }
                className="h-10"
                placeholder="Optional"
              />
            </div>

            <div className="flex flex-col col-span-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Cutoff Period (Select 1st or 2nd)
              </label>

              <Select
                value={
                  retroDraft.cutoff_setting_id
                    ? String(retroDraft.cutoff_setting_id)
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
                    value={retroDraft.cutoff_start || ""}
                    disabled
                    className="h-9 bg-gray-100 dark:bg-gray-800/60"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">Cutoff End</span>
                  <Input
                    value={retroDraft.cutoff_end || ""}
                    disabled
                    className="h-9 bg-gray-100 dark:bg-gray-800/60"
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-md border bg-white/60 dark:bg-transparent p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Number(retroDraft.is_processed) === 1}
                  onCheckedChange={(checked) =>
                    setRetroDraft((p) => ({
                      ...p,
                      is_processed: boolToFlag(!!checked),
                    }))
                  }
                />
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    Mark as processed
                  </div>
                  <div className="text-xs text-gray-500">
                    Recommended: keep Pending until payroll run processes it.
                  </div>
                </div>
              </div>
              <div>{retroProcessedBadge(retroDraft.is_processed)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetRetroDraft();
                setRetroFormOpen(false);
              }}
              className={`h-9 ${ui.outline}`}
              disabled={retroSaving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className={`h-9 ${ui.primary}`}
              onClick={saveRetro}
              disabled={retroSaving}
            >
              {retroSaving
                ? "Saving..."
                : editingRetroId
                ? "Update Retro Pay"
                : "Save Retro Pay"}
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
              placeholder="Search retro pay (description, cutoff, amount, status)…"
              className="h-9 pl-9 pr-10"
              disabled={retroLoading || !selectedEmployee}
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
              disabled={retroLoading || !selectedEmployee}
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
              <TableHead className="text-gray-600 font-semibold">
                Description
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Cutoff
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Amount
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Status
              </TableHead>
              <TableHead className="text-gray-600 font-semibold text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {retroLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-12 text-center text-gray-500"
                >
                  Loading retro pay...
                </TableCell>
              </TableRow>
            ) : retroRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-12 text-center text-gray-500"
                >
                  No retro pay entries found.
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
              pagedRows.map((r) => (
                <TableRow
                  key={r.retro_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <TableCell className="font-medium">
                    {r.description || <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    {(r.cutoff_start || "").substring(0, 10)} →{" "}
                    {(r.cutoff_end || "").substring(0, 10)}
                  </TableCell>
                  <TableCell>₱ {money(r.amount)}</TableCell>
                  <TableCell>{retroProcessedBadge(r.is_processed)}</TableCell>

                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={retroSaving}
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => startEditRetro(r)}
                          disabled={flagToBool(r.is_processed)}
                          title={
                            flagToBool(r.is_processed)
                              ? "Processed entries cannot be edited"
                              : "Edit"
                          }
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => deleteRetro(r.retro_id)}
                          disabled={flagToBool(r.is_processed)}
                          title={
                            flagToBool(r.is_processed)
                              ? "Processed entries cannot be deleted"
                              : "Delete"
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
          aria-label="Retro pay pagination"
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
