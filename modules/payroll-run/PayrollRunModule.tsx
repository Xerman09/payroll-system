// modules/payroll-run/PayrollRunModule.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  PlayCircle,
  RefreshCcw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  CutoffSetting,
  Department,
  PayrollConfigState,
  PayrollRunHeader,
  PayrollStep,
  PayrollWorkspace,
} from "./types";

import { PayrollStepper } from "./components/PayrollStepper";
import { PayrollConfigStep } from "./components/PayrollConfigStep";
import { PayrollAdjustStep } from "./components/PayrollAdjustStep";
import { PayrollProcessStep } from "./components/PayrollProcessStep";
import { PayrollReviewStep } from "./components/PayrollReviewStep";
import PasswordDialog from "./components/PasswordDialog";

import { getLoggedUser } from "@/lib/auth";
import * as svc from "./providers/payrollRunService";
import * as api from "./providers/payrollApi";
import { formatCutoffLabel } from "./utils/payroll";

const DEFAULT_CONFIG: PayrollConfigState = {
  cutoffId: null,
  departmentId: null, // null = ALL
};

function stepLabel(step: PayrollStep) {
  switch (step) {
    case 1:
      return "Configure";
    case 2:
      return "Adjust";
    case 3:
      return "Processing";
    case 4:
      return "Review";
    default:
      return "Payroll Run";
  }
}

function statusClasses(status?: string | null) {
  const s = String(status ?? "").toUpperCase();
  if (s === "POSTED")
    return "border-emerald-200/60 bg-emerald-50 text-emerald-700";
  if (s === "DRAFT") return "border-amber-200/60 bg-amber-50 text-amber-700";
  return "border-border bg-muted/40 text-muted-foreground";
}

export default function PayrollRunModule() {
  const [step, setStep] = useState<PayrollStep>(1);

  // master data
  const [cutoffs, setCutoffs] = useState<CutoffSetting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  // config
  const [config, setConfig] = useState<PayrollConfigState>(DEFAULT_CONFIG);

  // run header
  const [run, setRun] = useState<PayrollRunHeader | null>(null);

  // loaded workspace inputs
  const [ws, setWs] = useState<PayrollWorkspace | null>(null);
  const [loadingWs, setLoadingWs] = useState(false);

  // hold/exclude
  const [holdMap, setHoldMap] = useState<Map<number, boolean>>(new Map());

  // posted employees (read-only in adjust step)
  const [postedMap, setPostedMap] = useState<Map<number, boolean>>(new Map());


  // password dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // computed register
  const computed = useMemo(() => {
    if (!ws) return null;
    return svc.computeRegister({ ws, holdMap });
  }, [ws, holdMap]);

  const selectedCutoff = useMemo(
    () => cutoffs.find((c) => c.id === config.cutoffId) ?? null,
    [cutoffs, config.cutoffId],
  );

  const selectedDepartment = useMemo(
    () =>
      config.departmentId == null
        ? null
        : (departments.find((d) => d.id === config.departmentId) ?? null),
    [departments, config.departmentId],
  );

  useEffect(() => {
    (async () => {
      try {
        setLoadingMaster(true);
        const [c, d] = await Promise.all([
          svc.listCutoffs(),
          svc.listDepartments(),
        ]);
        setCutoffs(c);
        setDepartments(d);

        // preselect first cutoff if none
        if (c.length && config.cutoffId == null) {
          setConfig((p) => ({ ...p, cutoffId: c[0].id }));
        }
      } catch (e: unknown) {
        const err = e as Error;
        toast.error(err?.message || "Failed to load payroll masters");
      } finally {
        setLoadingMaster(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinueClick = () => {
    if (!selectedCutoff) {
      toast.error("Please select a cutoff.");
      return;
    }
    setPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async (passwordInput: string) => {
    try {
      const logged = getLoggedUser();
      if (!logged) {
        toast.error("User not logged in.");
        return;
      }

      // Secure backend verification
      await api.verifyPassword(Number(logged.user_id), passwordInput);

      const ts = new Date().toISOString();
      const deptName = selectedDepartment ? selectedDepartment.name : "All Departments";
      const cutoffLabel = selectedCutoff ? formatCutoffLabel(selectedCutoff) : "Unknown";
      const remarks = `Accessed payroll run for ${cutoffLabel} - ${deptName} at ${ts}`;
      
      await api.logPayrollRunAccess(
        logged.user_id as number,
        selectedCutoff!.id,
        config.departmentId,
        remarks
      );

      setPasswordDialogOpen(false);
      await loadOrCreateRunAndWorkspace();
    } catch (e: unknown) {
      console.error(e);
      alert("Error verifying password. Try again.");
    }
  };

  async function loadOrCreateRunAndWorkspace() {
    if (!selectedCutoff) {
      toast.error("Please select a cutoff.");
      return;
    }

    try {
      setLoadingWs(true);

      // 1) Load existing draft run (if exists)
      const existing = await svc.findExistingDraftRun({
        cutoffId: selectedCutoff.id,
        departmentId: config.departmentId,
        cutoffStart: selectedCutoff.start_date,
        cutoffEnd: selectedCutoff.end_date,
      });

      let activeRun = existing;

      // 2) If none, create DRAFT run
      if (!activeRun) {
        const refNo = svc.generatePayrollRefNo({
          cutoff: selectedCutoff,
          department: selectedDepartment,
        });

        activeRun = await svc.createDraftRun({
          cutoff: selectedCutoff,
          departmentId: config.departmentId,
          createdBy: 1, // TODO: replace with logged-in user id
          payrollRefNo: refNo,
        });
      }

      setRun(activeRun);

      // 3) Load workspace inputs for computation
      const workspace = await svc.loadWorkspace({
        cutoff: selectedCutoff,
        departmentId: config.departmentId,
      });

      setWs(workspace);

      // 4) Load persisted hold and posted status if this is an existing run
      if (activeRun && activeRun.payroll_run_id) {
        const persistedHold = await svc.loadPersistedHoldMap(activeRun.payroll_run_id);
        setHoldMap(persistedHold);

        // If the run is POSTED, load posted employees (on_hold != 1) for read-only display
        if (String(activeRun.status).toUpperCase() === "POSTED") {
          const posted = await svc.loadPostedEmployeesMap(activeRun.payroll_run_id);
          setPostedMap(posted);
        } else {
          setPostedMap(new Map());
        }
      } else {
        // New run - reset both maps
        setHoldMap(new Map());
        setPostedMap(new Map());
      }

      setStep(2);

    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message || "Failed to load payroll workspace");
    } finally {
      setLoadingWs(false);
    }
  }

  function toggleHold(userId: number) {
    setHoldMap((prev) => {
      const next = new Map(prev);
      next.set(userId, !Boolean(next.get(userId)));
      return next;
    });
  }

  async function processAndSave() {
    if (!run || !ws || !computed) return;

    try {
      setStep(3);

      // 1) Persist computed lines to payroll_run_employee
      await svc.saveLines({
        payrollRunId: run.payroll_run_id,
        cutoff: ws.cutoff,
        lines: computed.lines,
      });

      // 2) Persist header totals
      await svc.updateRunTotals({
        payrollRunId: run.payroll_run_id,
        summary: computed.summary,
      });

      setStep(4);
      toast.success("Payroll computed and saved (DRAFT lines).");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message || "Failed to process payroll");
      setStep(2);
    }
  }

  async function postPayroll() {
    if (!run) return;

    try {
      await svc.postRun({
        payrollRunId: run.payroll_run_id,
        postedBy: 1, // TODO: auth
      });



      toast.success("Payroll POSTED successfully.");
      setRun((p) => (p ? { ...p, status: "POSTED" } : p));
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message || "Failed to post payroll");
    }
  }

  const startOver = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setRun(null);
    setWs(null);
    setHoldMap(new Map());
    setPostedMap(new Map());
    setStep(1);
  }, []);


  useEffect(() => {
    const handler = () => startOver();
    window.addEventListener("payroll-run:confirm-start-over", handler as EventListener);
    return () =>
      window.removeEventListener(
        "payroll-run:confirm-start-over",
        handler as EventListener,
      );
  }, [startOver]);

  const busy = loadingMaster || loadingWs || step === 3;
  const canPost = Boolean(run) && run?.status !== "POSTED" && step === 4;

  if (loadingMaster) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-7xl space-y-6 px-2 pb-10 sm:px-4">
          <Card className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-[200px]" />
              <Skeleton className="h-4 w-[400px]" />
              <div className="flex gap-2 pt-2">
                 <Skeleton className="h-6 w-[80px] rounded-lg" />
                 <Skeleton className="h-6 w-[120px] rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end pt-4">
               <Skeleton className="h-10 w-[120px]" />
            </div>
          </Card>
          
          <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                 <div className="space-y-2">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-3 w-[180px]" />
                 </div>
                 <div className="flex gap-2">
                    <Skeleton className="h-6 w-[100px] rounded-full" />
                    <Skeleton className="h-6 w-[100px] rounded-full" />
                 </div>
              </div>
              <div className="flex justify-between px-10">
                 <Skeleton className="h-10 w-10 rounded-full" />
                 <Skeleton className="h-10 w-10 rounded-full" />
                 <Skeleton className="h-10 w-10 rounded-full" />
                 <Skeleton className="h-10 w-10 rounded-full" />
              </div>
          </Card>

           <Card className="h-[400px] p-6">
              <div className="space-y-6">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-[200px] w-full" />
              </div>
           </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-2 pb-10 sm:px-4">
        {/* Header / Hero */}
        <Card className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/60 via-transparent to-muted/30" />
          <div className="relative p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Payroll Run
                  </h1>

                  <span className="rounded-full border bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
                    {stepLabel(step)}
                  </span>

                  {run ? (
                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-xs font-medium",
                        statusClasses(run.status),
                      ].join(" ")}
                      title="Payroll run status"
                    >
                      {String(run.status ?? "—")}
                    </span>
                  ) : null}
                </div>

                <p className="max-w-2xl text-sm text-muted-foreground">
                  Data-driven payroll register using Attendance, Holidays,
                  Manual Entries, and Wage Profiles.
                </p>

                {run ? (
                  <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                    <span className="rounded-lg border bg-background/70 px-2 py-1">
                      Ref:{" "}
                      <span className="font-mono text-foreground">
                        {run.payroll_ref_no}
                      </span>
                    </span>
                    {selectedCutoff ? (
                      <span className="rounded-lg border bg-background/70 px-2 py-1">
                        Cutoff:{" "}
                        <span className="font-medium text-foreground">
                          {formatCutoffLabel(selectedCutoff)}
                        </span>
                      </span>
                    ) : null}
                    <span className="rounded-lg border bg-background/70 px-2 py-1">
                      Department:{" "}
                      <span className="font-medium text-foreground">
                        {selectedDepartment ? selectedDepartment.name : "None selected"}
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    // ✅ Trigger shadcn AlertDialog when user is in Adjust step.
                    if (step === 2) {
                      window.dispatchEvent(
                        new CustomEvent("payroll-run:request-start-over"),
                      );
                      return;
                    }
                    startOver();
                  }}
                  disabled={busy}
                  className="gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Start Over
                </Button>

                {step === 4 ? (
                  <Button
                    onClick={postPayroll}
                    disabled={!canPost}
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Post Payroll
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        {/* Stepper */}
        <Card className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold">Workflow</div>
              <div className="text-xs text-muted-foreground">
                Configure, adjust, compute, then review and post.
              </div>
            </div>

            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2 py-1">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Draft-safe
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2 py-1">
                <PlayCircle className="h-3.5 w-3.5" />
                Data-driven
              </span>
            </div>
          </div>

          <PayrollStepper activeStep={step} />
        </Card>

        {/* Password Dialog */}
        <PasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          onSubmit={handlePasswordSubmit}
        />

        {/* Step body */}
        <div className="space-y-6">
          {step === 1 ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <div className="p-4 sm:p-6">
                <PayrollConfigStep
                  loading={loadingMaster || loadingWs}
                  config={config}
                  cutoffs={cutoffs}
                  departments={departments}
                  onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
                  onNext={handleContinueClick}
                />
              </div>
            </Card>
          ) : null}

          {step === 2 && ws && computed ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <div className="p-4 sm:p-6">
                <PayrollAdjustStep
                  cutoff={ws.cutoff}
                  department={ws.department}
                  run={run}
                  lines={computed.lines}
                  summary={computed.summary}
                  holdMap={holdMap}
                  postedMap={postedMap}
                  onToggleHold={toggleHold}
                  onRecompute={async () => {
                    try {
                      const updatedWorkspace = await svc.loadWorkspace({
                        cutoff: selectedCutoff!,
                        departmentId: config.departmentId,
                      });
                      setWs(updatedWorkspace);
                      toast.success("Payroll updated with latest adjustments.");
                    } catch (e: unknown) {
                      const err = e as Error;
                      toast.error(
                        err?.message || "Failed to reload payroll data",
                      );
                    }
                  }}
                  onNext={processAndSave}
                />
              </div>
            </Card>
          ) : null}

          {step === 3 ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <div className="p-4 sm:p-6">
                <PayrollProcessStep />
              </div>
            </Card>
          ) : null}

          {step === 4 && computed ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <div className="p-4 sm:p-6">
                <PayrollReviewStep
                  run={run}
                  rows={computed.lines}
                  summary={computed.summary}
                  onBackToAdjust={() => setStep(2)}
                  onStartOver={startOver}
                  onPost={postPayroll}
                />
              </div>
            </Card>
          ) : null}
        </div>

        {/* Notes */}
        <Card className="rounded-2xl border bg-card shadow-sm">
          <div className="p-4 sm:p-6">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold">Version notes</div>
                  <div className="text-xs text-muted-foreground">
                    Implementation details and current assumptions.
                  </div>
                </div>
                <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground group-open:hidden">
                  Show
                </span>
                <span className="hidden rounded-full border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground group-open:inline-flex">
                  Hide
                </span>
              </summary>

              <div className="mt-4 rounded-xl border bg-muted/20 p-4">
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>
                    Holiday/Rest Day premiums follow your finalized rules
                    (Regular: entitled/worked; Special: +30%; Sunday: +30%).
                  </li>
                  <li>
                    Night differential uses placeholder logic until{" "}
                    <code className="rounded bg-background px-1 py-0.5 text-xs text-foreground">
                      attendance_approval.night_diff_minutes
                    </code>{" "}
                    exists.
                  </li>
                  <li>
                    Government contributions are manual values split 50/50 per
                    cutoff.
                  </li>
                  <li>
                    Shortage deductions are encoded in{" "}
                    <code className="rounded bg-background px-1 py-0.5 text-xs text-foreground">
                      payroll_other_deductions
                    </code>{" "}
                    (category=SHORTAGE).
                  </li>
                </ul>
              </div>
            </details>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
