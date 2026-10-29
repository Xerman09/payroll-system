// modules/thirteenth-month/components/CreateHeaderModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Calendar, FileText, Check, Save, Loader2 } from "lucide-react";
import type { ThirteenthMonthHeader } from "../types";
import { calculateWorkingDaysInRange } from "../providers/thirteenthMonthService";
import { toast } from "sonner";

interface CreateHeaderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHeader: ThirteenthMonthHeader;
  onSaveHeader: (newHeader: ThirteenthMonthHeader) => Promise<void> | void;
  departments: { id: number | string; name: string }[];
}

export function CreateHeaderModal({
  open,
  onOpenChange,
  initialHeader,
  onSaveHeader,
  departments,
}: CreateHeaderModalProps) {
  const [title, setTitle] = useState(initialHeader.title);
  const [startDate, setStartDate] = useState(initialHeader.start_date);
  const [endDate, setEndDate] = useState(initialHeader.end_date);
  const [workingDays, setWorkingDays] = useState(initialHeader.total_period_working_days);
  const [deptFilter, setDeptFilter] = useState(initialHeader.department_filter);
  const [notes, setNotes] = useState(initialHeader.notes || "");
  const [isFiveDayWeek, setIsFiveDayWeek] = useState(false);
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    if (open) {
      setTitle(initialHeader.title);
      setStartDate(initialHeader.start_date);
      setEndDate(initialHeader.end_date);
      setWorkingDays(initialHeader.total_period_working_days);
      setDeptFilter(initialHeader.department_filter);
      setNotes(initialHeader.notes || "");
    }
  }, [open, initialHeader]);

  const handleAutoCountDays = () => {
    if (!startDate || !endDate) {
      toast.error("Please specify both Start Date and End Date.");
      return;
    }
    const days = calculateWorkingDaysInRange(startDate, endDate, isFiveDayWeek);
    if (days <= 0) {
      toast.error("Start Date must be before End Date.");
      return;
    }
    setWorkingDays(days);
    toast.success(`Computed ${days} working days in selected interval!`);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title for the 13th Month batch.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please specify date range.");
      return;
    }
    if (workingDays <= 0) {
      toast.error("Total Working Days must be greater than zero.");
      return;
    }

    const updated: ThirteenthMonthHeader = {
      ...initialHeader,
      title: title.trim(),
      start_date: startDate,
      end_date: endDate,
      total_period_working_days: Number(workingDays),
      department_filter: deptFilter,
      notes: notes.trim(),
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await onSaveHeader(updated);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Configure 13th Month Batch Header
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Set the evaluation date range and period working days divisor for calculating the per-day pay rate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Batch Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2026 Year-End 13th Month Pay"
              className="rounded-xl border-border/80"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Period Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border-border/80 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Period End Date
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border-border/80 font-mono text-xs"
              />
            </div>
          </div>

          {/* Total Working Days & Auto Calculator */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-500" />
                Total Working Days in Period
              </Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAutoCountDays}
                className="h-7 text-xs px-2.5 rounded-lg bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border border-emerald-500/30"
              >
                Auto-Compute from Dates
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={366}
                value={workingDays}
                onChange={(e) => setWorkingDays(Math.max(1, parseInt(e.target.value) || 0))}
                className="rounded-xl font-mono text-base font-bold text-foreground border-border/80 w-36"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                Divisor used for: <br />
                <code className="text-primary font-semibold">Pay Per Day = Monthly Salary ÷ {workingDays || 0}</code>
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                id="fiveDayWeek"
                checked={isFiveDayWeek}
                onChange={(e) => setIsFiveDayWeek(e.target.checked)}
                className="rounded border-border/80 cursor-pointer"
              />
              <label htmlFor="fiveDayWeek" className="cursor-pointer select-none">
                Exclude Saturdays too (5-day work week instead of 6-day)
              </label>
            </div>
          </div>

          {/* Department Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Department Scope</Label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="ALL">All Departments (Entire Organization)</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              Remarks / Internal Notes
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Standard computation as approved by management"
              className="rounded-xl border-border/80 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-md shadow-primary/20"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Configuration...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save & Recalculate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
