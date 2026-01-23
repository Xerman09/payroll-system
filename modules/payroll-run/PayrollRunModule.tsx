"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import type {
  CutoffSetting,
  Department,
  PayrollConfigState,
  PayrollComputedLine,
  PayrollRunHeader,
  PayrollStep,
  PayrollWorkspace,
} from "./types";

import { PayrollStepper } from "./components/PayrollStepper";
import { PayrollConfigStep } from "./components/PayrollConfigStep";
import { PayrollAdjustStep } from "./components/PayrollAdjustStep";
import { PayrollProcessStep } from "./components/PayrollProcessStep";
import { PayrollReviewStep } from "./components/PayrollReviewStep";

import * as svc from "./providers/payrollRunService";

const DEFAULT_CONFIG: PayrollConfigState = {
  cutoffId: null,
  departmentId: null, // null = ALL
};

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
        if (c.length && config.cutoffId == null)
          setConfig((p) => ({ ...p, cutoffId: c[0].id }));
      } catch (e: any) {
        toast.error(e?.message || "Failed to load payroll masters");
      } finally {
        setLoadingMaster(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // 4) reset hold map
      setHoldMap(new Map());

      setStep(2);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load payroll workspace");
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

      // persist lines
      await svc.saveLines({
        payrollRunId: run.payroll_run_id,
        cutoff: ws.cutoff,
        lines: computed.lines,
      });

      // persist header totals
      await svc.updateRunTotals({
        payrollRunId: run.payroll_run_id,
        summary: computed.summary,
      });

      // optionally mark PROCESSED
      // await patch payroll_run -> status PROCESSED

      setStep(4);
      toast.success("Payroll computed and saved (DRAFT lines).");
    } catch (e: any) {
      toast.error(e?.message || "Failed to process payroll");
      setStep(2);
    }
  }

  async function postPayroll() {
    if (!run) return;

    try {
      await svc.postRun({
        payrollRunId: run.payroll_run_id,
        postedBy: 1 /* TODO: auth */,
      });
      toast.success("Payroll POSTED successfully.");
      // refresh run
      setRun((p) => (p ? { ...p, status: "POSTED" } : p));
    } catch (e: any) {
      toast.error(e?.message || "Failed to post payroll");
    }
  }

  function startOver() {
    setConfig(DEFAULT_CONFIG);
    setRun(null);
    setWs(null);
    setHoldMap(new Map());
    setStep(1);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Payroll Run
            </h1>
            <div className="text-sm text-muted-foreground">
              Data-driven payroll register using Attendance, Holidays, Manual
              Entries, and Wage Profiles.
            </div>
            {run ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Ref: <span className="font-mono">{run.payroll_ref_no}</span> •
                Status: <span className="font-semibold">{run.status}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={startOver} disabled={step === 3}>
              Start Over
            </Button>
            {step === 4 ? (
              <Button
                onClick={postPayroll}
                disabled={!run || run.status === "POSTED"}
              >
                Post Payroll
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="p-6">
          <PayrollStepper activeStep={step} />
        </Card>

        {step === 1 ? (
          <PayrollConfigStep
            loading={loadingMaster || loadingWs}
            config={config}
            cutoffs={cutoffs}
            departments={departments}
            onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
            onNext={loadOrCreateRunAndWorkspace}
          />
        ) : null}

        {step === 2 && ws && computed ? (
          <PayrollAdjustStep
            cutoff={ws.cutoff}
            department={ws.department}
            run={run}
            lines={computed.lines}
            summary={computed.summary}
            holdMap={holdMap}
            onToggleHold={toggleHold}
            onRecompute={async () => {
              // Reload workspace to get updated manual entries
              try {
                const updatedWorkspace = await svc.loadWorkspace({
                  cutoff: selectedCutoff!,
                  departmentId: config.departmentId,
                });
                setWs(updatedWorkspace);
                toast.success("Payroll updated with latest adjustments.");
              } catch (e: any) {
                toast.error(e?.message || "Failed to reload payroll data");
              }
            }}
            onNext={processAndSave}
          />
        ) : null}

        {step === 3 ? <PayrollProcessStep /> : null}

        {step === 4 && computed ? (
          <PayrollReviewStep
            run={run}
            rows={computed.lines}
            summary={computed.summary}
            onBackToAdjust={() => setStep(2)}
            onStartOver={startOver}
            onPost={postPayroll}
          />
        ) : null}

        <Card className="p-4 text-xs text-muted-foreground">
          Version-1 notes:
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Holiday/Rest Day premiums follow your finalized rules (Regular:
              entitled/worked; Special: +30%; Sunday: +30%).
            </li>
            <li>
              Night differential uses placeholder logic until{" "}
              <code>attendance_approval.night_diff_minutes</code> exists.
            </li>
            <li>
              Government contributions are manual values split 50/50 per cutoff.
            </li>
            <li>
              Shortage deductions are encoded in payroll_other_deductions
              (category=SHORTAGE).
            </li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  );
}
