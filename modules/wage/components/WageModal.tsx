// modules/wage/components/WageModal.tsx
"use client";

import React from "react";
import { toast } from "sonner";

import { WageTab } from "./tabs/WageTab";
import { LoansTab } from "./tabs/LoansTab";
import { RetroPayTab } from "./tabs/RetroPayTab";
import { AllowanceTab } from "./tabs/AllowanceTab";
import { BenefitsTab } from "./tabs/BenefitsTab";
import { OtherADTab } from "./tabs/OtherADTab";
import { StockPurchaseTab } from "./tabs/StockPurchaseTab";
import { SavingsTab } from "./tabs/SavingsTab";
import ConfirmDialog from "./ConfirmDialog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  X,
  Wallet,
  HandCoins,
  History,
  BadgeDollarSign,
  ShieldCheck,
  Layers,
  ReceiptText,
  PiggyBank,
} from "lucide-react";

import type {
  Employee,
  WageDataState,
  EmployeeLoanRecord,
  LoanType,
  RetroPayRecord,
  RetroPayDraft,
  CutoffSetting,
  PayrollOtherAdditionRecord,
  PayrollOtherDeductionRecord,
  PayrollOtherADDraft,
  SalarySchedule,
} from "../types";

import * as wageApi from "../providers/wageApi";

import {
  toLocalYmd,
  round2,
  money,
  computeMonthlyPayment,
  computeCoopInterest,
} from "../utils/loanMath";
import { COOP_INTEREST_RATE } from "../utils/payrollConstants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee: Employee | null;
  wageData: WageDataState;
  setWageData: (upd: Partial<WageDataState>) => void;
  onSave: () => Promise<void> | void;
  salarySchedules: SalarySchedule[];
};

type LoanDraft = {
  loan_amount: string;
  loan_type: LoanType;
  months_to_pay: string;
  start_date: string;
  end_date: string;

  monthly_payment: string; // auto
  interest_rate: string; // auto for COOP, else 0
  interest_amount: string; // auto for COOP, else 0
  net_amount_released: string; // auto for COOP, else 0

  accumulated_amount: string;

  status: string;
};

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

import { getLoggedUser } from "@/lib/auth";

function getLoggedUserId(): number | null {
  const user = getLoggedUser();
  const n = Number(user?.user_id);
  return Number.isFinite(n) ? n : null;
}

type TabKey = "wage" | "savings" | "loans" | "retro" | "allowance" | "benefits" | "stock" | "other";

// Theme tokens
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

export default function WageModal({
  open,
  onOpenChange,
  selectedEmployee,
  wageData,
  setWageData,
  onSave,
  salarySchedules,
}: Props) {
  // ✅ Modal width (wider to reduce table pressure)
  const MODAL_WIDTH = "max-w-[96vw] sm:max-w-6xl lg:max-w-7xl";

  // ✅ Table-fit scope:
  // - Prevent internal wrappers from creating horizontal scrollbars
  // - Force tables to fit the container
  // - Slightly tighten typography/padding for dense tables
  const TABLE_FIT_SCOPE =
    "overflow-x-hidden " +
    "[&_.overflow-auto]:overflow-x-hidden [&_.overflow-auto]:overflow-y-auto " +
    "[&_.overflow-x-auto]:overflow-x-hidden [&_.overflow-x-auto]:overflow-y-auto " +
    "[&_[data-radix-scroll-area-viewport]]:overflow-x-hidden " +
    "[&_table]:w-full [&_table]:table-fixed [&_table]:min-w-0 " +
    "[&_th]:whitespace-nowrap [&_th]:p-2 [&_td]:p-2 " +
    "[&_th]:text-[12px] sm:[&_th]:text-sm [&_td]:text-[12px] sm:[&_td]:text-sm " +
    // allow content to wrap instead of expanding width
    "[&_td]:whitespace-normal [&_td]:break-words";

  const ui = React.useMemo(
    () => ({
      primary: PAYROLL_PRIMARY,
      outline: PAYROLL_OUTLINE,
      iconBtn: PAYROLL_ICON_BTN,
      iconEdit: PAYROLL_ICON_EDIT,
      iconDelete: PAYROLL_ICON_DELETE,
    }),
    [],
  );

  // Tabs (✅ include savings)
  const [tab, setTab] = React.useState<TabKey>("wage");

  React.useEffect(() => {
    if (open) setTab("wage");
  }, [open]);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmConfig, setConfirmConfig] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // ===================================================
  // SHARED SAVE (footer)
  // ===================================================
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) setSaving(false);
  }, [open]);

  const handleSave = React.useCallback(async () => {
    if (saving) return;

    setSaving(true);
    try {
      await Promise.resolve(onSave());
      toast.success("Saved.");
    } catch (e: unknown) {
      console.error("[WageModal] Save failed", e);
      const msg = e instanceof Error ? e.message : "Failed to save.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [onSave, saving]);

  // ===================================================
  // LOANS (CRUD) + COOP support
  // ===================================================
  const [loanPanelOpen, setLoanPanelOpen] = React.useState(false);
  const [loanSaving, setLoanSaving] = React.useState(false);
  const [loanLoading, setLoanLoading] = React.useState(false);
  const [loans, setLoans] = React.useState<EmployeeLoanRecord[]>([]);
  const [editingLoanId, setEditingLoanId] = React.useState<number | null>(null);

  const defaultLoanDraft = React.useCallback((): LoanDraft => {
    const today = toLocalYmd(new Date());
    return {
      loan_amount: "0.00",
      loan_type: "VALE",
      months_to_pay: "1",
      start_date: today,
      end_date: "",
      monthly_payment: "0.00",
      interest_rate: "0.00",
      interest_amount: "0.00",
      net_amount_released: "0.00",
      accumulated_amount: "0.00",
      status: "ACTIVE",
    };
  }, []);

  const [loanDraft, setLoanDraft] = React.useState<LoanDraft>(defaultLoanDraft);

  const resetLoanDraft = React.useCallback(() => {
    setLoanDraft(defaultLoanDraft());
    setEditingLoanId(null);
  }, [defaultLoanDraft]);

  const recomputeLoanDraft = React.useCallback(
    (draft: LoanDraft): LoanDraft => {
      const amt = Number(draft.loan_amount);
      const rate = draft.loan_type === "COOP" ? COOP_INTEREST_RATE : 0;
      const monthly_payment = String(computeMonthlyPayment(
        Number(draft.loan_amount),
        Number(draft.months_to_pay),
        rate
      ));

      if (draft.loan_type === "COOP") {
        const coop = computeCoopInterest(amt);
        return {
          ...draft,
          monthly_payment,
          interest_rate: coop.interestRate,
          interest_amount: coop.interestAmount,
          net_amount_released: coop.netAmountReleased,
        };
      }

      return {
        ...draft,
        monthly_payment,
        interest_rate: "0.00",
        interest_amount: "0.00",
        net_amount_released: "0.00",
      };
    },
    [],
  );

  const loadLoans = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setLoanLoading(true);
    try {
      const rows = await wageApi.fetchEmployeeLoansByUser(
        selectedEmployee.user_id,
      );
      setLoans(rows);
    } catch (e: unknown) {
      console.error("[WageModal] Failed to load loans", e);
      const msg = e instanceof Error ? e.message : "Failed to load employee loans.";
      toast.error(msg);
    } finally {
      setLoanLoading(false);
    }
  }, [selectedEmployee]);

  const validateLoanDraft = React.useCallback(() => {
    const loanAmount = Number(loanDraft.loan_amount);
    const monthsToPay = Number(loanDraft.months_to_pay);

    if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
      toast.error("Loan amount must be greater than 0.");
      return null;
    }
    if (!Number.isInteger(monthsToPay) || monthsToPay <= 0) {
      toast.error("Months to pay must be a positive whole number.");
      return null;
    }

    if (loanDraft.loan_type === "COOP") {
      if (!loanDraft.start_date || !isYmd(loanDraft.start_date)) {
        toast.error("Start date is required for COOP loans.");
        return null;
      }
    }

    const rate = loanDraft.loan_type === "COOP" ? COOP_INTEREST_RATE : 0;
    const monthlyPayment = computeMonthlyPayment(loanAmount, monthsToPay, rate);
    if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
      toast.error("Monthly payment must be greater than 0.");
      return null;
    }

    return { loanAmount, monthsToPay, monthlyPayment };
  }, [loanDraft]);

  const saveLoan = React.useCallback(async () => {
    if (!selectedEmployee) return;

    const v = validateLoanDraft();
    if (!v) return;

    const loggedUserId = getLoggedUserId();
    if (!loggedUserId) {
      toast.error("User session missing.");
      return;
    }

    const coop = loanDraft.loan_type === "COOP";
    const start_date = coop
      ? loanDraft.start_date
      : isYmd(loanDraft.start_date)
        ? loanDraft.start_date
        : toLocalYmd(new Date());

    const loan_amount = round2(v.loanAmount);
    const months_to_pay = v.monthsToPay;
    const monthly_payment = round2(v.monthlyPayment);

    const interest_rate = coop ? COOP_INTEREST_RATE * 100 : 0;
    const interest_amount = coop ? round2(v.loanAmount * COOP_INTEREST_RATE) : 0;
    const net_amount_released = coop
      ? round2(v.loanAmount - interest_amount)
      : 0;

    setLoanSaving(true);
    try {
      if (editingLoanId) {
        await wageApi.patchEmployeeLoan(editingLoanId, {
          loan_type: loanDraft.loan_type,
          loan_amount,
          months_to_pay,
          monthly_payment,
          start_date,
          interest_rate,
          interest_amount,
          net_amount_released,
          updated_by: loggedUserId,
        });
        toast.success("Loan updated.");
      } else {
        await wageApi.createEmployeeLoan({
          user_id: selectedEmployee.user_id,
          loan_type: loanDraft.loan_type,
          loan_amount,
          months_to_pay,
          monthly_payment,
          start_date,
          end_date: null,
          interest_rate,
          interest_amount,
          net_amount_released,
          accumulated_amount: 0,
          status: "ACTIVE",
          created_by: loggedUserId,
          updated_by: loggedUserId,
        });
        toast.success("Loan added.");
      }

      resetLoanDraft();
      setLoanPanelOpen(false);
      await loadLoans();
    } catch (e: unknown) {
      console.error("[WageModal] Loan save failed", e);
      const msg = e instanceof Error ? e.message : "Failed to save loan.";
      toast.error(msg);
    } finally {
      setLoanSaving(false);
    }
  }, [
    editingLoanId,
    loanDraft.loan_type,
    loanDraft.start_date,
    loadLoans,
    resetLoanDraft,
    selectedEmployee,
    validateLoanDraft,
  ]);

  const startEditLoan = React.useCallback(
    (l: EmployeeLoanRecord) => {
      const s = String(l.status ?? "").toUpperCase();
      if (s === "PAID" || s === "COMPLETED" || s === "DONE") {
        toast.error("This loan is already paid and cannot be edited.");
        return;
      }

      setEditingLoanId(l.loan_id);
      setLoanPanelOpen(true);

      const loan_amount = money(l.loan_amount);
      const months_to_pay = String(l.months_to_pay ?? 1);
      const start_date =
        (l.start_date || "").substring(0, 10) || toLocalYmd(new Date());

      const rate = l.loan_type === "COOP" ? COOP_INTEREST_RATE : 0;
      const base: LoanDraft = {
        loan_type: l.loan_type,
        loan_amount,
        months_to_pay,
        start_date,
        end_date: (l.end_date || "").substring(0, 10),
        monthly_payment: String(computeMonthlyPayment(Number(loan_amount), Number(months_to_pay), rate)),
        interest_rate: money(l.interest_rate ?? 0),
        interest_amount: money(l.interest_amount ?? 0),
        net_amount_released: money(l.net_amount_released ?? 0),
        accumulated_amount: money(l.accumulated_amount ?? 0),
        status: String(l.status ?? "ACTIVE"),
      };

      setLoanDraft(recomputeLoanDraft(base));
    },
    [recomputeLoanDraft],
  );

  const executeDeleteLoan = React.useCallback(
    async (loanId: number) => {
      const loggedUserId = getLoggedUserId();
      if (!loggedUserId) {
        toast.error("User session missing.");
        return;
      }

      setLoanSaving(true);
      try {
        await wageApi.deleteEmployeeLoan(loanId);
        toast.success("Loan deleted.");

        if (editingLoanId === loanId) {
          resetLoanDraft();
          setLoanPanelOpen(false);
        }

        await loadLoans();
      } catch (e: unknown) {
        console.error("[WageModal] Delete failed; trying cancel fallback", e);

        try {
          await wageApi.patchEmployeeLoan(loanId, {
            status: "CANCELLED",
            updated_by: loggedUserId,
          });
          toast.success("Loan cancelled (delete not permitted).");

          if (editingLoanId === loanId) {
            resetLoanDraft();
            setLoanPanelOpen(false);
          }

          await loadLoans();
        } catch (e2: unknown) {
          console.error("[WageModal] Cancel fallback failed", e2);
          const msg1 =
            e instanceof Error ? e.message : "Failed to delete/cancel loan.";
          const msg2 = e2 instanceof Error ? e2.message : msg1;
          toast.error(msg2);
        }
      } finally {
        setLoanSaving(false);
      }
    },
    [editingLoanId, loadLoans, resetLoanDraft],
  );

  const deleteLoan = React.useCallback(
    async (loanId: number) => {
      const row = loans.find((x) => x.loan_id === loanId);
      const s = String(row?.status || "").toUpperCase();
      if (s === "PAID" || s === "COMPLETED" || s === "DONE") {
        toast.error("This loan is already paid and cannot be deleted.");
        return;
      }

      setConfirmConfig({
        title: "Delete this loan?",
        description:
          "This action cannot be undone and will permanently remove this loan record.",
        onConfirm: () => executeDeleteLoan(loanId),
      });
      setConfirmOpen(true);
    },
    [loans, executeDeleteLoan, setConfirmConfig, setConfirmOpen],
  );

  // ===================================================
  // RETRO PAY (CRUD) + CUTOFF selection
  // ===================================================
  const [retroLoading, setRetroLoading] = React.useState(false);
  const [retroSaving, setRetroSaving] = React.useState(false);
  const [retroRows, setRetroRows] = React.useState<RetroPayRecord[]>([]);
  const [retroFormOpen, setRetroFormOpen] = React.useState(false);
  const [editingRetroId, setEditingRetroId] = React.useState<number | null>(
    null,
  );

  const [cutoffsLoading, setCutoffsLoading] = React.useState(false);
  const [cutoffs, setCutoffs] = React.useState<CutoffSetting[]>([]);

  const defaultRetroDraft = React.useCallback((): RetroPayDraft => {
    return {
      amount: "0.00",
      description: "",
      cutoff_setting_id: null,
      cutoff_start: "",
      cutoff_end: "",
      is_processed: 0,
    };
  }, []);

  const [retroDraft, setRetroDraft] =
    React.useState<RetroPayDraft>(defaultRetroDraft);

  const resetRetroDraft = React.useCallback(() => {
    setRetroDraft(defaultRetroDraft());
    setEditingRetroId(null);
  }, [defaultRetroDraft]);

  const loadCutoffSettings = React.useCallback(async () => {
    setCutoffsLoading(true);
    try {
      const rows = await wageApi.fetchCutoffSettingsOpen();
      setCutoffs(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load cutoff settings.";
      console.error("[WageModal] Failed to load cutoff settings", e);
      toast.error(msg);
      setCutoffs([]);
    } finally {
      setCutoffsLoading(false);
    }
  }, []);

  const applyCutoffSelection = React.useCallback(
    (cutoffId: number | null) => {
      if (!cutoffId) {
        setRetroDraft((p) => ({
          ...p,
          cutoff_setting_id: null,
          cutoff_start: "",
          cutoff_end: "",
        }));
        return;
      }

      const c = cutoffs.find((x) => x.id === cutoffId);
      if (!c) {
        setRetroDraft((p) => ({
          ...p,
          cutoff_setting_id: null,
          cutoff_start: "",
          cutoff_end: "",
        }));
        return;
      }

      setRetroDraft((p) => ({
        ...p,
        cutoff_setting_id: cutoffId,
        cutoff_start: c.start_date,
        cutoff_end: c.end_date,
      }));
    },
    [cutoffs],
  );

  const loadRetroPay = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setRetroLoading(true);
    try {
      const rows = await wageApi.fetchRetroPayByUser(selectedEmployee.user_id);
      setRetroRows(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load retro pay.";
      console.error("[WageModal] Failed to load retro pay", e);
      toast.error(msg);
    } finally {
      setRetroLoading(false);
    }
  }, [selectedEmployee]);

  const validateRetroDraft = React.useCallback(() => {
    const amt = Number(retroDraft.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Retro pay amount must be greater than 0.");
      return null;
    }

    if (!retroDraft.cutoff_setting_id) {
      toast.error("Please select a cutoff period (1st or 2nd).");
      return null;
    }

    if (!isYmd(retroDraft.cutoff_start) || !isYmd(retroDraft.cutoff_end)) {
      toast.error("Selected cutoff period is invalid.");
      return null;
    }

    if (retroDraft.cutoff_start > retroDraft.cutoff_end) {
      toast.error("Selected cutoff period is invalid.");
      return null;
    }

    return { amt: round2(amt) };
  }, [retroDraft]);

  const saveRetro = React.useCallback(async () => {
    if (!selectedEmployee) return;

    const loggedUserId = getLoggedUserId();
    if (!loggedUserId) {
      toast.error("User session missing.");
      return;
    }

    const v = validateRetroDraft();
    if (!v) return;

    setRetroSaving(true);
    try {
      if (editingRetroId) {
        await wageApi.patchRetroPay(editingRetroId, {
          amount: v.amt,
          description: retroDraft.description?.trim() || null,
          cutoff_start: retroDraft.cutoff_start,
          cutoff_end: retroDraft.cutoff_end,
          is_processed: retroDraft.is_processed,
          updated_by: loggedUserId,
        });
        toast.success("Retro pay updated.");
      } else {
        await wageApi.createRetroPay({
          user_id: selectedEmployee.user_id,
          amount: v.amt,
          description: retroDraft.description?.trim() || null,
          cutoff_start: retroDraft.cutoff_start,
          cutoff_end: retroDraft.cutoff_end,
          is_processed: retroDraft.is_processed ?? 0,
          created_by: loggedUserId,
          updated_by: loggedUserId,
        });
        toast.success("Retro pay added.");
      }

      resetRetroDraft();
      setRetroFormOpen(false);
      await loadRetroPay();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save retro pay.";
      console.error("[WageModal] Retro pay save failed", e);
      toast.error(msg);
    } finally {
      setRetroSaving(false);
    }
  }, [
    editingRetroId,
    loadRetroPay,
    resetRetroDraft,
    retroDraft,
    selectedEmployee,
    validateRetroDraft,
  ]);

  const startEditRetro = React.useCallback(
    (r: RetroPayRecord) => {
      setEditingRetroId(r.retro_id);
      setRetroFormOpen(true);

      const start = (r.cutoff_start || "").substring(0, 10);
      const end = (r.cutoff_end || "").substring(0, 10);

      const matched =
        cutoffs.find((c) => c.start_date === start && c.end_date === end) ||
        null;

      setRetroDraft({
        amount: money(r.amount),
        description: r.description ?? "",
        cutoff_setting_id: matched?.id ?? null,
        cutoff_start: start,
        cutoff_end: end,
        is_processed: Number(r.is_processed) === 1 ? 1 : 0,
      });
    },
    [cutoffs],
  );

  const executeDeleteRetro = React.useCallback(
    async (retroId: number) => {
      setRetroSaving(true);
      try {
        await wageApi.deleteRetroPay(retroId);
        toast.success("Retro pay deleted.");

        if (editingRetroId === retroId) {
          resetRetroDraft();
          setRetroFormOpen(false);
        }

        await loadRetroPay();
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to delete retro pay.";
        console.error("[WageModal] Retro pay delete failed", e);
        toast.error(msg);
      } finally {
        setRetroSaving(false);
      }
    },
    [editingRetroId, loadRetroPay, resetRetroDraft],
  );

  const deleteRetro = React.useCallback(
    async (retroId: number) => {
      const loggedUserId = getLoggedUserId();
      if (!loggedUserId) {
        toast.error("User session missing.");
        return;
      }

      const row = retroRows.find((x) => x.retro_id === retroId);
      if (row && Number(row.is_processed) === 1) {
        toast.error("Processed retro pay entries cannot be deleted.");
        return;
      }

      setConfirmConfig({
        title: "Delete this retro pay entry?",
        description:
          "This action cannot be undone and will remove this retro pay record from the employee's history.",
        onConfirm: () => executeDeleteRetro(retroId),
      });
      setConfirmOpen(true);
    },
    [retroRows, executeDeleteRetro, setConfirmConfig, setConfirmOpen],
  );

  // ===================================================
  // OTHER ADDITIONS / DEDUCTIONS (CRUD)
  // ===================================================
  const [addLoading, setAddLoading] = React.useState(false);
  const [addSaving, setAddSaving] = React.useState(false);
  const [addRows, setAddRows] = React.useState<PayrollOtherAdditionRecord[]>(
    [],
  );
  const [addFormOpen, setAddFormOpen] = React.useState(false);
  const [editingAddId, setEditingAddId] = React.useState<number | null>(null);

  const [dedLoading, setDedLoading] = React.useState(false);
  const [dedSaving, setDedSaving] = React.useState(false);
  const [dedRows, setDedRows] = React.useState<PayrollOtherDeductionRecord[]>(
    [],
  );
  const [dedFormOpen, setDedFormOpen] = React.useState(false);
  const [editingDedId, setEditingDedId] = React.useState<number | null>(null);

  const defaultOtherDraft = React.useCallback((): PayrollOtherADDraft => {
    return {
      amount: "0.00",
      description: "",
      cutoff_setting_id: null,
      cutoff_start: "",
      cutoff_end: "",
    };
  }, []);

  const [addDraft, setAddDraft] =
    React.useState<PayrollOtherADDraft>(defaultOtherDraft);
  const [dedDraft, setDedDraft] =
    React.useState<PayrollOtherADDraft>(defaultOtherDraft);

  const resetAddDraft = React.useCallback(() => {
    setAddDraft(defaultOtherDraft());
    setEditingAddId(null);
  }, [defaultOtherDraft]);

  const resetDedDraft = React.useCallback(() => {
    setDedDraft(defaultOtherDraft());
    setEditingDedId(null);
  }, [defaultOtherDraft]);

  const applyCutoffToOtherDraft = React.useCallback(
    (cutoffId: number | null, kind: "add" | "ded") => {
      const setDraft = kind === "add" ? setAddDraft : setDedDraft;

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
    [cutoffs],
  );

  const validateOtherDraft = React.useCallback((d: PayrollOtherADDraft) => {
    const amt = Number(d.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Amount must be greater than 0.");
      return null;
    }

    if (!d.cutoff_setting_id) {
      toast.error("Please select a cutoff period.");
      return null;
    }

    if (!isYmd(d.cutoff_start) || !isYmd(d.cutoff_end)) {
      toast.error("Selected cutoff period is invalid.");
      return null;
    }

    if (d.cutoff_start > d.cutoff_end) {
      toast.error("Selected cutoff period is invalid.");
      return null;
    }

    return { amt: round2(amt) };
  }, []);

  const loadOtherAdditions = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setAddLoading(true);
    try {
      const rows = await wageApi.fetchPayrollOtherAdditionsByUser(
        selectedEmployee.user_id,
      );
      setAddRows(rows);
    } catch (e: unknown) {
      console.error("[WageModal] Failed to load other additions", e);
      const msg = e instanceof Error ? e.message : "Failed to load other additions.";
      toast.error(msg);
    } finally {
      setAddLoading(false);
    }
  }, [selectedEmployee]);

  const loadOtherDeductions = React.useCallback(async () => {
    if (!selectedEmployee) return;
    setDedLoading(true);
    try {
      const rows = await wageApi.fetchPayrollOtherDeductionsByUser(
        selectedEmployee.user_id,
      );
      setDedRows(rows);
    } catch (e: unknown) {
      console.error("[WageModal] Failed to load other deductions", e);
      const msg = e instanceof Error ? e.message : "Failed to load other deductions.";
      toast.error(msg);
    } finally {
      setDedLoading(false);
    }
  }, [selectedEmployee]);

  const saveOtherAddition = React.useCallback(async () => {
    if (!selectedEmployee) return;

    const loggedUserId = getLoggedUserId();
    if (!loggedUserId) {
      toast.error("User session missing.");
      return;
    }

    const v = validateOtherDraft(addDraft);
    if (!v) return;

    setAddSaving(true);
    try {
      if (editingAddId) {
        await wageApi.patchPayrollOtherAddition(editingAddId, {
          amount: v.amt,
          description: addDraft.description?.trim() || null,
          cutoff_start: addDraft.cutoff_start,
          cutoff_end: addDraft.cutoff_end,
        });
        toast.success("Other addition updated.");
      } else {
        await wageApi.createPayrollOtherAddition({
          user_id: selectedEmployee.user_id,
          amount: v.amt,
          description: addDraft.description?.trim() || null,
          cutoff_start: addDraft.cutoff_start,
          cutoff_end: addDraft.cutoff_end,
          created_by: loggedUserId,
        });
        toast.success("Other addition added.");
      }

      resetAddDraft();
      setAddFormOpen(false);
      await loadOtherAdditions();
    } catch (e: unknown) {
      console.error("[WageModal] Save other addition failed", e);
      const msg = e instanceof Error ? e.message : "Failed to save other addition.";
      toast.error(msg);
    } finally {
      setAddSaving(false);
    }
  }, [
    addDraft,
    editingAddId,
    loadOtherAdditions,
    resetAddDraft,
    selectedEmployee,
    validateOtherDraft,
  ]);

  const saveOtherDeduction = React.useCallback(async () => {
    if (!selectedEmployee) return;

    const loggedUserId = getLoggedUserId();
    if (!loggedUserId) {
      toast.error("User session missing.");
      return;
    }

    const v = validateOtherDraft(dedDraft);
    if (!v) return;

    setDedSaving(true);
    try {
      if (editingDedId) {
        await wageApi.patchPayrollOtherDeduction(editingDedId, {
          amount: v.amt,
          description: dedDraft.description?.trim() || null,
          cutoff_start: dedDraft.cutoff_start,
          cutoff_end: dedDraft.cutoff_end,
        });
        toast.success("Other deduction updated.");
      } else {
        await wageApi.createPayrollOtherDeduction({
          user_id: selectedEmployee.user_id,
          amount: v.amt,
          description: dedDraft.description?.trim() || null,
          cutoff_start: dedDraft.cutoff_start,
          cutoff_end: dedDraft.cutoff_end,
          created_by: loggedUserId,
        });
        toast.success("Other deduction added.");
      }

      resetDedDraft();
      setDedFormOpen(false);
      await loadOtherDeductions();
    } catch (e: unknown) {
      console.error("[WageModal] Save other deduction failed", e);
      const msg = e instanceof Error ? e.message : "Failed to save other deduction.";
      toast.error(msg);
    } finally {
      setDedSaving(false);
    }
  }, [
    dedDraft,
    editingDedId,
    loadOtherDeductions,
    resetDedDraft,
    selectedEmployee,
    validateOtherDraft,
  ]);

  const startEditOtherAddition = React.useCallback(
    (r: PayrollOtherAdditionRecord) => {
      setEditingAddId(r.id);
      setAddFormOpen(true);

      const start = (r.cutoff_start || "").substring(0, 10);
      const end = (r.cutoff_end || "").substring(0, 10);
      const matched =
        cutoffs.find((c) => c.start_date === start && c.end_date === end) ||
        null;

      setAddDraft({
        amount: money(r.amount),
        description: r.description ?? "",
        cutoff_setting_id: matched?.id ?? null,
        cutoff_start: start,
        cutoff_end: end,
      });
    },
    [cutoffs],
  );

  const executeDeleteOtherAddition = React.useCallback(
    async (id: number) => {
      setAddSaving(true);
      try {
        await wageApi.deletePayrollOtherAddition(id);
        toast.success("Other addition deleted.");

        if (editingAddId === id) {
          resetAddDraft();
          setAddFormOpen(false);
        }

        await loadOtherAdditions();
      } catch (e: unknown) {
        console.error("[WageModal] Delete other addition failed", e);
        const msg =
          e instanceof Error ? e.message : "Failed to delete other addition.";
        toast.error(msg);
      } finally {
        setAddSaving(false);
      }
    },
    [editingAddId, loadOtherAdditions, resetAddDraft],
  );

  const deleteOtherAddition = React.useCallback(
    async (id: number) => {
      setConfirmConfig({
        title: "Delete this addition?",
        description: "This action cannot be undone.",
        onConfirm: () => executeDeleteOtherAddition(id),
      });
      setConfirmOpen(true);
    },
    [executeDeleteOtherAddition, setConfirmConfig, setConfirmOpen],
  );

  const startEditOtherDeduction = React.useCallback(
    (r: PayrollOtherDeductionRecord) => {
      setEditingDedId(r.id);
      setDedFormOpen(true);

      const start = (r.cutoff_start || "").substring(0, 10);
      const end = (r.cutoff_end || "").substring(0, 10);
      const matched =
        cutoffs.find((c) => c.start_date === start && c.end_date === end) ||
        null;

      setDedDraft({
        amount: money(r.amount),
        description: r.description ?? "",
        cutoff_setting_id: matched?.id ?? null,
        cutoff_start: start,
        cutoff_end: end,
      });
    },
    [cutoffs],
  );

  const executeDeleteOtherDeduction = React.useCallback(
    async (id: number) => {
      setDedSaving(true);
      try {
        await wageApi.deletePayrollOtherDeduction(id);
        toast.success("Other deduction deleted.");

        if (editingDedId === id) {
          resetDedDraft();
          setDedFormOpen(false);
        }

        await loadOtherDeductions();
      } catch (e: unknown) {
        console.error("[WageModal] Delete other deduction failed", e);
        const msg =
          e instanceof Error ? e.message : "Failed to delete other deduction.";
        toast.error(msg);
      } finally {
        setDedSaving(false);
      }
    },
    [editingDedId, loadOtherDeductions, resetDedDraft],
  );

  const deleteOtherDeduction = React.useCallback(
    async (id: number) => {
      setConfirmConfig({
        title: "Delete this deduction?",
        description: "This action cannot be undone.",
        onConfirm: () => executeDeleteOtherDeduction(id),
      });
      setConfirmOpen(true);
    },
    [executeDeleteOtherDeduction, setConfirmConfig, setConfirmOpen],
  );

  // ===================================================
  // Modal open/close lifecycle
  // ===================================================
  React.useEffect(() => {
    if (!open) {
      setLoanPanelOpen(false);
      resetLoanDraft();
      setLoans([]);

      setRetroFormOpen(false);
      resetRetroDraft();
      setRetroRows([]);

      setAddFormOpen(false);
      resetAddDraft();
      setAddRows([]);

      setDedFormOpen(false);
      resetDedDraft();
      setDedRows([]);

      setCutoffs([]);
      return;
    }

    if (!selectedEmployee) return;

    void loadLoans();
    void loadRetroPay();
    void loadCutoffSettings();
    void loadOtherAdditions();
    void loadOtherDeductions();
  }, [
    open,
    selectedEmployee,
    loadLoans,
    loadRetroPay,
    loadCutoffSettings,
    loadOtherAdditions,
    loadOtherDeductions,
    resetLoanDraft,
    resetRetroDraft,
    resetAddDraft,
    resetDedDraft,
  ]);

  const employeeLabel = selectedEmployee
    ? `${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`
    : "Unknown Employee";

  const summary = React.useMemo(() => {
    const num = (v: string | number | null | undefined) => {
      const n = Number(String(v ?? "0").replace(/,/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    const daily = num(wageData.dailyWage || wageData.dailyWageInput || 0);

    const sss = num(wageData.sss);
    const pagibig = num(wageData.pagibig);
    const philhealth = num(wageData.philhealth);

    const contribTotal = sss + pagibig + philhealth;

    const activeLoans = loans.filter(
      (l) => String(l.status || "").toUpperCase() === "ACTIVE",
    ).length;

    const pendingRetro = retroRows.filter(
      (r) => Number(r.is_processed) !== 1,
    ).length;

    const addTotal = addRows.reduce((sum, r) => sum + num(r.amount), 0);
    const dedTotal = dedRows.reduce((sum, r) => sum + num(r.amount), 0);

    return {
      daily,
      contribTotal,
      activeLoans,
      pendingRetro,
      addTotal,
      dedTotal,
    };
  }, [wageData, loans, retroRows, addRows, dedRows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        // ✅ Fix: hide the shadcn default close button (prevents double X / overlap)
        className={`${MODAL_WIDTH} w-full p-0 overflow-hidden rounded-xl border shadow-2xl [&>button]:hidden`}
      >
        <div className="flex max-h-[85vh] flex-col">
          {/* Header */}
          <div className="relative shrink-0 border-b bg-white dark:bg-slate-950">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-persian-blue-700 via-indigo-600 to-cyan-500" />

            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogHeader>
                    <DialogTitle className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      Employee Compensation
                    </DialogTitle>
                  </DialogHeader>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {employeeLabel}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="truncate">
                      Employee ID:{" "}
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {selectedEmployee?.user_id ?? "—"}
                      </span>
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      Daily: ₱ {money(summary.daily)}
                    </Badge>

                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      Contributions: ₱ {money(summary.contribTotal)}
                    </Badge>

                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      Active Loans: {summary.activeLoans}
                    </Badge>

                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      Retro Pending: {summary.pendingRetro}
                    </Badge>

                    {saving && (
                      <Badge className="bg-persian-blue-800 text-white hover:bg-persian-blue-800">
                        Saving…
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Other Additions:{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    ₱ {money(summary.addTotal)}
                  </span>
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>
                  Other Deductions:{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    ₱ {money(summary.dedTotal)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-slate-950">
            <div className="p-6">
              <Tabs
                value={tab}
                onValueChange={(v) => setTab(v as TabKey)}
                className="w-full"
              >
                {/* ✅ Fix: use minmax(0,1fr) so the right pane can shrink without forcing overflow */}
                <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
                  {/* Left navigation */}
                  <div className="self-start md:sticky md:top-6">
                    <div className="rounded-xl border bg-white p-2 shadow-sm dark:bg-slate-950">
                      {/* ✅ Fix: force TabsList to h-auto to avoid overlaps/messy layout */}
                      <TabsList
                        className="
                          flex h-auto w-full flex-row items-center justify-start gap-2 overflow-x-auto
                          bg-transparent p-0
                          md:flex-col md:items-stretch md:justify-start md:gap-1 md:overflow-visible
                        "
                      >
                        <TabsTrigger
                          value="wage"
                          className="group w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left
                            text-slate-700 dark:text-slate-200
                            data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white
                            data-[state=active]:shadow-sm"
                        >
                          <Wallet className="h-4 w-4 opacity-80 group-data-[state=active]:opacity-100" />
                          <span className="hidden md:flex md:flex-col md:leading-tight">
                            <span className="text-sm font-medium">Wage</span>
                            <span className="text-xs font-normal text-slate-500 group-data-[state=active]:text-white/80">
                              Daily wage, leaves, flags
                            </span>
                          </span>
                          <span className="md:hidden text-sm font-medium">
                            Wage
                          </span>
                        </TabsTrigger>

                        {/* ✅ Savings (now consistent) */}
                        <TabsTrigger
                          value="savings"
                          className="group w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left
                            text-slate-700 dark:text-slate-200
                            data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white
                            data-[state=active]:shadow-sm"
                        >
                          <PiggyBank className="h-4 w-4 opacity-80 group-data-[state=active]:opacity-100" />
                          <span className="hidden md:flex md:flex-col md:leading-tight">
                            <span className="text-sm font-medium">Savings</span>
                            <span className="text-xs font-normal text-slate-500 group-data-[state=active]:text-white/80">
                              COOP savings / membership
                            </span>
                          </span>
                          <span className="md:hidden text-sm font-medium">
                            Savings
                          </span>
                        </TabsTrigger>

                        <TabsTrigger
                          value="loans"
                          className="group w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left
                            text-slate-700 dark:text-slate-200
                            data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white
                            data-[state=active]:shadow-sm"
                        >
                          <HandCoins className="h-4 w-4 opacity-80 group-data-[state=active]:opacity-100" />
                          <span className="hidden md:flex md:flex-col md:leading-tight">
                            <span className="text-sm font-medium">Loans</span>
                            <span className="text-xs font-normal text-slate-500 group-data-[state=active]:text-white/80">
                              VALE, COOP, CAR LOAN
                            </span>
                          </span>
                          <span className="md:hidden text-sm font-medium">
                            Loans
                          </span>
                        </TabsTrigger>

                        <TabsTrigger
                          value="retro"
                          className="group w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left
                            text-slate-700 dark:text-slate-200
                            data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white
                            data-[state=active]:shadow-sm"
                        >
                          <History className="h-4 w-4 opacity-80 group-data-[state=active]:opacity-100" />
                          <span className="hidden md:flex md:flex-col md:leading-tight">
                            <span className="text-sm font-medium">
                              Retro Pay
                            </span>
                            <span className="text-xs font-normal text-slate-500 group-data-[state=active]:text-white/80">
                              Adjustments per cutoff
                            </span>
                          </span>
                          <span className="md:hidden text-sm font-medium">
                            Retro
                          </span>
                        </TabsTrigger>

                        <TabsTrigger
                          value="allowance"
                          className="group w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left
                            text-slate-700 dark:text-slate-200
                            data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white
                            data-[state=active]:shadow-sm"
                        >
                          <BadgeDollarSign className="h-4 w-4 opacity-80 group-data-[state=active]:opacity-100" />
                          <span className="hidden md:flex md:flex-col md:leading-tight">
                            <span className="text-sm font-medium">
                              Allowance
                            </span>
                            <span className="text-xs font-normal text-slate-500 group-data-[state=active]:text-white/80">
                              Recurring / one-time
                            </span>
                          </span>
                          <span className="md:hidden text-sm font-medium">
                            Allowance
                          </span>
                        </TabsTrigger>

                        <TabsTrigger
                          value="benefits"
                          className="group w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left
                            text-slate-700 dark:text-slate-200
                            data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white
                            data-[state=active]:shadow-sm"
                        >
                          <ShieldCheck className="h-4 w-4 opacity-80 group-data-[state=active]:opacity-100" />
                          <span className="hidden md:flex md:flex-col md:leading-tight">
                            <span className="text-sm font-medium">
                              Benefits
                            </span>
                            <span className="text-xs font-normal text-slate-500 group-data-[state=active]:text-white/80">
                              Contributions + loans
                            </span>
                          </span>
                          <span className="md:hidden text-sm font-medium">
                            Benefits
                          </span>
                        </TabsTrigger>

                        <TabsTrigger
                          value="stock"
                          className="group w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left
                            text-slate-700 dark:text-slate-200
                            data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white
                            data-[state=active]:shadow-sm"
                        >
                          <ReceiptText className="h-4 w-4 opacity-80 group-data-[state=active]:opacity-100" />
                          <span className="hidden md:flex md:flex-col md:leading-tight">
                            <span className="text-sm font-medium">
                              Stock Purchase
                            </span>
                            <span className="text-xs font-normal text-slate-500 group-data-[state=active]:text-white/80">
                              DR payments / deductions
                            </span>
                          </span>
                          <span className="md:hidden text-sm font-medium">
                            Stock
                          </span>
                        </TabsTrigger>

                        <TabsTrigger
                          value="other"
                          className="group w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left
                            text-slate-700 dark:text-slate-200
                            data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white
                            data-[state=active]:shadow-sm"
                        >
                          <Layers className="h-4 w-4 opacity-80 group-data-[state=active]:opacity-100" />
                          <span className="hidden md:flex md:flex-col md:leading-tight">
                            <span className="text-sm font-medium">
                              Other A/D
                            </span>
                            <span className="text-xs font-normal text-slate-500 group-data-[state=active]:text-white/80">
                              One-off add/deduct
                            </span>
                          </span>
                          <span className="md:hidden text-sm font-medium">
                            Other
                          </span>
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="mt-4 hidden md:block rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-950">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Quick Notes
                      </div>
                      <div className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        Use the left menu to manage all payroll components for
                        this employee. All changes are committed using the
                        shared <span className="font-medium">Save</span> button.
                      </div>
                    </div>
                  </div>

                  {/* Right content */}
                  <div className="min-w-0 overflow-x-hidden">
                    <TabsContent value="wage" className="mt-0">
                      <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-950">
                        <WageTab
                          selectedEmployee={selectedEmployee}
                          wageData={wageData}
                          setWageData={setWageData}
                          salarySchedules={salarySchedules}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="savings" className="mt-0">
                      <div
                        className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-950 ${TABLE_FIT_SCOPE}`}
                      >
                        <SavingsTab
                          selectedEmployee={selectedEmployee}
                          open={open}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="loans" className="mt-0">
                      <div
                        className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-950 ${TABLE_FIT_SCOPE}`}
                      >
                        <LoansTab
                          ui={ui}
                          selectedEmployee={selectedEmployee}
                          loanPanelOpen={loanPanelOpen}
                          setLoanPanelOpen={setLoanPanelOpen}
                          loanDraft={loanDraft}
                          setLoanDraft={setLoanDraft}
                          recomputeLoanDraft={recomputeLoanDraft}
                          editingLoanId={editingLoanId}
                          resetLoanDraft={resetLoanDraft}
                          loanSaving={loanSaving}
                          loanLoading={loanLoading}
                          saveLoan={saveLoan}
                          loans={loans}
                          startEditLoan={startEditLoan}
                          deleteLoan={deleteLoan}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="retro" className="mt-0">
                      <div
                        className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-950 ${TABLE_FIT_SCOPE}`}
                      >
                        <RetroPayTab
                          ui={ui}
                          selectedEmployee={selectedEmployee}
                          cutoffs={cutoffs}
                          cutoffsLoading={cutoffsLoading}
                          ensureCutoffs={() => {
                            if (!cutoffsLoading) void loadCutoffSettings();
                          }}
                          applyCutoffSelection={applyCutoffSelection}
                          retroLoading={retroLoading}
                          retroSaving={retroSaving}
                          retroRows={retroRows}
                          retroFormOpen={retroFormOpen}
                          setRetroFormOpen={setRetroFormOpen}
                          retroDraft={retroDraft}
                          setRetroDraft={setRetroDraft}
                          editingRetroId={editingRetroId}
                          resetRetroDraft={resetRetroDraft}
                          saveRetro={saveRetro}
                          startEditRetro={startEditRetro}
                          deleteRetro={deleteRetro}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="allowance" className="mt-0">
                      <div
                        className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-950 ${TABLE_FIT_SCOPE}`}
                      >
                        <AllowanceTab
                          open={open}
                          selectedEmployee={selectedEmployee}
                          cutoffs={cutoffs}
                          cutoffsLoading={cutoffsLoading}
                          ensureCutoffs={() => {
                            if (!cutoffsLoading) void loadCutoffSettings();
                          }}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="benefits" className="mt-0">
                      <div
                        className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-950 ${TABLE_FIT_SCOPE}`}
                      >
                        <BenefitsTab
                          open={open}
                          selectedEmployee={selectedEmployee}
                          wageData={wageData}
                          setWageData={setWageData}
                          cutoffs={cutoffs}
                          cutoffsLoading={cutoffsLoading}
                          ensureCutoffs={() => {
                            if (!cutoffsLoading) void loadCutoffSettings();
                          }}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="stock" className="mt-0">
                      <div
                        className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-950 ${TABLE_FIT_SCOPE}`}
                      >
                        <StockPurchaseTab
                          open={open}
                          selectedEmployee={selectedEmployee}
                          cutoffs={cutoffs}
                          cutoffsLoading={cutoffsLoading}
                          ensureCutoffs={() => {
                            if (!cutoffsLoading) void loadCutoffSettings();
                          }}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="other" className="mt-0">
                      <div
                        className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-950 ${TABLE_FIT_SCOPE}`}
                      >
                        <OtherADTab
                          ui={ui}
                          selectedEmployee={selectedEmployee}
                          cutoffs={cutoffs}
                          cutoffsLoading={cutoffsLoading}
                          ensureCutoffs={() => {
                            if (!cutoffsLoading) void loadCutoffSettings();
                          }}
                          addLoading={addLoading}
                          addSaving={addSaving}
                          addRows={addRows}
                          addFormOpen={addFormOpen}
                          setAddFormOpen={setAddFormOpen}
                          editingAddId={editingAddId}
                          addDraft={addDraft}
                          setAddDraft={setAddDraft}
                          resetAddDraft={resetAddDraft}
                          saveOtherAddition={saveOtherAddition}
                          startEditOtherAddition={startEditOtherAddition}
                          deleteOtherAddition={deleteOtherAddition}
                          dedLoading={dedLoading}
                          dedSaving={dedSaving}
                          dedRows={dedRows}
                          dedFormOpen={dedFormOpen}
                          setDedFormOpen={setDedFormOpen}
                          editingDedId={editingDedId}
                          dedDraft={dedDraft}
                          setDedDraft={setDedDraft}
                          resetDedDraft={resetDedDraft}
                          saveOtherDeduction={saveOtherDeduction}
                          startEditOtherDeduction={startEditOtherDeduction}
                          deleteOtherDeduction={deleteOtherDeduction}
                          applyCutoffToOtherDraft={applyCutoffToOtherDraft}
                        />
                      </div>
                    </TabsContent>
                  </div>
                </div>
              </Tabs>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t bg-white/95 px-6 py-4 backdrop-blur dark:bg-slate-950/95">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Changes across all tabs are saved together.
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={PAYROLL_OUTLINE}
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  className={`rounded-md px-6 ${PAYROLL_PRIMARY}`}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

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
    </Dialog>
  );
}
