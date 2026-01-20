// modules/wage/components/tabs/BenefitsTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, RefreshCcw, Pencil, Trash2, Search, X } from "lucide-react";

import type {
  Employee,
  WageDataState,
  CutoffSetting,
  BenefitLoanRecord,
  BenefitCode,
  DeductOn,
  BenefitLoanStatus,
} from "../../types";
import * as wageApi from "../../providers/wageApi";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  open: boolean;
  selectedEmployee: Employee | null;

  wageData: WageDataState;
  setWageData: (upd: Partial<WageDataState>) => void;

  cutoffs: CutoffSetting[];
  cutoffsLoading: boolean;
  ensureCutoffs: () => void;
};

type Draft = {
  benefit_code: BenefitCode | "";
  loan_name: string;
  reference_no: string;

  principal_amount: string;

  terms_installments: string; // int
  deduct_on: DeductOn;
  start_cutoff_id: string; // int

  status: BenefitLoanStatus;
  remarks: string;
};

function money(n: any) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNum(v: unknown) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v as any);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoneyPlain(v: unknown) {
  return round2(toNum(v)).toFixed(2);
}

function toIntSafe(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function getLoggedUserId(): number | null {
  const session = sessionStorage.getItem("user");
  if (!session) return null;
  try {
    const logged = JSON.parse(session);
    const n = Number(logged?.user_id);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function cutoffLabel(c: CutoffSetting) {
  const t = c.cutoff_type === "FIRST" ? "1st" : "2nd";
  return `${t} • ${c.start_date} → ${c.end_date} (ID:${c.id})`;
}

// Compact cutoff range like: 2026-01-11–25
function formatCutoffRange(start?: string | null, end?: string | null) {
  const s = (start || "").trim();
  const e = (end || "").trim();
  if (!s || !e) return "—";

  const sYm = s.slice(0, 7);
  const eYm = e.slice(0, 7);

  if (sYm === eYm) {
    const endDay = e.slice(8, 10);
    return `${s}–${endDay}`;
  }

  const sY = s.slice(0, 4);
  const eY = e.slice(0, 4);
  if (sY === eY) {
    return `${s}–${e.slice(5)}`;
  }

  return `${s}–${e}`;
}

function statusBadge(s: BenefitLoanStatus) {
  if (s === "ACTIVE") {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        ACTIVE
      </Badge>
    );
  }
  if (s === "CLOSED") {
    return (
      <Badge className="bg-slate-700 text-white hover:bg-slate-700">
        CLOSED
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-600 text-white hover:bg-red-600">CANCELLED</Badge>
  );
}

// ---------- Search + Pagination helpers ----------
function normalize(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .trim();
}

function buildLoanHaystack(r: BenefitLoanRecord) {
  return normalize(
    [
      r.benefit_code,
      r.loan_name,
      r.reference_no,
      r.total_payable,
      r.amortization_amount,
      r.terms_installments,
      r.deduct_on,
      r.start_cutoff_id,
      r.remaining_balance,
      r.status,
      r.remarks,
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

export function BenefitsTab({
  open,
  selectedEmployee,
  wageData,
  setWageData,
  cutoffs,
  cutoffsLoading,
  ensureCutoffs,
}: Props) {
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

  // =========================
  // Section 1: Contributions
  // =========================
  const onMoneyChange =
    (key: "sss" | "pagibig" | "philhealth") => (v: string) => {
      if (!/^\d*\.?\d*$/.test(v)) return;
      setWageData({ [key]: v } as any);
    };

  const onMoneyBlur = (key: "sss" | "pagibig" | "philhealth") => () => {
    const n = Number((wageData as any)[key] || 0);
    setWageData({ [key]: money(n) } as any);
  };

  // =========================
  // Section 2: Benefit Loans
  // =========================
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [rows, setRows] = React.useState<BenefitLoanRecord[]>([]);

  // Search + Pagination UI
  const [q, setQ] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);

  React.useEffect(() => {
    setPage(1);
  }, [selectedEmployee, q, pageSize, open]);

  // Modal state
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editingRow, setEditingRow] = React.useState<BenefitLoanRecord | null>(
    null
  );

  // Confirm delete dialog
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [confirmDeleteRow, setConfirmDeleteRow] =
    React.useState<BenefitLoanRecord | null>(null);

  // Interest rate input (percentage)
  const [interestRatePct, setInterestRatePct] = React.useState<string>("0");

  const defaultDraft = React.useCallback((): Draft => {
    return {
      benefit_code: "",
      loan_name: "",
      reference_no: "",
      principal_amount: "0.00",
      terms_installments: "12",
      deduct_on: "BOTH",
      start_cutoff_id: "",
      status: "ACTIVE",
      remarks: "",
    };
  }, []);

  const [draft, setDraft] = React.useState<Draft>(defaultDraft);

  const resetDraft = React.useCallback(() => {
    setDraft(defaultDraft());
    setEditingId(null);
    setEditingRow(null);
    setInterestRatePct("0");
  }, [defaultDraft]);

  const loadLoans = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const list = await wageApi.fetchBenefitLoansByUser(
        selectedEmployee.user_id
      );
      setRows(list);
    } catch (e: any) {
      console.error("[BenefitsTab] load loans failed", e);
      toast.error(e?.message || "Failed to load benefit loans.");
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

    if (cutoffs.length === 0 && !cutoffsLoading) ensureCutoffs();
    void loadLoans();
  }, [
    open,
    selectedEmployee,
    loadLoans,
    resetDraft,
    cutoffs.length,
    cutoffsLoading,
    ensureCutoffs,
  ]);

  const cutoffsById = React.useMemo(() => {
    const m = new Map<number, CutoffSetting>();
    for (const c of cutoffs) m.set(Number(c.id), c);
    return m;
  }, [cutoffs]);

  const startCutoffDisplay = React.useCallback(
    (startCutoffId: number | null | undefined) => {
      const id = Number(startCutoffId || 0);
      const c = cutoffsById.get(id);
      if (!c) return startCutoffId ? String(startCutoffId) : "—";
      return formatCutoffRange(c.start_date, c.end_date);
    },
    [cutoffsById]
  );

  // AUTO COMPUTE
  const computed = React.useMemo(() => {
    const principal = toNum(draft.principal_amount);
    const ratePct = Math.max(0, toNum(interestRatePct));

    const termsSafe = Math.max(
      1,
      Math.trunc(toNum(draft.terms_installments) || 1)
    );

    const interest = round2(principal * (ratePct / 100));
    const total = round2(principal + interest);
    const amort = round2(total / termsSafe);

    const paidInstallments = Math.max(
      0,
      Math.trunc(toNum(editingRow?.paid_installments ?? 0))
    );

    const remaining =
      paidInstallments > 0
        ? round2(Math.max(0, total - paidInstallments * amort))
        : total;

    return {
      principal,
      ratePct,
      termsSafe,
      interest,
      total,
      amort,
      paidInstallments,
      remaining,
    };
  }, [
    draft.principal_amount,
    draft.terms_installments,
    interestRatePct,
    editingRow,
  ]);

  const validate = React.useCallback(() => {
    if (!selectedEmployee) return null;

    if (!draft.benefit_code) {
      toast.error("Benefit code is required.");
      return null;
    }

    if (draft.benefit_code !== "SSS" && draft.benefit_code !== "PAGIBIG") {
      toast.error("Loans are only allowed for SSS and PAGIBIG.");
      return null;
    }

    if (!Number.isFinite(computed.principal) || computed.principal <= 0) {
      toast.error("Principal amount must be greater than 0.");
      return null;
    }

    if (!Number.isFinite(computed.ratePct) || computed.ratePct < 0) {
      toast.error("Interest rate cannot be negative.");
      return null;
    }

    if (!Number.isFinite(computed.total) || computed.total <= 0) {
      toast.error("Total payable is invalid.");
      return null;
    }

    if (!Number.isFinite(computed.amort) || computed.amort <= 0) {
      toast.error("Amortization amount is invalid.");
      return null;
    }

    const startCutoffId = toIntSafe(draft.start_cutoff_id);
    if (!startCutoffId || startCutoffId <= 0) {
      toast.error("Start cutoff is required.");
      return null;
    }

    if (!computed.termsSafe || computed.termsSafe <= 0) {
      toast.error("Terms installments must be at least 1.");
      return null;
    }

    return {
      startCutoffId,
      loan_name: draft.loan_name.trim() || null,
      reference_no: draft.reference_no.trim() || null,
      remarks: draft.remarks.trim() || null,
    };
  }, [computed, draft, selectedEmployee]);

  const saveLoan = React.useCallback(async () => {
    if (!selectedEmployee) return;

    const loggedUserId = getLoggedUserId();
    if (!loggedUserId) {
      toast.error("User session missing.");
      return;
    }

    const v = validate();
    if (!v) return;

    if (editingRow && editingRow.paid_installments > 0) {
      const prevP = toNum(editingRow.principal_amount);
      const prevI = toNum(editingRow.interest_amount);
      const prevT = Math.trunc(toNum(editingRow.terms_installments) || 1);

      const changed =
        round2(prevP) !== round2(computed.principal) ||
        round2(prevI) !== round2(computed.interest) ||
        Number(prevT) !== Number(computed.termsSafe);

      if (changed) {
        toast.error(
          "Cannot change principal/interest/terms after payments started."
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        await wageApi.patchBenefitLoan(editingId, {
          benefit_code: draft.benefit_code as any,
          loan_name: v.loan_name,
          reference_no: v.reference_no,

          principal_amount: computed.principal,
          interest_amount: computed.interest,
          total_payable: computed.total,
          amortization_amount: computed.amort,

          terms_installments: computed.termsSafe,
          deduct_on: draft.deduct_on,
          start_cutoff_id: v.startCutoffId,

          remaining_balance: computed.remaining,

          status: draft.status,
          remarks: v.remarks,

          updated_by: loggedUserId,
        });

        toast.success("Benefit loan updated.");
      } else {
        await wageApi.createBenefitLoan({
          user_id: selectedEmployee.user_id,

          benefit_code: draft.benefit_code as any,
          loan_name: v.loan_name,
          reference_no: v.reference_no,

          principal_amount: computed.principal,
          interest_amount: computed.interest,
          total_payable: computed.total,
          amortization_amount: computed.amort,

          terms_installments: computed.termsSafe,
          deduct_on: draft.deduct_on,
          start_cutoff_id: v.startCutoffId,

          paid_installments: 0,
          remaining_balance: computed.total,
          last_paid_cutoff_id: null,

          status: draft.status,
          remarks: v.remarks,

          created_by: loggedUserId,
          updated_by: loggedUserId,
        });

        toast.success("Benefit loan created.");
      }

      resetDraft();
      setFormOpen(false);
      await loadLoans();
    } catch (e: any) {
      console.error("[BenefitsTab] save loan failed", e);
      toast.error(e?.message || "Failed to save benefit loan.");
    } finally {
      setSaving(false);
    }
  }, [
    computed,
    draft,
    editingId,
    editingRow,
    loadLoans,
    resetDraft,
    selectedEmployee,
    validate,
  ]);

  const startEdit = React.useCallback(
    (r: BenefitLoanRecord) => {
      setEditingId(r.loan_id);
      setEditingRow(r);

      if (cutoffs.length === 0 && !cutoffsLoading) ensureCutoffs();

      const p = toNum(r.principal_amount);
      const i = toNum(r.interest_amount);
      const pct = p > 0 ? round2((i / p) * 100) : 0;
      setInterestRatePct(String(pct));

      setDraft({
        benefit_code: r.benefit_code,
        loan_name: r.loan_name ?? "",
        reference_no: r.reference_no ?? "",

        principal_amount: fmtMoneyPlain(r.principal_amount),

        terms_installments: String(
          Math.max(1, Math.trunc(toNum(r.terms_installments) || 1))
        ),
        deduct_on: (r.deduct_on ?? "BOTH") as DeductOn,
        start_cutoff_id: String(r.start_cutoff_id ?? ""),

        status: (r.status ?? "ACTIVE") as BenefitLoanStatus,
        remarks: r.remarks ?? "",
      });

      setFormOpen(true);
    },
    [cutoffs.length, cutoffsLoading, ensureCutoffs]
  );

  const startCreate = React.useCallback(() => {
    const firstCutoffId = cutoffs[0]?.id ? String(cutoffs[0]?.id) : "";
    setEditingId(null);
    setEditingRow(null);
    setInterestRatePct("0");
    setDraft({
      ...defaultDraft(),
      start_cutoff_id: firstCutoffId,
      benefit_code: "SSS",
      terms_installments: "1",
      deduct_on: "BOTH",
      status: "ACTIVE",
    });
    if (cutoffs.length === 0 && !cutoffsLoading) ensureCutoffs();
    setFormOpen(true);
  }, [cutoffs, cutoffs.length, cutoffsLoading, defaultDraft, ensureCutoffs]);

  const deleteLoan = React.useCallback(
    async (r: BenefitLoanRecord) => {
      if (r.paid_installments > 0) {
        toast.error("Cannot delete a loan that already has payments.");
        return;
      }

      setSaving(true);
      try {
        await wageApi.deleteBenefitLoan(r.loan_id);
        toast.success("Benefit loan deleted.");

        if (editingId === r.loan_id) {
          resetDraft();
          setFormOpen(false);
        }

        await loadLoans();
      } catch (e: any) {
        console.error("[BenefitsTab] delete loan failed", e);
        toast.error(e?.message || "Failed to delete benefit loan.");
      } finally {
        setSaving(false);
      }
    },
    [editingId, loadLoans, resetDraft]
  );

  const totals = React.useMemo(() => {
    const active = rows.filter((x) => x.status === "ACTIVE");
    const totalBal = active.reduce(
      (sum, x) => sum + Number(x.remaining_balance || 0),
      0
    );
    return {
      count: rows.length,
      activeCount: active.length,
      totalBalance: totalBal,
    };
  }, [rows]);

  // Filter + paginate
  const filteredRows = React.useMemo(() => {
    const needle = normalize(q);
    if (!needle) return rows;
    return rows.filter((r) => buildLoanHaystack(r).includes(needle));
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
    if (totalFiltered === 0) return "Showing 0–0 of 0";
    return `Showing ${pageStartIndex + 1}–${pageEndIndex} of ${totalFiltered}`;
  }, [loading, totalFiltered, pageStartIndex, pageEndIndex]);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  const modalTitle = editingId ? "Edit Benefit Loan" : "Add Benefit Loan";

  return (
    <div className="mt-4 space-y-6">
      {/* =========================
          SECTION 1: Contributions
         ========================= */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Contributions
        </div>
        <div className="text-xs text-gray-500">
          These values are saved together with Wage using the main “Save Wage”
          button.
        </div>

        <div className="grid grid-cols-3 gap-4 mt-3">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              SSS
            </label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                ₱
              </span>
              <Input
                value={wageData.sss}
                onChange={(e) => onMoneyChange("sss")(e.target.value)}
                onBlur={onMoneyBlur("sss")}
                className="h-10 pl-6"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Pagibig
            </label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                ₱
              </span>
              <Input
                value={wageData.pagibig}
                onChange={(e) => onMoneyChange("pagibig")(e.target.value)}
                onBlur={onMoneyBlur("pagibig")}
                className="h-10 pl-6"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Philhealth
            </label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                ₱
              </span>
              <Input
                value={wageData.philhealth}
                onChange={(e) => onMoneyChange("philhealth")(e.target.value)}
                onBlur={onMoneyBlur("philhealth")}
                className="h-10 pl-6"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </div>

      {/* =========================
          SECTION 2: Benefit Loans
         ========================= */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Benefit Loans
            </div>
            <div className="text-xs text-gray-500">
              Total: {totals.count} • Active: {totals.activeCount} • Active
              Balance:{" "}
              <span className="font-medium">
                ₱ {money(totals.totalBalance)}
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
                void loadLoans();
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
                if (!selectedEmployee) return;
                startCreate();
              }}
              disabled={!selectedEmployee}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Loan
            </Button>
          </div>
        </div>

        {/* Popup Modal */}
        <Dialog
          open={formOpen}
          onOpenChange={(v) => {
            setFormOpen(v);
            if (!v) resetDraft();
          }}
        >
          <DialogContent
            className="
              w-[95vw] sm:w-full
              max-w-3xl
              max-h-[90vh]
              overflow-hidden
              p-0
            "
          >
            <div className="flex flex-col max-h-[90vh]">
              <DialogHeader className="px-6 pt-6 pb-3 border-b">
                <DialogTitle>{modalTitle}</DialogTitle>
                <DialogDescription>
                  Loans are supported for SSS and Pagibig only. PhilHealth loans
                  are not allowed.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Benefit</Label>
                    <Select
                      value={(draft.benefit_code || "SSS") as any}
                      onValueChange={(v) =>
                        setDraft((p) => ({ ...p, benefit_code: v as any }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SSS">SSS</SelectItem>
                        <SelectItem value="PAGIBIG">PAGIBIG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={draft.status}
                      onValueChange={(v) =>
                        setDraft((p) => ({ ...p, status: v as any }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Loan Name</Label>
                    <Input
                      className="h-9"
                      value={draft.loan_name}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, loan_name: e.target.value }))
                      }
                      placeholder="e.g., Salary Loan"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Reference No</Label>
                    <Input
                      className="h-9"
                      value={draft.reference_no}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          reference_no: e.target.value,
                        }))
                      }
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Principal Amount</Label>
                    <Input
                      className="h-9"
                      inputMode="decimal"
                      value={draft.principal_amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!/^\d*\.?\d*$/.test(v)) return;
                        setDraft((p) => ({ ...p, principal_amount: v }));
                      }}
                      onBlur={() =>
                        setDraft((p) => ({
                          ...p,
                          principal_amount: fmtMoneyPlain(p.principal_amount),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Interest Rate (%)</Label>
                    <Input
                      className="h-9"
                      inputMode="decimal"
                      value={interestRatePct}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!/^\d*\.?\d*$/.test(v)) return;
                        setInterestRatePct(v);
                      }}
                      placeholder="e.g. 5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Interest Amount (Auto)</Label>
                    <Input
                      className="h-9"
                      readOnly
                      value={fmtMoneyPlain(computed.interest)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Total Payable (Auto)</Label>
                    <Input
                      className="h-9"
                      readOnly
                      value={fmtMoneyPlain(computed.total)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Terms (Installments)</Label>
                    <Input
                      className="h-9"
                      inputMode="numeric"
                      value={String(draft.terms_installments)}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          terms_installments: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      Amortization Amount (Auto)
                    </Label>
                    <Input
                      className="h-9"
                      readOnly
                      value={fmtMoneyPlain(computed.amort)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Deduct On</Label>
                    <Select
                      value={draft.deduct_on}
                      onValueChange={(v) =>
                        setDraft((p) => ({ ...p, deduct_on: v as any }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BOTH">Both Cutoffs</SelectItem>
                        <SelectItem value="FIRST">1st Cutoff Only</SelectItem>
                        <SelectItem value="SECOND">2nd Cutoff Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Remaining Balance (Auto)</Label>
                    <Input
                      className="h-9"
                      readOnly
                      value={fmtMoneyPlain(computed.remaining)}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs">Start Cutoff</Label>
                    {cutoffs.length > 0 ? (
                      <Select
                        value={draft.start_cutoff_id || ""}
                        onValueChange={(v) =>
                          setDraft((p) => ({ ...p, start_cutoff_id: v }))
                        }
                        disabled={cutoffsLoading}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={
                              cutoffsLoading
                                ? "Loading cutoffs..."
                                : "Select cutoff"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {cutoffs.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {cutoffLabel(c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="h-9"
                        type="number"
                        min={1}
                        value={draft.start_cutoff_id}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            start_cutoff_id: e.target.value,
                          }))
                        }
                        placeholder="Enter cutoff_settings.id"
                      />
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs">Remarks</Label>
                    <Textarea
                      value={draft.remarks}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, remarks: e.target.value }))
                      }
                      placeholder="Optional notes…"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 border-t bg-background">
                <Button
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  className={PAYROLL_PRIMARY}
                  onClick={saveLoan}
                  disabled={saving}
                >
                  {saving ? "Saving…" : editingId ? "Update Loan" : "Save Loan"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirm Delete Dialog */}
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={(v) => {
            setConfirmDeleteOpen(v);
            if (!v) setConfirmDeleteRow(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete benefit loan?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={saving || !confirmDeleteRow}
                onClick={() => {
                  if (!confirmDeleteRow) return;
                  void deleteLoan(confirmDeleteRow);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Search + Rows */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="w-full md:max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search loans (benefit, name, ref, amount, status)…"
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

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Benefit
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Loan
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Ref No
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Total
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Amort
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Terms
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Deduct
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Cutoff Start
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Remain
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Status
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="h-12 text-center text-gray-500"
                  >
                    Loading benefit loans...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="h-12 text-center text-gray-500"
                  >
                    No benefit loans found.
                  </TableCell>
                </TableRow>
              ) : totalFiltered === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="h-12 text-center text-gray-500"
                  >
                    No results{q ? ` for "${q}"` : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((r) => (
                  <TableRow
                    key={r.loan_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell className="whitespace-nowrap px-4 py-3 font-medium">
                      {r.benefit_code}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <span className="block max-w-[180px] truncate">
                        {r.loan_name || (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <span className="block max-w-[160px] truncate">
                        {r.reference_no || (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums">
                      ₱{money(r.total_payable)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums">
                      ₱{money(r.amortization_amount)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {r.terms_installments}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3">
                      {r.deduct_on}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {startCutoffDisplay(r.start_cutoff_id)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums">
                      ₱{money(r.remaining_balance)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3">
                      {statusBadge(r.status)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 text-right">
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
                          onClick={() => {
                            if (r.paid_installments > 0) {
                              toast.error(
                                "Cannot delete a loan that already has payments."
                              );
                              return;
                            }
                            setConfirmDeleteRow(r);
                            setConfirmDeleteOpen(true);
                          }}
                          disabled={saving}
                          title={
                            r.paid_installments > 0
                              ? "Cannot delete after payments"
                              : "Delete"
                          }
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
            aria-label="Benefit loans pagination"
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
