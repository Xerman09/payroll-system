// modules/wage/components/tabs/BenefitsTab.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, RefreshCcw, Pencil, Trash2, Search, X, MoreVertical } from "lucide-react";

import type {
  Employee,
  WageDataState,
  CutoffSetting,
  BenefitLoanRecord,
  BenefitCode,
  LoanBenefitCode,
  DeductOn,
  BenefitLoanStatus,
  BenefitLoanPatchPayload,
  BenefitLogRecord,
  BenefitLogType,
  BenefitLogDraft,
  BenefitLogCreatePayload,
  BenefitLogPatchPayload,
} from "../../types";
import * as wageApi from "../../providers/wageApi";
import ConfirmDialog from "../ConfirmDialog";
import { getLoggedUser } from "@/lib/auth";

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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  accumulated_amount: string;

  status: BenefitLoanStatus;
  remarks: string;
};

function money(n: unknown) {
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
  const n = Number(v);
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
  const logged = getLoggedUser();
  if (!logged) return null;
  const n = Number(logged?.user_id);
  return Number.isFinite(n) ? n : null;
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


  // =========================
  // Section 1: Contributions
  // =========================
  const onMoneyChange =
    (key: "sss" | "pagibig" | "philhealth") => (v: string) => {
      if (!/^\d*\.?\d*$/.test(v)) return;
      setWageData({ [key]: v });
    };

  const onMoneyBlur = (key: "sss" | "pagibig" | "philhealth") => () => {
    const n = Number(wageData[key] || 0);
    setWageData({ [key]: money(n) });
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
    null,
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmConfig, setConfirmConfig] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
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
      accumulated_amount: "0.00",
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
    } catch (e: unknown) {
      console.error("[BenefitsTab] load loans failed", e);
      const msg = e instanceof Error ? e.message : "Failed to load benefit loans.";
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
          benefit_code: draft.benefit_code as LoanBenefitCode,
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
        } as BenefitLoanPatchPayload);

        toast.success("Benefit loan updated.");
      } else {
        await wageApi.createBenefitLoan({
          user_id: selectedEmployee.user_id,

          benefit_code: draft.benefit_code as LoanBenefitCode,
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
    } catch (e: unknown) {
      console.error("[BenefitsTab] save loan failed", e);
      const msg = e instanceof Error ? e.message : "Failed to save benefit loan.";
      toast.error(msg);
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

        accumulated_amount: fmtMoneyPlain(r.accumulated_amount || 0),

        status: r.status,
        remarks: r.remarks ?? "",
      });

      setFormOpen(true);
    },
    [cutoffs.length, cutoffsLoading, ensureCutoffs]
  );

  // =========================
  // Section 3: Benefit Logs (Manual)
  // =========================
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [logsRows, setLogsRows] = React.useState<BenefitLogRecord[]>([]);
  const [logFormOpen, setLogFormOpen] = React.useState(false);
  const [editingLogId, setEditingLogId] = React.useState<number | null>(null);

  // Pagination for logs
  const [logPage, setLogPage] = React.useState(1);
  const LOG_PAGE_SIZE = 5;

  const defaultLogDraft = React.useCallback((): BenefitLogDraft => {
    return {
      benefit_code: "SSS",
      cutoff_setting_id: "",
      manual_cutoff_start: "",
      manual_cutoff_end: "",
      manual_cutoff_type: "",
      payroll_id_input: "",
      deducted_amount: "0.00",
      note: "",
      created_date: new Date().toISOString().split("T")[0],
    };
  }, []);

  const [logDraft, setLogDraft] = React.useState<BenefitLogDraft>(defaultLogDraft);

  const resetLogDraft = React.useCallback(() => {
    setLogDraft(defaultLogDraft());
    setEditingLogId(null);
  }, [defaultLogDraft]);

  const loadBenefitLogs = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setLogsLoading(true);
    try {
      const list = await wageApi.fetchBenefitLogsByUser(selectedEmployee.user_id);
      setLogsRows(list);
    } catch (e: unknown) {
      console.error("[BenefitsTab] load logs failed", e);
      const msg = e instanceof Error ? e.message : "Failed to load benefit logs.";
      toast.error(msg);
    } finally {
      setLogsLoading(false);
    }
  }, [selectedEmployee]);

  React.useEffect(() => {
    if (open && selectedEmployee) {
      void loadBenefitLogs();
    }
  }, [open, selectedEmployee, loadBenefitLogs]);

  const saveBenefitLog = React.useCallback(async () => {
    if (!selectedEmployee) return;
    const loggedUserId = getLoggedUserId();
    if (!loggedUserId) {
      toast.error("User session missing.");
      return;
    }

    const amt = toNum(logDraft.deducted_amount);
    if (amt <= 0) {
      toast.error("Deducted amount must be greater than 0.");
      return;
    }

    if (!logDraft.created_date) {
      toast.error("Date is required.");
      return;
    }

    if (!logDraft.cutoff_setting_id) {
       toast.error("Cutoff period is required.");
       return;
    }

    // Logic: payroll_run_id is always 0. 
    // payroll_detail_id takes the input value.
    const payrollRunId = 0;
    const payrollDetailId = logDraft.payroll_id_input.trim() || null;

    setSaving(true);
    try {
      const isManual = logDraft.cutoff_setting_id === "other" || logDraft.cutoff_setting_id === "0";
      let cId = Number(logDraft.cutoff_setting_id) || 0;
      let cStart = null;
      let cEnd = null;
      let cType: "FIRST" | "SECOND" | null = null;

      if (isManual) {
        cId = 0; // or some other flag
        cStart = logDraft.manual_cutoff_start || null;
        cEnd = logDraft.manual_cutoff_end || null;
        cType = logDraft.manual_cutoff_type || null;

        if (!cStart || !cEnd) {
          toast.error("Manual cutoff start and end dates are required.");
          return;
        }
      } else {
        const selCutoff = cutoffs.find(c => Number(c.id) === cId);
        cStart = selCutoff?.start_date || null;
        cEnd = selCutoff?.end_date || null;
        cType = (selCutoff?.cutoff_type as "FIRST" | "SECOND" | null) || null;
      }

      const basePayload = {
        benefit_code: logDraft.benefit_code as BenefitCode,
        cutoff_id: cId,
        cutoff_start: cStart,
        cutoff_end: cEnd,
        cutoff_type: cType,
        log_type: "CONTRIBUTION" as BenefitLogType,
        loan_id: null,
        source_amount: 0,
        deducted_amount: amt,
        payroll_run_id: payrollRunId,
        payroll_detail_id: payrollDetailId,
        note: logDraft.note.trim() || null,
        created_date: logDraft.created_date,
      };

      if (editingLogId) {
         await wageApi.patchBenefitLog(editingLogId, basePayload as BenefitLogPatchPayload);
         toast.success("Benefit log updated.");
      } else {
         const createPayload: BenefitLogCreatePayload = {
           ...basePayload,
           user_id: selectedEmployee.user_id,
         };
         await wageApi.createBenefitLog(createPayload);
         toast.success("Benefit log created.");
      }
      
      setLogFormOpen(false);
      resetLogDraft();
      await loadBenefitLogs();
    } catch (e: unknown) {
      console.error("[BenefitsTab] save log failed", e);
      const msg = e instanceof Error ? e.message : "Failed to save benefit log.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [
    selectedEmployee,
    logDraft,
    editingLogId,
    loadBenefitLogs,
    resetLogDraft,
    cutoffs
  ]);

  const executeDeleteBenefitLog = React.useCallback(
    async (id: number) => {
      setSaving(true);
      try {
        await wageApi.deleteBenefitLog(id);
        toast.success("Benefit log deleted.");
        await loadBenefitLogs();
      } catch (e: unknown) {
        console.error("[BenefitsTab] delete log failed", e);
        const msg =
          e instanceof Error ? e.message : "Failed to delete benefit log.";
        toast.error(msg);
      } finally {
        setSaving(false);
      }
    },
    [loadBenefitLogs],
  );

  const deleteBenefitLog = React.useCallback(
    async (id: number) => {
      setConfirmConfig({
        title: "Delete this benefit log?",
        description: "This action cannot be undone.",
        onConfirm: () => executeDeleteBenefitLog(id),
      });
      setConfirmOpen(true);
    },
    [executeDeleteBenefitLog],
  );

  const startEditLog = React.useCallback((r: BenefitLogRecord) => {
    setEditingLogId(r.benefit_log_id);
    
    const isManual = !r.cutoff_id || r.cutoff_id === 0;

    setLogDraft({
        benefit_code: r.benefit_code,
        cutoff_setting_id: isManual ? "other" : String(r.cutoff_id),
        manual_cutoff_start: r.cutoff_start || "",
        manual_cutoff_end: r.cutoff_end || "",
        manual_cutoff_type: (r.cutoff_type as "FIRST" | "SECOND" | "") || "",
        payroll_id_input: r.payroll_detail_id || "", 
        deducted_amount: fmtMoneyPlain(r.deducted_amount),
        note: r.note || "",
        created_date: (r.created_date || "").substring(0, 10),
    });
    setLogFormOpen(true);
  }, []);

  // Pagination Logic for Logs
  const totalLogPages = Math.ceil(logsRows.length / LOG_PAGE_SIZE);
  const currentLogPage = Math.min(Math.max(1, logPage), Math.max(1, totalLogPages));
  const pagedLogs = React.useMemo(() => {
    const start = (currentLogPage - 1) * LOG_PAGE_SIZE;
    return logsRows.slice(start, start + LOG_PAGE_SIZE);
  }, [logsRows, currentLogPage]);



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
  }, [cutoffs, cutoffsLoading, defaultDraft, ensureCutoffs]);

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
      } catch (e: unknown) {
        console.error("[BenefitsTab] delete loan failed", e);
        const msg = e instanceof Error ? e.message : "Failed to delete benefit loan.";
        toast.error(msg);
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
                      value={draft.benefit_code || "SSS"}
                      onValueChange={(v) =>
                        setDraft((p) => ({ ...p, benefit_code: v as BenefitCode }))
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
                        setDraft((p) => ({ ...p, status: v as BenefitLoanStatus }))
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
                        setDraft((p) => ({ ...p, deduct_on: v as DeductOn }))
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

                  <div className="space-y-2">
                    <Label className="text-xs">Accumulated Amount</Label>
                    <Input
                      className="h-9 bg-gray-100 dark:bg-gray-800/60"
                      disabled
                      value={draft.accumulated_amount || ""}
                      placeholder="0.00"
                    />
                    <div className="text-xs text-gray-500">
                      Total amount deducted from payroll so far
                    </div>
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
                  Terms
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Cutoff Start
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-gray-600 px-4">
                  Accumulated
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
                    colSpan={9}
                    className="h-12 text-center text-gray-500 text-sm"
                  >
                    Loading benefit loans...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-12 text-center text-gray-500 text-sm"
                  >
                    No benefit loans found.
                  </TableCell>
                </TableRow>
              ) : totalFiltered === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-12 text-center text-gray-500 text-sm"
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
                    <TableCell className="whitespace-nowrap px-4 py-3 font-medium text-sm">
                      {r.benefit_code}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm">
                      <span className="block max-w-[180px] truncate">
                        {r.loan_name || (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm">
                      <span className="block max-w-[160px] truncate">
                        {r.reference_no || (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums text-sm">
                      ₱{money(r.total_payable)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums text-sm">
                      {r.terms_installments}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums text-sm">
                      {startCutoffDisplay(r.start_cutoff_id)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      ₱{money(r.accumulated_amount || 0)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3">
                      {statusBadge(r.status)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={saving}
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEdit(r)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
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

      {/* =========================
          SECTION 3: Benefit Logs
         ========================= */}
      <div className="space-y-3 pt-6 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Benefit Logs
              </div>
              <div className="text-xs text-gray-500">
                Manual history or adjustments for contributions.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className={PAYROLL_OUTLINE}
              onClick={() => {
                resetLogDraft();
                setLogFormOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Log
            </Button>
        </div>

        <div className="rounded-md border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
          <Table className="text-xs">
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Payroll ID</TableHead>
                <TableHead>Cutoff</TableHead>
                <TableHead className="text-right">Deducted</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-[80px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading ? (
                 <TableRow>
                   <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                     Loading logs...
                   </TableCell>
                 </TableRow>
              ) : logsRows.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={7} className="h-24 text-center text-gray-400">
                     No benefit logs found.
                   </TableCell>
                 </TableRow>
              ) : (
                pagedLogs.map((r) => {
                  const pidDisplay = r.payroll_detail_id || "—";

                  return (
                    <TableRow key={r.benefit_log_id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell>{(r.created_date || "").substring(0, 10)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                          {r.benefit_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-gray-600 dark:text-gray-400">
                        {pidDisplay}
                      </TableCell>
                      <TableCell>
                        {r.cutoff_start && r.cutoff_end ? (
                          <div className="flex flex-col">
                            <span>{r.cutoff_start}</span>
                            <span className="text-[10px] text-gray-400">to {r.cutoff_end}</span>
                          </div>
                        ) : (
                          <span>{r.cutoff_id}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-gray-900 dark:text-gray-100">
                        {money(r.deducted_amount)}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-gray-500" title={r.note || ""}>
                        {r.note || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEditLog(r)}>
                              <Pencil className="mr-2 h-4 w-4 text-primary" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => deleteBenefitLog(r.benefit_log_id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          
          {!logsLoading && totalLogPages > 1 && (
            <div className="flex items-center justify-end p-2 border-t border-gray-100 dark:border-gray-800">
               <div className="flex gap-1">
                 <Button 
                   variant="outline" 
                   size="sm" 
                   className="h-6 px-2 text-[10px]"
                   disabled={currentLogPage <= 1}
                   onClick={() => setLogPage(p => p - 1)}
                 >
                   Prev
                 </Button>
                 <span className="text-[10px] flex items-center px-1 text-gray-500">
                   {currentLogPage} / {totalLogPages}
                 </span>
                 <Button 
                   variant="outline" 
                   size="sm" 
                   className="h-6 px-2 text-[10px]"
                   disabled={currentLogPage >= totalLogPages}
                   onClick={() => setLogPage(p => p + 1)}
                 >
                   Next
                 </Button>
               </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={logFormOpen} onOpenChange={setLogFormOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
             <DialogTitle>{editingLogId ? "Edit Benefit Log" : "Add Benefit Log"}</DialogTitle>
             <DialogDescription>
               Record a past contribution or adjustment.
             </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-2">
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <Label>Benefit Code</Label>
                  <Select 
                    value={logDraft.benefit_code} 
                    onValueChange={(v: string) => setLogDraft(d => ({ ...d, benefit_code: v as BenefitCode }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SSS">SSS</SelectItem>
                      <SelectItem value="PAGIBIG">Pagibig</SelectItem>
                      <SelectItem value="PHILHEALTH">Philhealth</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               <div className="space-y-1">
                  <Label>Cutoff Period</Label>
                  <Select 
                    value={logDraft.cutoff_setting_id} 
                    onValueChange={(v: string) => setLogDraft(d => ({ ...d, cutoff_setting_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Cutoff" />
                    </SelectTrigger>
                    <SelectContent>
                      {cutoffs.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          ({c.cutoff_type}) {c.start_date} to {c.end_date}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other / Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
             </div>

             {(logDraft.cutoff_setting_id === "other" || logDraft.cutoff_setting_id === "0") && (
               <div className="grid grid-cols-2 gap-4 border p-3 rounded-md bg-gray-50 dark:bg-gray-800/20">
                 <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-gray-400">Manual Start</Label>
                    <Input 
                      type="date"
                      value={logDraft.manual_cutoff_start}
                      onChange={e => setLogDraft(d => ({ ...d, manual_cutoff_start: e.target.value }))}
                      className="h-8 text-xs"
                    />
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-gray-400">Manual End</Label>
                    <Input 
                      type="date"
                      value={logDraft.manual_cutoff_end}
                      onChange={e => setLogDraft(d => ({ ...d, manual_cutoff_end: e.target.value }))}
                      className="h-8 text-xs"
                    />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] uppercase text-gray-400">Cutoff Type</Label>
                    <Select 
                      value={logDraft.manual_cutoff_type} 
                      onValueChange={(v: "FIRST" | "SECOND") => setLogDraft(d => ({ ...d, manual_cutoff_type: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIRST">First Cutoff</SelectItem>
                        <SelectItem value="SECOND">Second Cutoff</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
               </div>
             )}

             <div className="space-y-1">
               <Label>Date</Label>
               <Input 
                 type="date"
                 value={logDraft.created_date}
                 onChange={e => setLogDraft(d => ({ ...d, created_date: e.target.value }))}
               />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <Label>Payroll ID</Label>
                   <Input 
                     placeholder="Optional"
                     value={logDraft.payroll_id_input}
                     onChange={e => setLogDraft(d => ({ ...d, payroll_id_input: e.target.value }))}
                   />
                </div>
                <div className="space-y-1">
                   <Label>Deducted Amount</Label>
                   <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
                      <Input 
                        className="pl-6"
                        placeholder="0.00"
                        value={logDraft.deducted_amount}
                        onChange={e => {
                          if (/^\d*\.?\d*$/.test(e.target.value)) {
                            setLogDraft(d => ({ ...d, deducted_amount: e.target.value }));
                          }
                        }}
                        onBlur={() => {
                           const n = Number(logDraft.deducted_amount);
                           setLogDraft(d => ({ ...d, deducted_amount: money(n) }));
                        }}
                      />
                   </div>
                </div>
             </div>

             <div className="space-y-1">
               <Label>Note / Remarks</Label>
               <Textarea 
                 rows={2}
                 placeholder="Optional notes..."
                 value={logDraft.note}
                 onChange={e => setLogDraft(d => ({ ...d, note: e.target.value }))}
               />
             </div>
          </div>

          <DialogFooter>
             <Button variant="outline" onClick={() => setLogFormOpen(false)}>Cancel</Button>
             <Button onClick={saveBenefitLog} disabled={saving}>
               {saving ? "Saving..." : "Save Log"}
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
