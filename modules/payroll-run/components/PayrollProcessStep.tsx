"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Play,
  RefreshCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/**
 * PayrollProcessStep
 * - This file exists to resolve: "Can't resolve './components/PayrollProcessStep'"
 * - Kept deliberately tolerant (props: any) so it won't TypeScript-break if your
 *   PayrollRunModule passes different props than expected.
 */
export function PayrollProcessStep(props: any) {
  const [localBusy, setLocalBusy] = React.useState(false);
  const [localProgress, setLocalProgress] = React.useState<number>(0);

  const busy: boolean = Boolean(
    props?.isProcessing ?? props?.busy ?? localBusy,
  );

  // Try to detect a process handler from whatever the parent might be passing.
  const processFn: undefined | (() => Promise<any>) =
    props?.onProcess ??
    props?.onRun ??
    props?.onGenerate ??
    props?.processPayroll ??
    props?.process ??
    props?.runProcess ??
    props?.handleProcess;

  const status: string =
    props?.run?.status ??
    props?.status ??
    (props?.processed ? "PROCESSED" : props?.posted ? "POSTED" : "DRAFT");

  const headcount: number | undefined =
    props?.run?.headcount ?? props?.summary?.headcount ?? props?.headcount;
  const totalGross: number | string | undefined =
    props?.run?.total_gross ?? props?.summary?.total_gross ?? props?.totalGross;
  const totalNet: number | string | undefined =
    props?.run?.total_net ?? props?.summary?.total_net ?? props?.totalNet;
  const payrollRefNo: string | undefined =
    props?.run?.payroll_ref_no ?? props?.payroll_ref_no ?? props?.payrollRefNo;

  const canProcess = status === "DRAFT" || status === "VOID";

  async function handleProcess() {
    if (!processFn) {
      // If parent didn't wire a real handler yet, simulate a process so UI remains usable.
      setLocalBusy(true);
      setLocalProgress(5);

      try {
        for (const p of [15, 30, 45, 60, 75, 90, 100]) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 180));
          setLocalProgress(p);
        }
        toast.success("Payroll processing simulation completed.");
      } catch {
        toast.error("Processing failed.");
      } finally {
        setTimeout(() => setLocalProgress(0), 350);
        setLocalBusy(false);
      }
      return;
    }

    try {
      setLocalBusy(true);
      setLocalProgress(20);
      await processFn();
      setLocalProgress(100);
      toast.success("Payroll processed successfully.");
    } catch (e: any) {
      toast.error(e?.message || "Payroll processing failed.");
    } finally {
      setTimeout(() => setLocalProgress(0), 350);
      setLocalBusy(false);
    }
  }

  const badgeVariant =
    status === "POSTED"
      ? "default"
      : status === "PROCESSED"
        ? "secondary"
        : status === "VOID"
          ? "destructive"
          : "outline";

  return (
    <div className="space-y-4">
      <Card className="border-muted/60 shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Process Payroll</CardTitle>
              <CardDescription>
                Finalize computation and generate employee rows (uses
                payroll_run + payroll_run_employee items).
              </CardDescription>
            </div>
            <Badge variant={badgeVariant as any} className="shrink-0">
              {status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">
                Payroll Ref No
              </div>
              <div className="mt-1 text-sm font-medium">
                {payrollRefNo || "—"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Headcount</div>
              <div className="mt-1 text-sm font-medium">
                {typeof headcount === "number" ? headcount : "—"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total Gross</div>
              <div className="mt-1 text-sm font-medium">
                {totalGross ?? "—"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total Net</div>
              <div className="mt-1 text-sm font-medium">{totalNet ?? "—"}</div>
            </div>
          </div>

          {/* Progress */}
          {(busy || localProgress > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Processing</span>
                <span>{localProgress}%</span>
              </div>
              <Progress value={localProgress} />
            </div>
          )}

          {/* Guidance */}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-start gap-2">
              {canProcess ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <div className="font-medium">What happens here</div>
                <ul className="list-disc pl-4 text-muted-foreground">
                  <li>
                    Create/update a <code>payroll_run</code> record, then
                    generate per-employee rows in{" "}
                    <code>payroll_run_employee</code>.
                  </li>
                  <li>
                    Any lookups typically come from <code>user</code>,{" "}
                    <code>department</code>, and <code>holiday_calendar</code>.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {processFn ? (
                <span>Ready to process using the parent-wired handler.</span>
              ) : (
                <span>
                  No process handler wired yet. Button will run a safe UI
                  simulation (won’t call the API).
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => props?.onRefresh?.()}
                disabled={busy || !props?.onRefresh}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>

              <Button
                type="button"
                onClick={handleProcess}
                disabled={busy || (!canProcess && !!processFn)}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Process Payroll
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
