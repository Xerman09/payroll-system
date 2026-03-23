// modules/payroll-run/components/PayrollAdjustStep.tsx
"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import type {
  CutoffSetting,
  Department,
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollSummary,
  ManualEntry,
} from "../types";

import { formatPHP } from "../utils/payroll";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

import { EmployeeDetailsSheet } from "./EmployeeDetailsSheet";
import { // Turbo: Import delete functions
  AddEmployeeAdjustmentsDialog,
  type ManualEntryExt,
} from "./AddEmployeeAdjustmentsDialog"; // Turbo
import { // Turbo
  deleteRetroPay, // Turbo
  deleteCoopSavingsMembership, // Turbo
} from "../providers/payrollAdjustmentsService"; // Turbo

/* ------------------------------ Helpers ------------------------------ */

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type ApiList<T> = { data: T[] };

function apiBase() {
  // same-origin proxy to Directus to avoid CORS
  return "/api/payroll-run";
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = json as Record<string, unknown>;
    throw new Error((err?.error as string) || "Request failed");
  }
  return json as T;
}

async function apiDelete(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE", cache: "no-store" });

  // Proxy returns 204 for Directus deletes
  if (res.status === 204 || res.status === 205) return;

  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = json as Record<string, unknown>;
    throw new Error((err?.error as string) || "Delete failed");
  }
}

type OtherAdditionRow = {
  id: number;
  user_id: number;
  amount: string | number;
  description: string | null;
  cutoff_start: string;
  cutoff_end: string;
  created_date?: string;
};

type OtherDeductionRow = {
  id: number;
  user_id: number;
  amount: string | number;
  type: "SHORTAGE" | "MANUAL";
  description: string | null;
  cutoff_start: string;
  cutoff_end: string;
  created_date?: string;
};

type DrPaymentRow = {
  dr_payment_id: number;
  delivery_receipt_number: string;
  employee_id: number;
  cutoff_from: string;
  cutoff_to: string;
  payroll_ref_no: string | null;
  is_posted_to_payroll: number | boolean;
  payment_date: string;
  amount_paid: string | number;
  payment_method:
    | "PAYROLL_DEDUCTION"
    | "CASH"
    | "CHECK"
    | "BANK_TRANSFER"
    | "OTHERS"
    | string;
  remarks: string | null;
  created_at?: string;
  created_by?: number | null;
};

async function listOtherAdditions(args: {
  userId: number;
  cutoffStart: string;
  cutoffEnd: string;
}): Promise<OtherAdditionRow[]> {
  const sp = new URLSearchParams();
  sp.set("resource", "payroll_other_additions");
  sp.set("filter[user_id][_eq]", String(args.userId));
  sp.set("filter[cutoff_start][_eq]", args.cutoffStart);
  sp.set("filter[cutoff_end][_eq]", args.cutoffEnd);
  sp.set("sort", "-id");
  sp.set("limit", "200");

  const json = await apiGet<ApiList<OtherAdditionRow>>(`${apiBase()}?${sp}`);
  return Array.isArray(json?.data) ? json.data : [];
}

async function listOtherDeductions(args: {
  userId: number;
  cutoffStart: string;
  cutoffEnd: string;
}): Promise<OtherDeductionRow[]> {
  const sp = new URLSearchParams();
  sp.set("resource", "payroll_other_deductions");
  sp.set("filter[user_id][_eq]", String(args.userId));
  sp.set("filter[cutoff_start][_eq]", args.cutoffStart);
  sp.set("filter[cutoff_end][_eq]", args.cutoffEnd);
  sp.set("sort", "-id");
  sp.set("limit", "200");

  const json = await apiGet<ApiList<OtherDeductionRow>>(`${apiBase()}?${sp}`);
  return Array.isArray(json?.data) ? json.data : [];
}

async function listDRPayments(args: {
  employeeId: number;
  cutoffStart: string;
  cutoffEnd: string;
}): Promise<DrPaymentRow[]> {
  const sp = new URLSearchParams();
  sp.set("resource", "dr_payment");
  sp.set("filter[employee_id][_eq]", String(args.employeeId));
  sp.set("filter[cutoff_from][_eq]", args.cutoffStart);
  sp.set("filter[cutoff_to][_eq]", args.cutoffEnd);

  // keep consistent with your policy: DR payments are pulled when PAYROLL_DEDUCTION and not posted
  sp.set("filter[payment_method][_eq]", "PAYROLL_DEDUCTION");
  sp.set("filter[is_posted_to_payroll][_eq]", "0");

  sp.set("sort", "-dr_payment_id");
  sp.set("limit", "200");

  const json = await apiGet<ApiList<DrPaymentRow>>(`${apiBase()}?${sp}`);
  return Array.isArray(json?.data) ? json.data : [];
}

async function deleteOtherAddition(id: number) {
  const sp = new URLSearchParams();
  sp.set("resource", "payroll_other_additions");
  sp.set("id", String(id));
  await apiDelete(`${apiBase()}?${sp}`);
}

async function deleteOtherDeduction(id: number) {
  const sp = new URLSearchParams();
  sp.set("resource", "payroll_other_deductions");
  sp.set("id", String(id));
  await apiDelete(`${apiBase()}?${sp}`);
}

async function deleteDRPayment(drPaymentId: number) {
  const sp = new URLSearchParams();
  sp.set("resource", "dr_payment");
  sp.set("id", String(drPaymentId));
  await apiDelete(`${apiBase()}?${sp}`);
}

function parseDateLike(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function createdSortKey(e: unknown): number {
  const row = e as Record<string, unknown>;
  return (
    parseDateLike(row?.created_date) ||
    parseDateLike(row?.created_at) ||
    0
  );
}

/* ------------------------- Navigation Guard ------------------------- */

type PendingNav =
  | { type: "href"; href: string }
  | { type: "back" }
  | { type: "startOver" }
  | null;

function isSameOriginUrl(href: string) {
  try {
    const u = new URL(href, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function getAnchorFromEventTarget(
  target: EventTarget | null,
): HTMLAnchorElement | null {
  const el = target as HTMLElement | null;
  if (!el) return null;
  return (el.closest?.("a[href]") as HTMLAnchorElement | null) ?? null;
}

/* ------------------------------ Component ------------------------------ */

export function PayrollAdjustStep({
  cutoff,
  department,
  run,
  lines,
  summary,
  holdMap,
  postedMap,
  onToggleHold,
  onRecompute,
  onNext,
}: {
  cutoff: CutoffSetting;
  department: Department | null;
  run: PayrollRunHeader | null;
  lines: PayrollComputedLine[];
  summary: PayrollSummary;
  holdMap: Map<number, boolean>;
  postedMap: Map<number, boolean>;
  onToggleHold: (userId: number) => void;
  onRecompute: () => void;
  onNext: () => void;
}) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [activeUserId, setActiveUserId] = useState<number | null>(null);

  // DB-backed manual entries for the active employee (cutoff-scoped)
  const [manualEntries, setManualEntries] = useState<ManualEntryExt[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Add/Edit dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ManualEntryExt | null>(null);

  // Guard state
  const [isDirty, setIsDirty] = useState(true); // entering Adjust step implies “work in progress”
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingRef = useRef<PendingNav>(null);
  const ignorePopRef = useRef(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return lines;
    return lines.filter((l) => l.employee_name.toLowerCase().includes(s));
  }, [q, lines]);

  const activeLine = useMemo(
    () =>
      activeUserId == null
        ? null
        : (lines.find((l) => l.user_id === activeUserId) ?? null),
    [activeUserId, lines],
  );

  // NOTE: your cutoff has start_date/end_date in your other code
  const cutoffStart = cutoff.start_date;
  const cutoffEnd = cutoff.end_date;

  const refreshManualEntries = useCallback(async () => {
    if (!activeUserId) {
      setManualEntries([]);
      return;
    }

    try {
      setLoadingEntries(true);

      const [adds, deds, drs] = await Promise.all([
        listOtherAdditions({ userId: activeUserId, cutoffStart, cutoffEnd }),
        listOtherDeductions({ userId: activeUserId, cutoffStart, cutoffEnd }),
        listDRPayments({ employeeId: activeUserId, cutoffStart, cutoffEnd }),
      ]);

      const mappedAdds: ManualEntryExt[] = adds.map((r) => ({
        id: r.id,
        type: "EARNING",
        amount: toNumber(r.amount),
        desc: r.description ?? "Manual Addition",
        category: "MANUAL_ADDITION",
        cutoff_start: r.cutoff_start,
        cutoff_end: r.cutoff_end,
        created_date: r.created_date ?? null,
        __source: "ADD",
      }));

      const mappedDeds: ManualEntryExt[] = deds.map((r) => ({
        id: r.id,
        type: "DEDUCTION",
        amount: toNumber(r.amount),
        desc:
          r.description ??
          (r.type === "SHORTAGE" ? "Shortage" : "Manual Deduction"),
        category: r.type,
        other_deduction_type: r.type,
        cutoff_start: r.cutoff_start,
        cutoff_end: r.cutoff_end,
        created_date: r.created_date ?? null,
        __source: "DED",
      }));

      const mappedDR: ManualEntryExt[] = drs.map((r) => ({
        id: r.dr_payment_id,
        type: "DEDUCTION",
        amount: toNumber(r.amount_paid),
        desc: `DR PAYMENT: ${r.delivery_receipt_number}`,
        category: "DR_PAYMENT",
        other_deduction_type: "DR_PAYMENT",
        dr_payment_id: r.dr_payment_id,
        delivery_receipt_number: r.delivery_receipt_number,
        employee_id: r.employee_id,
        cutoff_from: r.cutoff_from,
        cutoff_to: r.cutoff_to,
        payment_date: r.payment_date,
        amount_paid: toNumber(r.amount_paid),
        payment_method: r.payment_method,
        is_posted_to_payroll: r.is_posted_to_payroll,
        payroll_ref_no: r.payroll_ref_no,
        remarks: r.remarks,
        created_at: r.created_at ?? null,
        created_by: r.created_by ?? null,
        __source: "DR",
      }));

      const merged = [...mappedAdds, ...mappedDeds, ...mappedDR].sort(
        (a, b) => {
          const ta = createdSortKey(a);
          const tb = createdSortKey(b);
          if (tb !== ta) return tb - ta;

          const ai = Number(a?.id ?? 0);
          const bi = Number(b?.id ?? 0);
          return bi - ai;
        },
      );

      setManualEntries(merged);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message || "Failed to load employee adjustments");
      setManualEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, [activeUserId, cutoffStart, cutoffEnd]);

  useEffect(() => {
    refreshManualEntries();
  }, [refreshManualEntries]);

  useEffect(() => {
    setManualOpen(false);
    setEditingEntry(null);
  }, [activeUserId]);

  function openAddAdjustment() {
    if (!activeUserId) return;
    setEditingEntry(null);
    setManualOpen(true);
  }

  function openEditAdjustment(entry: ManualEntry) {
    setEditingEntry(entry as ManualEntryExt);
    setManualOpen(true);
  }

  async function deleteAdjustment(entry: ManualEntry) {
    const ext = entry as ManualEntryExt;
    const id = Number(ext?.id);
    const src = ext?.__source;

    if (!id || !src) {
      toast.error("Cannot delete: missing source/id.");
      return;
    }

    const label =
      src === "DR"
        ? "Delete this DR payment record?"
        : src === "RETRO"
          ? "Delete this Retro Pay record?"
          : src === "COOP"
            ? "Delete this Coop Savings record?"
            : "Delete this adjustment?";

    const ok = window.confirm(label);
    if (!ok) return;

    try {
      if (src === "ADD") await deleteOtherAddition(id);
      else if (src === "DED") await deleteOtherDeduction(id);
      else if (src === "DR") await deleteDRPayment(id);
      else if (src === "RETRO") await deleteRetroPay(id);
      else if (src === "COOP") await deleteCoopSavingsMembership(id);

      toast.success("Deleted.");
      await refreshManualEntries();

      setIsDirty(true);
      onRecompute();
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message || "Failed to delete");
    }
  }

  /* ------------------------- Guard: confirm modal ------------------------- */

  const openConfirm = useCallback((pending: PendingNav) => {
    pendingRef.current = pending;
    setConfirmOpen(true);
  }, []);

  const proceedPending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setConfirmOpen(false);

    // allow navigation now
    setIsDirty(false);

    if (!pending) return;

    if (pending.type === "href") {
      const href = pending.href;

      // internal route
      if (href.startsWith("/")) {
        router.push(href);
        return;
      }

      // same-origin absolute -> convert to path
      if (isSameOriginUrl(href)) {
        try {
          const u = new URL(href, window.location.href);
          router.push(u.pathname + u.search + u.hash);
          return;
        } catch {
          // fallback
        }
      }

      // external
      window.location.href = href;
      return;
    }

    if (pending.type === "back") {
      ignorePopRef.current = true;
      history.back();
      return;
    }

    if (pending.type === "startOver") {
      window.dispatchEvent(new CustomEvent("payroll-run:confirm-start-over"));
      return;
    }
  }, [router]);

  const cancelPending = useCallback(() => {
    pendingRef.current = null;
    setConfirmOpen(false);
  }, []);

  /* ------------------------- Guard: refresh/close ------------------------- */
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      // custom modals not allowed on refresh/close; browser will show native confirm
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /* ------------------------- Guard: link clicks ------------------------- */
  useEffect(() => {
    if (!isDirty) return;

    const onDocClick = (e: MouseEvent) => {
      if (!isDirty) return;

      // ignore non-left clicks and modified clicks (new tab/window)
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = getAnchorFromEventTarget(e.target);
      if (!a) return;

      const hrefAttr = a.getAttribute("href") || "";
      if (!hrefAttr || hrefAttr === "#") return;

      // ignore explicit bypass
      if (a.getAttribute("data-no-guard") === "true") return;
      if (a.target === "_blank") return;

      const hrefAbs = a.href || hrefAttr;
      if (!isSameOriginUrl(hrefAbs)) return; // only guard same-origin

      e.preventDefault();
      openConfirm({ type: "href", href: hrefAttr });
    };

    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [isDirty, openConfirm]);

  /* ------------------------- Guard: back/forward ------------------------- */
  useEffect(() => {
    if (!isDirty) return;

    // push a synthetic state so back triggers popstate while we can keep user on page
    try {
      history.pushState({ __payroll_guard: true }, "", window.location.href);
    } catch {
      // ignore
    }

    const onPop = () => {
      if (!isDirty) return;

      if (ignorePopRef.current) {
        ignorePopRef.current = false;
        return;
      }

      // keep user here, then ask
      try {
        history.pushState({ __payroll_guard: true }, "", window.location.href);
      } catch {
        // ignore
      }

      openConfirm({ type: "back" });
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isDirty, openConfirm]);

  /* ------------------------- Guard: Start Over request ------------------------- */
  useEffect(() => {
    if (!isDirty) return;

    const onStartOverRequest = () => {
      openConfirm({ type: "startOver" });
    };

    window.addEventListener(
      "payroll-run:request-start-over",
      onStartOverRequest as EventListener,
    );
    return () =>
      window.removeEventListener(
        "payroll-run:request-start-over",
        onStartOverRequest as EventListener,
      );
  }, [isDirty, openConfirm]);

  /* ------------------------------ UI ------------------------------ */

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Preview & Adjustments</CardTitle>
            <CardDescription>
              Cutoff: {cutoff.start_date} → {cutoff.end_date}{" "}
              ({cutoff.cutoff_type}) • Dept:{" "}
              {department?.name ?? "ALL"}
            </CardDescription>

            {run ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Ref:{" "}
                <span className="font-mono">{run.payroll_ref_no}</span>{" "}
                • Status:{" "}
                <span className="font-semibold">{run.status}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={onRecompute}
              title="If recompute is wired to reload workspace, it will reflect new DB adjustments."
            >
              Recompute
            </Button>
            <Button
              onClick={() => {
                // leaving this step to process means we don't need guard anymore
                setIsDirty(false);
                onNext();
              }}
            >
              Process & Save →
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">
                Headcount
              </div>
              <div className="mt-1 text-2xl font-bold">{summary.headcount}</div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">
                Gross
              </div>
              <div className="mt-1 text-xl font-bold text-primary">
                {formatPHP(summary.total_gross)}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">
                Deductions
              </div>
              <div className="mt-1 text-xl font-bold text-destructive">
                {formatPHP(summary.total_deductions)}
              </div>
            </Card>

            <Card className="p-4 border-l-4 border-l-yellow-400">
              <div className="text-xs font-bold uppercase text-muted-foreground">
                Variance Alerts
              </div>
              <div className="mt-1 text-xl font-bold">
                {summary.variance_alerts}
              </div>
            </Card>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search employee..."
              className="max-w-sm"
            />
            <div className="text-xs text-muted-foreground">
              Hold = exclude from totals and posting
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Status</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">OT</TableHead>
                  <TableHead className="text-right">Holiday</TableHead>
                  <TableHead className="text-right">Rest Day</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.map((l) => {
                  const isHold = Boolean(holdMap.get(l.user_id));
                  const isPosted = Boolean(postedMap.get(l.user_id));
                  return (
                    <TableRow
                      key={l.user_id}
                      className={cn(isHold && "opacity-60")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={isHold}
                            disabled={isPosted}
                            onCheckedChange={() => {
                              if (isPosted) return; // Prevent toggle for posted employees
                              setIsDirty(true);
                              onToggleHold(l.user_id);
                            }}
                          />
                          <div className="text-[11px]">
                            {isPosted ? (
                              <span className="font-bold text-emerald-600">
                                Posted
                              </span>
                            ) : isHold ? (
                              <span className="font-bold text-destructive">
                                HOLD
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-semibold">
                          {l.employee_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {l.position ?? "—"} •{" "}
                          {l.department_name ?? "—"}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono text-sm">
                        {formatPHP(l.basic_pay)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPHP(l.ot_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPHP(l.holiday_pay)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPHP(l.rest_day_amount)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-sm text-destructive">
                        ({formatPHP(l.total_deductions)})
                      </TableCell>

                      <TableCell className="text-right font-mono text-sm font-bold">
                        {formatPHP(l.net_pay)}
                      </TableCell>

                      <TableCell className="text-right">
                        {l.variance_pct == null ? (
                          <Badge variant="secondary">New</Badge>
                        ) : (
                          <span
                            className={cn(
                              "font-mono text-xs",
                              l.variance_flag
                                ? "text-destructive font-bold"
                                : "text-muted-foreground",
                            )}
                          >
                            {Number(l.variance_pct) > 0 ? "+" : ""}
                            {Number(l.variance_pct).toFixed(1)}%
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveUserId(l.user_id)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No employees match your search.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {/* Backdrop blur when sheet is open */}
          {activeUserId != null && (
            <div
              className="fixed inset-0 z-40 backdrop-blur-sm bg-black/30"
              onClick={() => setActiveUserId(null)}
            />
          )}

          {/* Employee Details */}
          <EmployeeDetailsSheet
            open={activeUserId != null}
            line={activeLine}
            manualEntries={manualEntries as ManualEntry[]}
            isPosted={activeUserId != null ? Boolean(postedMap.get(activeUserId)) : false}
            onOpenAdjust={() => openAddAdjustment()}
            onEditEntry={(e) => openEditAdjustment(e)}
            onDeleteEntry={(e) => deleteAdjustment(e)}
            onOpenChange={(v) => {
              if (!v) setActiveUserId(null);
            }}
          />

          {/* Add/Edit dialog */}
          {activeUserId != null ? (
            <AddEmployeeAdjustmentsDialog
              open={manualOpen}
              onOpenChange={setManualOpen}
              userId={activeUserId}
              cutoffStart={cutoffStart}
              cutoffEnd={cutoffEnd}
              createdBy={null}
              editingEntry={editingEntry}
              onSaved={async () => {
                await refreshManualEntries();
                setIsDirty(true);
                await onRecompute();
              }}
            />
          ) : null}

          {activeUserId != null && loadingEntries ? (
            <div className="text-xs text-muted-foreground">
              Loading employee adjustments from DB…
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Confirm leave */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="sm:max-w-[520px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved progress will be lost</AlertDialogTitle>
            <AlertDialogDescription>
              If you continue, the current in-memory work (holds / adjustments
              preview) may be discarded. Continue anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPending}>
              Stay on this page
            </AlertDialogCancel>
            <AlertDialogAction onClick={proceedPending}>
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
