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
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  loading: boolean;
  config: PayrollConfigState;
  cutoffs: CutoffSetting[];
  departments: Department[];
  onChange: (patch: Partial<PayrollConfigState>) => void;
  onNext: () => void;
};

function normalizeText(v: any) {
  return String(v ?? "").trim();
}

function humanizeCutoffType(v: any) {
  const raw = normalizeText(v).toLowerCase();
  if (!raw) return "";

  // Common variants we’ve seen in payroll systems:
  if (raw === "first" || raw === "1" || raw === "1st" || raw === "a")
    return "First cutoff";
  if (raw === "second" || raw === "2" || raw === "2nd" || raw === "b")
    return "Second cutoff";

  // If backend sends something like FIRST_CUTOFF / SECOND_CUTOFF / first_cutoff
  const cleaned = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned === "first cutoff") return "First cutoff";
  if (cleaned === "second cutoff") return "Second cutoff";

  // Generic title-case fallback (e.g. "third cutoff" -> "Third Cutoff")
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

function cutoffLabel(c: CutoffSetting) {
  // try common label fields; fallback to cutoff_type (First cutoff / Second cutoff)
  const anyC = c as any;

  const typeText = humanizeCutoffType(
    anyC.cutoff_type ?? anyC.cutoffType ?? anyC.type,
  );

  return (
    normalizeText(anyC.label) ||
    normalizeText(anyC.name) ||
    normalizeText(anyC.cutoff_name) ||
    normalizeText(anyC.cutoff_label) ||
    normalizeText(anyC.cutoff_code) ||
    typeText ||
    "Cutoff"
  );
}

function cutoffRangeHint(c: CutoffSetting) {
  // optional: show start/end if present (won't break if absent)
  const anyC = c as any;
  const a = normalizeText(
    anyC.start_date ?? anyC.cutoff_start ?? anyC.date_from,
  );
  const b = normalizeText(anyC.end_date ?? anyC.cutoff_end ?? anyC.date_to);
  if (!a && !b) return "";
  if (a && b) return `${a} → ${b}`;
  return a || b;
}

function deptLabel(d: Department) {
  const anyD = d as any;
  return (
    normalizeText(anyD.name) ||
    normalizeText(anyD.department_name) ||
    normalizeText(anyD.dept_name) ||
    `Department #${String(anyD.id ?? "")}`
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
    ? cutoffLabel(selectedCutoff)
    : "Select cutoff…";
  const deptText = selectedDepartment
    ? deptLabel(selectedDepartment)
    : "All departments";

  const canProceed = Boolean(config.cutoffId);

  return (
    <div className="space-y-6">
      {/* Top header */}
      <div className="flex flex-col gap-1">
        <div className="text-base font-semibold tracking-tight">
          Configuration
        </div>
        <div className="text-sm text-muted-foreground">
          Choose the cutoff and scope (department) for this payroll run.
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
                            value={`${cutoffLabel(c)} ${hint} ${c.id}`}
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
                                {cutoffLabel(c)}
                              </span>
                              {hint ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {hint}
                                </span>
                              ) : null}
                            </span>

                            <span className="ml-auto text-xs text-muted-foreground">
                              #{c.id}
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
                      {cutoffLabel(selectedCutoff)}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-mono text-muted-foreground">
                      #{selectedCutoff.id}
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
          <div className="mb-3 space-y-0.5">
            <Label className="text-sm">Department</Label>
            <div className="text-xs text-muted-foreground">
              Optional. Choose “All departments” to compute for everyone.
            </div>
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

                    <CommandGroup heading="Scope">
                      <CommandItem
                        value="All departments"
                        onSelect={() => {
                          onChange({ departmentId: null });
                          setOpenDept(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-md border",
                            config.departmentId == null
                              ? "bg-primary text-primary-foreground"
                              : "bg-background",
                          )}
                        >
                          <Check
                            className={cn(
                              "h-3.5 w-3.5",
                              config.departmentId == null
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                        </span>
                        <span className="text-sm">All departments</span>
                      </CommandItem>
                    </CommandGroup>

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
                      : "All departments"}
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
              Clear Department
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
              {selectedCutoff ? cutoffLabel(selectedCutoff) : "Not selected"}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="font-medium text-foreground">Department</div>
            <div className="mt-1">
              {selectedDepartment
                ? deptLabel(selectedDepartment)
                : "All departments"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
