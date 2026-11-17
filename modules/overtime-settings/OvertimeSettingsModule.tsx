"use client";

import React, { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { format, parseISO, isValid } from "date-fns";
import {
  Clock,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Percent,
  Calendar,
  Sun,
  Moon,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  GeneralSettingRow,
  OvertimeRateFormState,
  DOLE_PRESETS,
  FLAT_PRESETS,
} from "./types";
import { fetchGeneralSettings, saveOvertimeSettings } from "./providers/overtimeSettingsApi";

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "Not updated yet";
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return "Recently";
    return format(d, "MMM dd, yyyy hh:mm a");
  } catch {
    return "Recently";
  }
}

export function OvertimeSettingsModule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [form, setForm] = useState<OvertimeRateFormState>({
    payroll_overtime_rate: "1",
    payroll_ot_rate_rest_day: "1.69",
    payroll_ot_rate_special_holiday: "1.69",
    payroll_ot_rate_special_rest_day: "1.95",
    payroll_ot_rate_regular_holiday: "2.60",
    payroll_ot_rate_regular_rest_day: "3.38",
    payroll_night_diff_rate: "0.10",
  });

  // Dialog states for preset confirmations (No browser window.confirm!)
  const [presetConfirmDialog, setPresetConfirmDialog] = useState<"dole" | "flat" | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const rows: GeneralSettingRow[] = await fetchGeneralSettings();
      const newForm: OvertimeRateFormState = { ...form };
      let latestUpdate: string | null = null;

      for (const row of rows) {
        const key = row.setting_key as keyof OvertimeRateFormState;
        if (key in newForm && row.setting_value != null) {
          newForm[key] = String(row.setting_value);
        }
        if (row.updated_at) {
          if (!latestUpdate || new Date(row.updated_at) > new Date(latestUpdate)) {
            latestUpdate = row.updated_at;
          }
        }
      }

      setForm(newForm);
      setLastUpdated(latestUpdate);
    } catch (err: any) {
      toast.error(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (key: keyof OvertimeRateFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyPreset = (type: "dole" | "flat") => {
    if (type === "dole") {
      setForm({ ...DOLE_PRESETS });
      toast.info("DOLE Standard rates loaded. Click 'Save Configuration' to apply.");
    } else {
      setForm({ ...FLAT_PRESETS });
      toast.info("Flat 1.0x Overtime rates loaded. Click 'Save Configuration' to apply.");
    }
    setPresetConfirmDialog(null);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Basic numerical validation
    for (const [k, v] of Object.entries(form)) {
      const parsed = parseFloat(v);
      if (isNaN(parsed) || parsed < 0) {
        toast.error(`Invalid rate for ${k}: must be a positive number`);
        return;
      }
    }

    setSaving(true);
    try {
      await saveOvertimeSettings(form);
      toast.success("Overtime & Rate configuration saved successfully!");
      setLastUpdated(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const formattedLastUpdated = useMemo(() => formatDisplayDate(lastUpdated), [lastUpdated]);

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full pt-6 pb-16 px-4 sm:px-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-primary/10 text-primary rounded-xl">
                <Clock className="h-6 w-6" />
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Overtime & Rate Settings
              </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage overtime multipliers, holiday premiums, and night shift differential for payroll runs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPresetConfirmDialog("dole")}
              disabled={loading || saving}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              DOLE Standard
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPresetConfirmDialog("flat")}
              disabled={loading || saving}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4 text-blue-500" />
              1.0x Flat Rates
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={loading || saving}
              className="gap-1.5 shadow-sm"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>

        <Separator className="bg-gray-200 dark:bg-gray-800" />

        {/* Quick KPI Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-medium">
                Regular Day OT
                <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                  Daily Work
                </Badge>
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono">
                {form.payroll_overtime_rate || "1.00"}×
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              Straight or 125% rate applied on overtime after 8 hours.
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-medium">
                Rest Day OT
                <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  Sunday
                </Badge>
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono">
                {form.payroll_ot_rate_rest_day || "1.69"}×
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              Rate for working overtime on an employee’s rest day.
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-medium">
                Regular Holiday OT
                <Badge variant="outline" className="font-mono text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20">
                  Premium
                </Badge>
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono">
                {form.payroll_ot_rate_regular_holiday || "2.60"}×
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              Rate for working overtime on regular national holidays.
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs font-medium">
                Night Differential
                <Badge variant="outline" className="font-mono text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                  10PM – 6AM
                </Badge>
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-mono">
                {(parseFloat(form.payroll_night_diff_rate || "0.10") * 100).toFixed(0)}%
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              Additional premium applied per minute of nocturnal work.
            </CardContent>
          </Card>
        </div>

        {/* Configuration Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Rate Settings */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Workday & Rest Day Overtime Multipliers
                </CardTitle>
                <CardDescription>
                  Defines the multipliers used to calculate overtime wages on standard schedule days.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="payroll_overtime_rate" className="text-sm font-semibold">
                        Regular Day Overtime Multiplier
                      </Label>
                      <Badge variant="outline" className="text-[10px]">
                        Default: 1.00 or 1.25
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Applied when an employee works beyond 480 minutes (8 hours) on a normal workday.
                    </p>
                    <div className="relative">
                      <Input
                        id="payroll_overtime_rate"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.payroll_overtime_rate}
                        onChange={(e) => handleChange("payroll_overtime_rate", e.target.value)}
                        className="font-mono text-base pr-8"
                        disabled={loading || saving}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                        ×
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="payroll_ot_rate_rest_day" className="text-sm font-semibold">
                        Rest Day Overtime Multiplier
                      </Label>
                      <Badge variant="outline" className="text-[10px]">
                        Default: 1.69
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Applied on hours exceeding 8 hours on a Rest Day (130% base × 130% OT).
                    </p>
                    <div className="relative">
                      <Input
                        id="payroll_ot_rate_rest_day"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.payroll_ot_rate_rest_day}
                        onChange={(e) => handleChange("payroll_ot_rate_rest_day", e.target.value)}
                        className="font-mono text-base pr-8"
                        disabled={loading || saving}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                        ×
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Holiday Overtime Multipliers
                </CardTitle>
                <CardDescription>
                  Configure multipliers applied when overtime work falls on special or regular national holidays.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <Label htmlFor="payroll_ot_rate_special_holiday" className="text-sm font-semibold">
                      Special Holiday OT Multiplier
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Overtime on a Special Non-Working Day (130% × 130% = 1.69).
                    </p>
                    <div className="relative">
                      <Input
                        id="payroll_ot_rate_special_holiday"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.payroll_ot_rate_special_holiday}
                        onChange={(e) => handleChange("payroll_ot_rate_special_holiday", e.target.value)}
                        className="font-mono pr-8"
                        disabled={loading || saving}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                        ×
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <Label htmlFor="payroll_ot_rate_special_rest_day" className="text-sm font-semibold">
                      Special Holiday + Rest Day OT
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Overtime on a Special Day that also falls on a Rest Day (1.95).
                    </p>
                    <div className="relative">
                      <Input
                        id="payroll_ot_rate_special_rest_day"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.payroll_ot_rate_special_rest_day}
                        onChange={(e) => handleChange("payroll_ot_rate_special_rest_day", e.target.value)}
                        className="font-mono pr-8"
                        disabled={loading || saving}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                        ×
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <Label htmlFor="payroll_ot_rate_regular_holiday" className="text-sm font-semibold">
                      Regular Holiday OT Multiplier
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Overtime on a Regular Holiday (200% base × 130% OT = 2.60).
                    </p>
                    <div className="relative">
                      <Input
                        id="payroll_ot_rate_regular_holiday"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.payroll_ot_rate_regular_holiday}
                        onChange={(e) => handleChange("payroll_ot_rate_regular_holiday", e.target.value)}
                        className="font-mono pr-8"
                        disabled={loading || saving}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                        ×
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <Label htmlFor="payroll_ot_rate_regular_rest_day" className="text-sm font-semibold">
                      Regular Holiday + Rest Day OT
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Overtime on a Regular Holiday that falls on a Rest Day (3.38).
                    </p>
                    <div className="relative">
                      <Input
                        id="payroll_ot_rate_regular_rest_day"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.payroll_ot_rate_regular_rest_day}
                        onChange={(e) => handleChange("payroll_ot_rate_regular_rest_day", e.target.value)}
                        className="font-mono pr-8"
                        disabled={loading || saving}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                        ×
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Moon className="h-5 w-5 text-primary" />
                  Night Shift Differential Rate
                </CardTitle>
                <CardDescription>
                  Percentage applied to the hourly rate for work performed between 10:00 PM and 6:00 AM.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 max-w-sm space-y-2">
                  <Label htmlFor="payroll_night_diff_rate" className="text-sm font-semibold">
                    Night Differential Rate
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    DOLE standard is 0.10 (10% of hourly rate).
                  </p>
                  <div className="relative">
                    <Input
                      id="payroll_night_diff_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={form.payroll_night_diff_rate}
                      onChange={(e) => handleChange("payroll_night_diff_rate", e.target.value)}
                      className="font-mono pr-8"
                      disabled={loading || saving}
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                      %
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar / Info Card */}
          <div className="space-y-6">
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  Computation Formula
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3 text-muted-foreground">
                <p>
                  During the payroll run, each approved overtime minute is calculated using:
                </p>
                <div className="p-2.5 bg-background rounded-md border font-mono text-[11px] leading-relaxed text-foreground">
                  Minute Rate = Daily Rate / 480
                  <br />
                  OT Pay = OT Mins × Minute Rate × Multiplier
                </div>
                <p>
                  If an employee’s daily rate is ₱600.00:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Minute Rate = ₱1.25/min (₱75.00/hr)</li>
                  <li>Normal OT (1.25×) = ₱1.5625/min</li>
                  <li>Rest Day OT (1.69×) = ₱2.1125/min</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Audit Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Database Table:</span>
                  <span className="font-mono font-medium">general_setting</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Keys Managed:</span>
                  <span className="font-mono font-medium">7 items</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span className="font-medium">{formattedLastUpdated}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Preset Confirmation Dialogs (shadcn/ui AlertDialog - No browser dialogs!) */}
      <AlertDialog
        open={presetConfirmDialog !== null}
        onOpenChange={(open) => !open && setPresetConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {presetConfirmDialog === "dole" ? "Apply DOLE Standard Rates?" : "Apply 1.0x Flat Rates?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {presetConfirmDialog === "dole"
                ? "This will load the Philippine DOLE statutory multipliers (1.25x Normal OT, 1.69x Rest Day OT, 2.60x Regular Holiday OT, etc.)."
                : "This will load flat 1.0x multipliers for standard overtime. You can review the rates before saving."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (presetConfirmDialog) handleApplyPreset(presetConfirmDialog);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

