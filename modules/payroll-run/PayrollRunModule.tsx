// modules/payroll-run/PayrollRunModule.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  CutoffSetting,
  Department,
  ManualEntry,
  ManualEntryType,
  PayrollConfigState,
  PayrollRunHeader,
  PayrollStep,
  PayrollWorkspace,
} from "./types";

import { PayrollAdjustStep } from "./components/PayrollAdjustStep";
import * as svc from "./providers/payrollRunService";

const DEFAULT_CONFIG: PayrollConfigState = {
  cutoffId: null,
  departmentId: null,
};

export default function PayrollRunModule() {
  const [step, setStep] = useState<PayrollStep>(1);

  const [cutoffs, setCutoffs] = useState<CutoffSetting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  const [config, setConfig] = useState<PayrollConfigState>(DEFAULT_CONFIG);

  const [run, setRun] = useState<PayrollRunHeader | null>(null);

  const [ws, setWs] = useState<PayrollWorkspace | null>(null);
  const [loadingWs, setLoadingWs] = useState(false);

  const [holdMap, setHoldMap] = useState<Map<number, boolean>>(new Map());

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
        if (c.length && config.cutoffId == null) {
          setConfig((p) => ({ ...p, cutoffId: c[0].id }));
        }
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

      const existing = await svc.findExistingDraftRun({
        cutoffId: selectedCutoff.id,
        departmentId: config.departmentId,
      });

      let activeRun = existing;

      if (!activeRun) {
        const refNo = svc.generatePayrollRefNo({
          cutoff: selectedCutoff,
          department: selectedDepartment,
        });
        activeRun = await svc.createDraftRun({
          cutoff: selectedCutoff,
          departmentId: config.departmentId,
          createdBy: 1,
          payrollRefNo: refNo,
        });
      }

      setRun(activeRun);

      const workspace = await svc.loadWorkspace({
        cutoff: selectedCutoff,
        departmentId: config.departmentId,
      });

      setWs(workspace);
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

  function upsertManualEntryLocal(userId: number, entry: ManualEntry) {
    setWs((prev) => {
      if (!prev) return prev;

      const map = new Map(prev.manualEntries);
      const list = [...(map.get(userId) ?? [])];

      const idx = entry.id ? list.findIndex((x) => x.id === entry.id) : -1;
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);

      map.set(userId, list);
      return { ...prev, manualEntries: map };
    });
  }

  function removeManualEntryLocal(userId: number, entryId: number) {
    setWs((prev) => {
      if (!prev) return prev;

      const map = new Map(prev.manualEntries);
      const list = [...(map.get(userId) ?? [])].filter((x) => x.id !== entryId);

      map.set(userId, list);
      return { ...prev, manualEntries: map };
    });
  }

  async function createManualEntryUI(args: {
    userId: number;
    type: ManualEntryType;
    desc: string;
    amount: number;
    category?: string | null;
  }) {
    if (!ws) return;

    const created = await svc.createManualEntry({
      cutoff: ws.cutoff,
      userId: args.userId,
      type: args.type,
      desc: args.desc,
      amount: args.amount,
      category: args.category ?? null,
      createdBy: 1,
    });

    upsertManualEntryLocal(args.userId, created);
  }

  async function updateManualEntryUI(args: {
    userId: number;
    entryId: number;
    type: ManualEntryType;
    desc: string;
    amount: number;
    category?: string | null;
  }) {
    if (!ws) return;

    const existing = (ws.manualEntries.get(args.userId) ?? []).find(
      (x) => x.id === args.entryId,
    );
    const oldType = existing?.type ?? args.type;
    const nextCategory = args.category ?? existing?.category ?? null;

    if (oldType !== args.type) {
      await svc.deleteManualEntry({ entryId: args.entryId, type: oldType });
      removeManualEntryLocal(args.userId, args.entryId);

      const created = await svc.createManualEntry({
        cutoff: ws.cutoff,
        userId: args.userId,
        type: args.type,
        desc: args.desc,
        amount: args.amount,
        category: nextCategory,
        createdBy: 1,
      });

      upsertManualEntryLocal(args.userId, created);
      return;
    }

    await svc.updateManualEntry({
      entryId: args.entryId,
      type: args.type,
      desc: args.desc,
      amount: args.amount,
      category: nextCategory,
    });

    upsertManualEntryLocal(args.userId, {
      id: args.entryId,
      cutoff_id: ws.cutoff.id,
      user_id: args.userId,
      type: args.type,
      desc: args.desc,
      amount: args.amount,
      category: nextCategory,
    });
  }

  async function deleteManualEntryUI(args: {
    userId: number;
    entryId: number;
    type: ManualEntryType;
  }) {
    if (!ws) return;
    await svc.deleteManualEntry({ entryId: args.entryId, type: args.type });
    removeManualEntryLocal(args.userId, args.entryId);
  }

  async function createDRPaymentUI(args: {
    userId: number;
    desc: string;
    amount: number;
  }) {
    if (!ws) return;

    const entry = await svc.createDRPaymentDeduction({
      cutoff: ws.cutoff,
      userId: args.userId,
      drNo: args.desc,
      amount: args.amount,
      createdBy: 1,
    });

    upsertManualEntryLocal(args.userId, entry);
  }

  // ✅ NEW: update DR payment
  async function updateDRPaymentUI(args: {
    userId: number;
    entryId: number; // negative id in UI
    drReceiptNo: string;
    amount: number;
  }) {
    if (!ws) return;

    const drPaymentId = Math.abs(args.entryId);
    await svc.updateDRPaymentDeduction({
      drPaymentId,
      drReceiptNo: args.drReceiptNo,
      amount: args.amount,
    });

    // keep the same negative id in UI
    upsertManualEntryLocal(args.userId, {
      id: args.entryId,
      cutoff_id: ws.cutoff.id,
      user_id: args.userId,
      type: "DEDUCTION",
      desc: `DR Payment: ${String(args.drReceiptNo ?? "").trim()}`,
      amount: args.amount,
      category: "DR_PAYMENT",
    });
  }

  // ✅ NEW: delete DR payment
  async function deleteDRPaymentUI(args: { userId: number; entryId: number }) {
    if (!ws) return;

    const drPaymentId = Math.abs(args.entryId);
    await svc.deleteDRPaymentDeduction({ drPaymentId });

    // remove using the negative id
    removeManualEntryLocal(args.userId, args.entryId);
  }

  async function createOtherDeductionUI(args: {
    userId: number;
    type: "MANUAL" | "SHORTAGE";
    desc: string;
    amount: number;
  }) {
    await createManualEntryUI({
      userId: args.userId,
      type: "DEDUCTION",
      desc: args.desc,
      amount: args.amount,
      category: args.type,
    });
  }

  function recomputeNow() {
    setWs((prev) => (prev ? { ...prev } : prev));
  }

  async function processAndSave() {
    if (!run || !ws || !computed) {
      toast.error("Missing payroll data.");
      return;
    }

    try {
      await svc.updateRunTotals({
        payrollRunId: run.payroll_run_id,
        summary: computed.summary,
      });

      toast.success("Totals updated. Ready to post.");
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message || "Failed to process payroll");
    }
  }

  async function postPayroll() {
    if (!run || !ws || !computed) return;

    try {
      await svc.postRun({ payrollRunId: run.payroll_run_id, postedBy: 1 });

      const employeeIds = computed.lines
        .filter((l) => !Boolean((l as any).on_hold))
        .map((l) => Number(l.user_id))
        .filter((x) => Number.isFinite(x) && x > 0);

      await svc.postDRPaymentsToPayroll({
        cutoff: ws.cutoff,
        payrollRefNo: run.payroll_ref_no,
        employeeIds,
      });

      toast.success("Payroll posted.");
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message || "Failed to post payroll");
    }
  }

  return (
    <DashboardLayout title="Payroll Run">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Payroll Run</CardTitle>
            <CardDescription>
              Configure cutoff and department, then add adjustments.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Cutoff</Label>
                <Select
                  value={config.cutoffId == null ? "" : String(config.cutoffId)}
                  onValueChange={(v) =>
                    setConfig((p) => ({ ...p, cutoffId: v ? Number(v) : null }))
                  }
                  disabled={loadingMaster}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cutoff" />
                  </SelectTrigger>
                  <SelectContent>
                    {cutoffs.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.start_date} → {c.end_date} ({c.cutoff_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={
                    config.departmentId == null
                      ? "ALL"
                      : String(config.departmentId)
                  }
                  onValueChange={(v) =>
                    setConfig((p) => ({
                      ...p,
                      departmentId: v === "ALL" ? null : Number(v),
                    }))
                  }
                  disabled={loadingMaster}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ALL</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={loadOrCreateRunAndWorkspace}
                  disabled={loadingWs || !selectedCutoff}
                >
                  {loadingWs ? "Loading..." : "Load Workspace"}
                </Button>
              </div>
            </div>

            {run ? (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  Ref: <span className="font-mono">{run.payroll_ref_no}</span> •
                  Status: <span className="font-semibold">{run.status}</span>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {step === 2 && ws && computed ? (
          <PayrollAdjustStep
            cutoff={ws.cutoff}
            department={ws.department}
            run={run}
            lines={computed.lines}
            summary={computed.summary}
            holdMap={holdMap}
            manualEntriesMap={ws.manualEntries}
            onToggleHold={toggleHold}
            onCreateManualEntry={async (args) => {
              await createManualEntryUI(args);
              recomputeNow();
            }}
            onUpdateManualEntry={async (args) => {
              await updateManualEntryUI(args);
              recomputeNow();
            }}
            onDeleteManualEntry={async (args) => {
              await deleteManualEntryUI(args);
              recomputeNow();
            }}
            onCreateDrPayment={async ({ userId, desc, amount }) => {
              await createDRPaymentUI({ userId, desc, amount });
              recomputeNow();
            }}
            onUpdateDrPayment={async ({
              userId,
              entryId,
              drReceiptNo,
              amount,
            }) => {
              await updateDRPaymentUI({ userId, entryId, drReceiptNo, amount });
              recomputeNow();
            }}
            onDeleteDrPayment={async ({ userId, entryId }) => {
              await deleteDRPaymentUI({ userId, entryId });
              recomputeNow();
            }}
            onCreateOtherDeduction={async ({ userId, type, desc, amount }) => {
              await createOtherDeductionUI({ userId, type, desc, amount });
              recomputeNow();
            }}
            onRecompute={recomputeNow}
            onNext={processAndSave}
          />
        ) : null}

        {step === 3 && ws && computed ? (
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Confirm totals and post payroll.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back to Adjustments
              </Button>
              <Button onClick={postPayroll}>Post Payroll</Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
