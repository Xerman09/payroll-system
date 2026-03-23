// modules/payroll-run/components/PayrollConfigStep.tsx
"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Building2,
  CalendarDays,
  ArrowRight,
} from "lucide-react";

import type { CutoffSetting, Department, PayrollConfigState } from "../types";
import { formatCutoffLabel } from "../utils/payroll";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  loading: boolean;
  config: PayrollConfigState;
  cutoffs: CutoffSetting[];
  departments: Department[];
  onChange: (patch: Partial<PayrollConfigState>) => void;
  onNext: () => void;
};

function normalizeText(v: unknown) {
  return String(v ?? "").trim();
}


function cutoffRangeHint(c: CutoffSetting) {
  // optional: show start/end if present (won't break if absent)
  const anyC = c as unknown as Record<string, unknown>;
  const a = normalizeText(
    c.start_date ?? anyC.cutoff_start ?? anyC.date_from,
  );
  const b = normalizeText(c.end_date ?? anyC.cutoff_end ?? anyC.date_to);
  if (!a && !b) return "";
  if (a && b) return `${a} → ${b}`;
  return a || b;
}

function deptLabel(d: Department) {
  const anyD = d as unknown as Record<string, unknown>;
  return (
    normalizeText(d.name) ||
    normalizeText(anyD.department_name) ||
    normalizeText(anyD.dept_name) ||
    `Department #${String(d.id ?? "")}`
  );
}

export function PayrollConfigStep({
  loading,
  config,
  cutoffs,
  departments,
  onChange,
  onNext,
}: Props) {
  const selectedCutoff = React.useMemo(
    () => cutoffs.find((c) => c.id === config.cutoffId) ?? null,
    [cutoffs, config.cutoffId],
  );

  const selectedDepartment = React.useMemo(() => {
    if (config.departmentId == null) return null;
    return departments.find((d) => d.id === config.departmentId) ?? null;
  }, [departments, config.departmentId]);

  const [openCutoff, setOpenCutoff] = React.useState(false);
  const [openDept, setOpenDept] = React.useState(false);

  const cutoffText = selectedCutoff
    ? formatCutoffLabel(selectedCutoff)
    : "Select cutoff…";
  const deptText = selectedDepartment
    ? deptLabel(selectedDepartment)
    : "Select department…";

  const canProceed = Boolean(config.cutoffId) && Boolean(config.departmentId);

  // Show modal loader only if we are loading but already have data (meaning "Continue" was pressed)
  // If we don't have cutoffs yet, we use skeletons.
  const showModalLoader = loading && cutoffs.length > 0;

  return (
    <div className="space-y-6">
      <Dialog open={showModalLoader} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" showCloseButton={false}>
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
              </div>
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-bold tracking-tight">Initializing Workspace</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Please wait while we prepare the payroll data and adjustments.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top header */}
      <div className="flex flex-col gap-1">
        <div className="text-base font-semibold tracking-tight">
          Configuration
        </div>
        <div className="text-sm text-muted-foreground">
          Choose the cutoff and department for this payroll run.
        </div>
      </div>

      {/* Two modern pickers */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cutoff */}
        <Card className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Cutoff</Label>
              <div className="text-xs text-muted-foreground">
                Required. Used for attendance window, holidays, and rates.
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full">
              Required
            </Badge>
          </div>

          {loading && !cutoffs.length ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <Popover open={openCutoff} onOpenChange={setOpenCutoff}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className={cn(
                    "h-11 w-full justify-between rounded-xl px-3 text-left font-normal",
                    !selectedCutoff && "text-muted-foreground",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{cutoffText}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search cutoff…" />
                  <CommandList>
                    <CommandEmpty>No cutoff found.</CommandEmpty>
                    <CommandGroup heading="Available cutoffs">
                      {cutoffs.map((c) => {
                        const isActive = c.id === config.cutoffId;
                        const hint = cutoffRangeHint(c);
                        return (
                          <CommandItem
                            key={c.id}
                            value={`${formatCutoffLabel(c)} ${hint} ${c.id}`}
                            onSelect={() => {
                              onChange({ cutoffId: c.id });
                              setOpenCutoff(false);
                            }}
                            className="flex items-start gap-2"
                          >
                            <span
                              className={cn(
                                "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border",
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background",
                              )}
                            >
                              <Check
                                className={cn(
                                  "h-3.5 w-3.5",
                                  isActive ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </span>

                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm">
                                {formatCutoffLabel(c)}
                              </span>
                              {hint ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {hint}
                                </span>
                              ) : null}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>

              {selectedCutoff ? (
                <div className="mt-3 rounded-xl border bg-muted/20 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Selected:</span>
                    <span className="font-medium">
                      {formatCutoffLabel(selectedCutoff)}
                    </span>
                  </div>
                  {cutoffRangeHint(selectedCutoff) ? (
                    <div className="mt-1 text-muted-foreground">
                      Range: {cutoffRangeHint(selectedCutoff)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Popover>
          )}
        </Card>

        {/* Department */}
        <Card className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Department</Label>
              <div className="text-xs text-muted-foreground">
                Required. Choose a department to scope the payroll run.
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full">
              Required
            </Badge>
          </div>

          {loading && !departments.length ? (
            <div className="space-y-2">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <Popover open={openDept} onOpenChange={setOpenDept}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className={cn(
                    "h-11 w-full justify-between rounded-xl px-3 text-left font-normal",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{deptText}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search department…" />
                  <CommandList>
                    <CommandEmpty>No department found.</CommandEmpty>

                    <CommandGroup heading="Departments">
                      {departments.map((d) => {
                        const isActive = d.id === config.departmentId;
                        return (
                          <CommandItem
                            key={d.id}
                            value={`${deptLabel(d)} ${d.id}`}
                            onSelect={() => {
                              onChange({ departmentId: d.id });
                              setOpenDept(false);
                            }}
                            className="flex items-center gap-2"
                          >
                            <span
                              className={cn(
                                "inline-flex h-5 w-5 items-center justify-center rounded-md border",
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background",
                              )}
                            >
                              <Check
                                className={cn(
                                  "h-3.5 w-3.5",
                                  isActive ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {deptLabel(d)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              #{d.id}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>

              <div className="mt-3 rounded-xl border bg-muted/20 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Scope:</span>
                  <span className="font-medium">
                    {selectedDepartment
                      ? deptLabel(selectedDepartment)
                      : "Not selected"}
                  </span>
                  {selectedDepartment ? (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-mono text-muted-foreground">
                        #{selectedDepartment.id}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </Popover>
          )}
        </Card>
      </div>

      {/* Bottom action bar */}
      <Card className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Ready to proceed?</div>
            <div className="text-xs text-muted-foreground">
              You can still adjust and recompute before posting.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              disabled={loading || config.departmentId == null}
              onClick={() => onChange({ departmentId: null })}
              className="rounded-xl"
            >
              Clear Selection
            </Button>

            <Button
              type="button"
              disabled={loading || !canProceed}
              onClick={onNext}
              className="rounded-xl gap-2"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="font-medium text-foreground">Cutoff</div>
            <div className="mt-1">
              {selectedCutoff ? formatCutoffLabel(selectedCutoff) : "Not selected"}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="font-medium text-foreground">Department</div>
            <div className="mt-1">
              {selectedDepartment
                ? deptLabel(selectedDepartment)
                : "Not selected"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
