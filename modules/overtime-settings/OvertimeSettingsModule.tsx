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
  Calculator,
  BookOpen,
  Sliders,
  DollarSign,
  ArrowRight,
  Info,
  Check,
  Plus,
  Minus,
  Building,
  Landmark,
  Layers,
  Timer,
  Hourglass,
  Sunrise,
  Sunset,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  LGU_PRESETS,
} from "./types";
import { fetchGeneralSettings, saveOvertimeSettings } from "./providers/overtimeSettingsApi";

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "Not updated yet";
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return "Recently";
    return format(d, "MMM dd, yyyy • hh:mm a");
  } catch {
    return "Recently";
  }
}

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTime12h(timeStr?: string | null): string {
  if (!timeStr) return "10:00 PM";
  try {
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
  } catch {
    return timeStr || "10:00 PM";
  }
}

export function OvertimeSettingsModule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [savedForm, setSavedForm] = useState<OvertimeRateFormState>({
    payroll_overtime_rate: "1.00",
    payroll_ot_rate_rest_day: "1.69",
    payroll_ot_rate_special_holiday: "1.69",
    payroll_ot_rate_special_rest_day: "1.95",
    payroll_ot_rate_regular_holiday: "2.60",
    payroll_ot_rate_regular_rest_day: "3.38",
    payroll_night_diff_rate: "0.10",
    payroll_night_diff_start_time: "22:00",
    payroll_night_diff_end_time: "06:00",
    payroll_ot_minimum_minutes: "30",
    payroll_ot_incremental_minutes: "30",
  });

  const [form, setForm] = useState<OvertimeRateFormState>({
    payroll_overtime_rate: "1.00",
    payroll_ot_rate_rest_day: "1.69",
    payroll_ot_rate_special_holiday: "1.69",
    payroll_ot_rate_special_rest_day: "1.95",
    payroll_ot_rate_regular_holiday: "2.60",
    payroll_ot_rate_regular_rest_day: "3.38",
    payroll_night_diff_rate: "0.10",
    payroll_night_diff_start_time: "22:00",
    payroll_night_diff_end_time: "06:00",
    payroll_ot_minimum_minutes: "30",
    payroll_ot_incremental_minutes: "30",
  });

  // Simulator State
  const [simDailyWage, setSimDailyWage] = useState<number>(610); // Standard Daily Wage
  const [simOtMinutes, setSimOtMinutes] = useState<number>(75); // 75 mins (1 hr 15 mins) to showcase 30m increment
  const [simNightMins, setSimNightMins] = useState<number>(60); // 1 hour Night Diff

  // Dialog states for preset confirmations (No browser window.confirm!)
  const [presetConfirmDialog, setPresetConfirmDialog] = useState<"dole" | "flat" | "lgu" | null>(null);

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(savedForm);
  }, [form, savedForm]);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const rows: GeneralSettingRow[] = await fetchGeneralSettings();
      const newForm: OvertimeRateFormState = { ...savedForm };
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

      setSavedForm(newForm);
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

  const handleStep = (key: keyof OvertimeRateFormState, delta: number) => {
    const cur = parseFloat(form[key]) || 0;
    const isMinuteField = key.includes("minutes");
    const next = isMinuteField
      ? Math.max(0, Math.round(cur + delta))
      : Math.max(0, Math.round((cur + delta) * 100) / 100);
    handleChange(key, isMinuteField ? String(next) : next.toFixed(2));
  };

  const handleApplyPreset = (type: "dole" | "flat" | "lgu") => {
    if (type === "dole") {
      setForm({ ...DOLE_PRESETS });
      toast.info("DOLE Statutory Rates loaded. Click 'Save Changes' to apply.");
    } else if (type === "flat") {
      setForm({ ...FLAT_PRESETS });
      toast.info("1.0x Flat Rates loaded. Click 'Save Changes' to apply.");
    } else if (type === "lgu") {
      setForm({ ...LGU_PRESETS });
      toast.info("LGU Government Rates loaded. Click 'Save Changes' to apply.");
    }
    setPresetConfirmDialog(null);
  };

  const handleResetToSaved = () => {
    setForm({ ...savedForm });
    toast.info("Discarded unsaved changes.");
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Numerical validation
    for (const [k, v] of Object.entries(form)) {
      if (k === "payroll_night_diff_start_time" || k === "payroll_night_diff_end_time") {
        if (!v || !v.includes(":")) {
          toast.error(`Please select a valid time for ${k}`);
          return;
        }
        continue;
      }
      const parsed = parseFloat(v);
      if (isNaN(parsed) || parsed < 0) {
        toast.error(`Invalid rate for ${k}: must be a positive number`);
        return;
      }
    }

    setSaving(true);
    try {
      await saveOvertimeSettings(form);
      setSavedForm({ ...form });
      toast.success("Overtime policies & night differential rules saved successfully!");
      setLastUpdated(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const formattedLastUpdated = useMemo(() => formatDisplayDate(lastUpdated), [lastUpdated]);

  // Calculations for Simulator
  const simHourly = useMemo(() => simDailyWage / 8, [simDailyWage]);
  const simMinute = useMemo(() => simDailyWage / 480, [simDailyWage]);

  // Minimum & Incremental logic evaluation for simulator
  const simMinimumThreshold = useMemo(() => parseFloat(form.payroll_ot_minimum_minutes) || 0, [form.payroll_ot_minimum_minutes]);
  const simIncrementalBracket = useMemo(() => parseFloat(form.payroll_ot_incremental_minutes) || 1, [form.payroll_ot_incremental_minutes]);

  const simEffectiveOtMinutes = useMemo(() => {
    const raw = Math.max(0, simOtMinutes);
    if (simMinimumThreshold > 0 && raw < simMinimumThreshold) {
      return 0;
    }
    if (simIncrementalBracket > 1 && raw > 0) {
      return Math.floor(raw / simIncrementalBracket) * simIncrementalBracket;
    }
    return raw;
  }, [simOtMinutes, simMinimumThreshold, simIncrementalBracket]);

  const simResults = useMemo(() => {
    const otMins = simEffectiveOtMinutes;
    const ndMins = Math.max(0, simNightMins);

    const normalMult = parseFloat(form.payroll_overtime_rate) || 1.0;
    const restMult = parseFloat(form.payroll_ot_rate_rest_day) || 1.69;
    const specMult = parseFloat(form.payroll_ot_rate_special_holiday) || 1.69;
    const specRestMult = parseFloat(form.payroll_ot_rate_special_rest_day) || 1.95;
    const regMult = parseFloat(form.payroll_ot_rate_regular_holiday) || 2.60;
    const regRestMult = parseFloat(form.payroll_ot_rate_regular_rest_day) || 3.38;
    const ndRate = parseFloat(form.payroll_night_diff_rate) || 0.10;

    return [
      {
        scenario: "Regular Workday OT",
        detail: "Standard shift exceeding 8 hours",
        multiplier: normalMult,
        otPay: otMins * simMinute * normalMult,
        hourlyRateEq: simHourly * normalMult,
        doleBenchmark: "1.25× (DOLE)",
        isBenchmarkMatch: Math.abs(normalMult - 1.25) < 0.001,
      },
      {
        scenario: "Rest Day OT (Sunday)",
        detail: "Exceeding 8 hours on scheduled day-off",
        multiplier: restMult,
        otPay: otMins * simMinute * restMult,
        hourlyRateEq: simHourly * restMult,
        doleBenchmark: "1.69× (DOLE)",
        isBenchmarkMatch: Math.abs(restMult - 1.69) < 0.001,
      },
      {
        scenario: "Special Holiday OT",
        detail: "Exceeding 8 hours on Special Non-Working Day",
        multiplier: specMult,
        otPay: otMins * simMinute * specMult,
        hourlyRateEq: simHourly * specMult,
        doleBenchmark: "1.69× (DOLE)",
        isBenchmarkMatch: Math.abs(specMult - 1.69) < 0.001,
      },
      {
        scenario: "Special Holiday + Rest Day OT",
        detail: "Special Non-Working Day falling on Rest Day",
        multiplier: specRestMult,
        otPay: otMins * simMinute * specRestMult,
        hourlyRateEq: simHourly * specRestMult,
        doleBenchmark: "1.95× (DOLE)",
        isBenchmarkMatch: Math.abs(specRestMult - 1.95) < 0.001,
      },
      {
        scenario: "Regular Holiday OT",
        detail: "Exceeding 8 hours on Regular National Holiday",
        multiplier: regMult,
        otPay: otMins * simMinute * regMult,
        hourlyRateEq: simHourly * regMult,
        doleBenchmark: "2.60× (DOLE)",
        isBenchmarkMatch: Math.abs(regMult - 2.60) < 0.001,
      },
      {
        scenario: "Regular Holiday + Rest Day OT",
        detail: "Regular Holiday falling on employee's Rest Day",
        multiplier: regRestMult,
        otPay: otMins * simMinute * regRestMult,
        hourlyRateEq: simHourly * regRestMult,
        doleBenchmark: "3.38× (DOLE)",
        isBenchmarkMatch: Math.abs(regRestMult - 3.38) < 0.001,
      },
      {
        scenario: `Night Shift Differential (${formatTime12h(form.payroll_night_diff_start_time)} – ${formatTime12h(form.payroll_night_diff_end_time)})`,
        detail: `Nocturnal work during active window`,
        multiplier: ndRate,
        otPay: (ndMins / 60) * simHourly * ndRate,
        hourlyRateEq: simHourly * ndRate,
        doleBenchmark: "10% (DOLE)",
        isBenchmarkMatch: Math.abs(ndRate - 0.10) < 0.001,
      },
    ];
  }, [form, simMinute, simHourly, simEffectiveOtMinutes, simNightMins]);

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full pt-6 pb-20 px-4 sm:px-6">
        
        {/* Sleek Top Banner & Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-900/40">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 -mb-10 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/20 shadow-inner">
                  <Clock className="h-6 w-6 text-indigo-400" />
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Overtime &amp; Rate Policies
                </h1>
                {isDirty ? (
                  <Badge className="bg-amber-500 text-amber-950 font-semibold border-amber-400/30 animate-pulse">
                    Unsaved Changes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-medium">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" /> Active in Payroll Run
                  </Badge>
                )}
              </div>
              <p className="text-sm text-indigo-200/80 leading-relaxed">
                Configure global multipliers for regular overtime, rest days, holidays, night differential considered time window, minimum eligibility thresholds, and incremental brackets.
              </p>
              <div className="flex items-center gap-2 text-xs text-indigo-300/60 pt-1">
                <Info className="h-3.5 w-3.5" />
                <span>Last updated: {formattedLastUpdated}</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-end">
              {isDirty && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToSaved}
                  disabled={saving}
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Discard
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={loading || saving}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-500/30 px-5 gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving Policies..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>

        {/* Preset Quick-Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card/60 backdrop-blur-md rounded-xl border border-border/60 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sliders className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Standard Presets:</span>
            <span className="text-xs">Quickly populate policy rates, night differential hours, and brackets</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPresetConfirmDialog("dole")}
              disabled={loading || saving}
              className="h-8 text-xs gap-1.5 border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              DOLE Standard (1.25× / 10PM-6AM)
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPresetConfirmDialog("lgu")}
              disabled={loading || saving}
              className="h-8 text-xs gap-1.5 border-blue-500/30 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400"
            >
              <Landmark className="h-3.5 w-3.5 text-blue-500" />
              LGU / Public Sector
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPresetConfirmDialog("flat")}
              disabled={loading || saving}
              className="h-8 text-xs gap-1.5 hover:bg-muted"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Straight-Time (1.0× Flat)
            </Button>
          </div>
        </div>

        {/* Quick KPI Overview Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-border/60 shadow-sm bg-gradient-to-br from-blue-500/5 via-card to-card hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Regular Day OT
                </span>
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Sun className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                  {form.payroll_overtime_rate}×
                </span>
                <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/10 text-blue-600 border-blue-500/20">
                  {((parseFloat(form.payroll_overtime_rate || "1") - 1) * 100).toFixed(0)}% Prem
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              Beyond 8h workday.
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-gradient-to-br from-emerald-500/5 via-card to-card hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Rest Day OT
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Calendar className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                  {form.payroll_ot_rate_rest_day}×
                </span>
                <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  130% × 130%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              Sunday / scheduled off.
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-gradient-to-br from-purple-500/5 via-card to-card hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Regular Holiday OT
                </span>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                  {form.payroll_ot_rate_regular_holiday}×
                </span>
                <Badge variant="outline" className="text-[10px] font-mono bg-purple-500/10 text-purple-600 border-purple-500/20">
                  200% × 130%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              National holidays.
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-gradient-to-br from-cyan-500/5 via-card to-card hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  OT Bracket Step
                </span>
                <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Timer className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                  {form.payroll_ot_incremental_minutes || "1"}m
                </span>
                <Badge variant="outline" className="text-[10px] font-mono bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                  Min {form.payroll_ot_minimum_minutes || "0"}m
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              Counted in {form.payroll_ot_incremental_minutes}m blocks.
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-gradient-to-br from-amber-500/5 via-card to-card hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Night Differential
                </span>
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Moon className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                  {(parseFloat(form.payroll_night_diff_rate || "0.10") * 100).toFixed(0)}%
                </span>
                <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-600 border-amber-500/20">
                  {formatTime12h(form.payroll_night_diff_start_time)} – {formatTime12h(form.payroll_night_diff_end_time)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pt-0">
              Active considered nocturnal hours.
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Interface: Policies | Live Simulator | Legal Reference */}
        <Tabs defaultValue="rates" className="space-y-6">
          <TabsList className="grid w-full sm:w-auto grid-cols-3 bg-muted/70 p-1 border">
            <TabsTrigger value="rates" className="gap-2">
              <Sliders className="h-4 w-4" />
              <span>Multipliers &amp; Rounding</span>
            </TabsTrigger>
            <TabsTrigger value="simulator" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span>Live Pay Simulator</span>
            </TabsTrigger>
            <TabsTrigger value="reference" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span>DOLE Guidelines</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Rate Configuration */}
          <TabsContent value="rates" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Form Inputs */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Overtime Minimum & Incremental Counting Rules */}
                <Card className="border-border/60 shadow-sm overflow-hidden border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 via-card to-card">
                  <CardHeader className="bg-muted/30 border-b pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Timer className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      Overtime Counting &amp; Incremental Rounding Rules
                    </CardTitle>
                    <CardDescription>
                      Configure the minimum duration required to qualify for overtime, and the incremental block size (e.g. every 30 minutes) used during calculation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                      {/* Minimum Threshold */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-cyan-400/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="payroll_ot_minimum_minutes" className="text-sm font-semibold flex items-center gap-1.5">
                            Minimum Overtime (Minutes)
                          </Label>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            payroll_ot_minimum_minutes
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Overtime below this threshold is treated as <strong>0 minutes</strong>. (e.g., 30 mins means working 25 mins yields 0 OT).
                        </p>
                        
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_minimum_minutes", -15)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_ot_minimum_minutes"
                              type="number"
                              step="5"
                              min="0"
                              value={form.payroll_ot_minimum_minutes}
                              onChange={(e) => handleChange("payroll_ot_minimum_minutes", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">
                              mins
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_minimum_minutes", 15)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {[0, 15, 30, 60].map((mins) => (
                            <Button
                              key={mins}
                              type="button"
                              variant={form.payroll_ot_minimum_minutes === String(mins) ? "default" : "outline"}
                              size="sm"
                              className="h-6 text-[10px] px-2 py-0"
                              onClick={() => handleChange("payroll_ot_minimum_minutes", String(mins))}
                              disabled={loading || saving}
                            >
                              {mins === 0 ? "No Min" : `${mins}m`}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Incremental Bracket */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-cyan-400/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="payroll_ot_incremental_minutes" className="text-sm font-semibold flex items-center gap-1.5">
                            Incremental Step (Minutes)
                          </Label>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            payroll_ot_incremental_minutes
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Overtime is counted in completed multiples of this block (e.g. <strong>every 30 minutes</strong>). 45 mins rounds to 30 mins.
                        </p>
                        
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_incremental_minutes", -15)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_ot_incremental_minutes"
                              type="number"
                              step="5"
                              min="1"
                              value={form.payroll_ot_incremental_minutes}
                              onChange={(e) => handleChange("payroll_ot_incremental_minutes", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">
                              mins
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_incremental_minutes", 15)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {[1, 15, 30, 60].map((mins) => (
                            <Button
                              key={mins}
                              type="button"
                              variant={form.payroll_ot_incremental_minutes === String(mins) ? "default" : "outline"}
                              size="sm"
                              className="h-6 text-[10px] px-2 py-0"
                              onClick={() => handleChange("payroll_ot_incremental_minutes", String(mins))}
                              disabled={loading || saving}
                            >
                              {mins === 1 ? "Exact (1m)" : `${mins}m blocks`}
                            </Button>
                          ))}
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>

                {/* Regular & Rest Day OT */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-500" />
                      Workday &amp; Rest Day Multipliers
                    </CardTitle>
                    <CardDescription>
                      Multipliers applied on approved overtime minutes for normal shifts and rest days.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      
                      {/* Regular Workday OT */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-indigo-400/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="payroll_overtime_rate" className="text-sm font-semibold flex items-center gap-1.5">
                            Regular Day OT Multiplier
                          </Label>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            payroll_overtime_rate
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Applied to overtime minutes after 8 regular work hours on a standard scheduled day.
                        </p>
                        
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_overtime_rate", -0.05)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_overtime_rate"
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.payroll_overtime_rate}
                              onChange={(e) => handleChange("payroll_overtime_rate", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">
                              ×
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_overtime_rate", 0.05)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                          <span>Statutory: <strong>1.25×</strong></span>
                          <span>Flat: <strong>1.00×</strong></span>
                        </div>
                      </div>

                      {/* Rest Day OT */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-emerald-400/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="payroll_ot_rate_rest_day" className="text-sm font-semibold flex items-center gap-1.5">
                            Rest Day OT (Sunday)
                          </Label>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            payroll_ot_rate_rest_day
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Applied to hours worked beyond 8 hours during an employee’s designated rest day.
                        </p>
                        
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_rest_day", -0.05)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_ot_rate_rest_day"
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.payroll_ot_rate_rest_day}
                              onChange={(e) => handleChange("payroll_ot_rate_rest_day", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">
                              ×
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_rest_day", 0.05)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                          <span>Statutory: <strong>1.69×</strong></span>
                          <span>(130% Base × 130% OT)</span>
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>

                {/* Holiday Overtime Multipliers */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-purple-500" />
                      Statutory Holiday Overtime Multipliers
                    </CardTitle>
                    <CardDescription>
                      Overtime premiums applied during declared Special Non-Working Days and Regular Holidays.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                      {/* Special Holiday OT */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-purple-400/40 transition-colors">
                        <Label htmlFor="payroll_ot_rate_special_holiday" className="text-sm font-semibold">
                          Special Holiday OT Multiplier
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Overtime on Special Non-Working Day (DOLE: 130% × 130% = 1.69×).
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_special_holiday", -0.05)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_ot_rate_special_holiday"
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.payroll_ot_rate_special_holiday}
                              onChange={(e) => handleChange("payroll_ot_rate_special_holiday", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">×</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_special_holiday", 0.05)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Special Holiday + Rest Day OT */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-purple-400/40 transition-colors">
                        <Label htmlFor="payroll_ot_rate_special_rest_day" className="text-sm font-semibold">
                          Special Holiday + Rest Day OT
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Special Day falling on Rest Day (DOLE: 150% × 130% = 1.95×).
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_special_rest_day", -0.05)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_ot_rate_special_rest_day"
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.payroll_ot_rate_special_rest_day}
                              onChange={(e) => handleChange("payroll_ot_rate_special_rest_day", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">×</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_special_rest_day", 0.05)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Regular Holiday OT */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-purple-400/40 transition-colors">
                        <Label htmlFor="payroll_ot_rate_regular_holiday" className="text-sm font-semibold">
                          Regular Holiday OT Multiplier
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Overtime on Regular National Holiday (DOLE: 200% × 130% = 2.60×).
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_regular_holiday", -0.05)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_ot_rate_regular_holiday"
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.payroll_ot_rate_regular_holiday}
                              onChange={(e) => handleChange("payroll_ot_rate_regular_holiday", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">×</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_regular_holiday", 0.05)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Regular Holiday + Rest Day OT */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-purple-400/40 transition-colors">
                        <Label htmlFor="payroll_ot_rate_regular_rest_day" className="text-sm font-semibold">
                          Regular Holiday + Rest Day OT
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Regular Holiday falling on Rest Day (DOLE: 260% × 130% = 3.38×).
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_regular_rest_day", -0.05)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_ot_rate_regular_rest_day"
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.payroll_ot_rate_regular_rest_day}
                              onChange={(e) => handleChange("payroll_ot_rate_regular_rest_day", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">×</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_ot_rate_regular_rest_day", 0.05)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>

                {/* Night Shift Differential Rate & Considered Time Window */}
                <Card className="border-border/60 shadow-sm overflow-hidden border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-card to-card">
                  <CardHeader className="bg-muted/30 border-b pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Moon className="h-5 w-5 text-amber-500" />
                      Night Shift Differential Rate &amp; Considered Time Window
                    </CardTitle>
                    <CardDescription>
                      Configure the premium multiplier rate and the nocturnal active hours when employees qualify for night differential compensation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                      {/* Premium Rate */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-amber-400/40 transition-colors">
                        <Label htmlFor="payroll_night_diff_rate" className="text-sm font-semibold flex items-center justify-between">
                          <span>NSD Premium Rate</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            payroll_night_diff_rate
                          </Badge>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Expressed as decimal (e.g. 0.10 = 10% premium on employee’s hourly rate).
                        </p>
                        
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_night_diff_rate", -0.01)}
                            disabled={loading || saving}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <div className="relative flex-1">
                            <Input
                              id="payroll_night_diff_rate"
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              value={form.payroll_night_diff_rate}
                              onChange={(e) => handleChange("payroll_night_diff_rate", e.target.value)}
                              className="font-mono font-bold text-center pr-8 h-9 text-base"
                              disabled={loading || saving}
                            />
                            <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">%</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => handleStep("payroll_night_diff_rate", 0.01)}
                            disabled={loading || saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t">
                          <span>DOLE Statutory Standard: <strong>10% (0.10)</strong></span>
                        </div>
                      </div>

                      {/* Considered Nocturnal Time Window */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card hover:border-amber-400/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Considered Nocturnal Window</Label>
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-mono">
                            {formatTime12h(form.payroll_night_diff_start_time)} &rarr; {formatTime12h(form.payroll_night_diff_end_time)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Shifts or overtime occurring within this time frame are counted towards night differential.
                        </p>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <Label htmlFor="payroll_night_diff_start_time" className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                              <Sunset className="h-3 w-3 text-amber-500" /> Start Time
                            </Label>
                            <Input
                              id="payroll_night_diff_start_time"
                              type="time"
                              value={form.payroll_night_diff_start_time || "22:00"}
                              onChange={(e) => handleChange("payroll_night_diff_start_time", e.target.value)}
                              className="font-mono text-xs h-9"
                              disabled={loading || saving}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="payroll_night_diff_end_time" className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                              <Sunrise className="h-3 w-3 text-amber-500" /> End Time
                            </Label>
                            <Input
                              id="payroll_night_diff_end_time"
                              type="time"
                              value={form.payroll_night_diff_end_time || "06:00"}
                              onChange={(e) => handleChange("payroll_night_diff_end_time", e.target.value)}
                              className="font-mono text-xs h-9"
                              disabled={loading || saving}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                          <Button
                            type="button"
                            variant={form.payroll_night_diff_start_time === "22:00" && form.payroll_night_diff_end_time === "06:00" ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-[10px] px-2 py-0"
                            onClick={() => {
                              handleChange("payroll_night_diff_start_time", "22:00");
                              handleChange("payroll_night_diff_end_time", "06:00");
                            }}
                            disabled={loading || saving}
                          >
                            10PM – 6AM (DOLE)
                          </Button>
                          <Button
                            type="button"
                            variant={form.payroll_night_diff_start_time === "23:00" && form.payroll_night_diff_end_time === "07:00" ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-[10px] px-2 py-0"
                            onClick={() => {
                              handleChange("payroll_night_diff_start_time", "23:00");
                              handleChange("payroll_night_diff_end_time", "07:00");
                            }}
                            disabled={loading || saving}
                          >
                            11PM – 7AM
                          </Button>
                          <Button
                            type="button"
                            variant={form.payroll_night_diff_start_time === "21:00" && form.payroll_night_diff_end_time === "05:00" ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-[10px] px-2 py-0"
                            onClick={() => {
                              handleChange("payroll_night_diff_start_time", "21:00");
                              handleChange("payroll_night_diff_end_time", "05:00");
                            }}
                            disabled={loading || saving}
                          >
                            9PM – 5AM
                          </Button>
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Right Column: Engine Rules & Audit Guide */}
              <div className="space-y-6">
                
                {/* Computation Engine Formula Card */}
                <Card className="border-border/60 shadow-sm bg-gradient-to-br from-indigo-500/5 via-card to-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                      <Calculator className="h-4 w-4" />
                      Payroll Engine Logic
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-3.5 text-muted-foreground leading-relaxed">
                    <p>
                      The payroll engine parses attendance and rounds overtime minutes prior to rate calculation:
                    </p>
                    
                    <div className="p-3 bg-muted/50 rounded-lg border font-mono text-[11px] space-y-1.5 text-foreground">
                      <div className="text-muted-foreground font-sans text-[10px] uppercase font-semibold">1. Eligibility &amp; Increments:</div>
                      <div>If OT &lt; Minimum Threshold ({form.payroll_ot_minimum_minutes}m) &rarr; <strong>0 mins</strong></div>
                      <div>Credited OT = Floor(OT ÷ {form.payroll_ot_incremental_minutes}m) × {form.payroll_ot_incremental_minutes}m</div>
                      <Separator className="my-1.5" />
                      <div className="text-muted-foreground font-sans text-[10px] uppercase font-semibold">2. Monetary Pay:</div>
                      <div>Minute Rate = Daily Rate ÷ 480</div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-bold">
                        OT Pay = Credited Mins × Minute Rate × Multiplier
                      </div>
                      <Separator className="my-1.5" />
                      <div className="text-muted-foreground font-sans text-[10px] uppercase font-semibold">3. Night Differential:</div>
                      <div>Active Window: {formatTime12h(form.payroll_night_diff_start_time)} to {formatTime12h(form.payroll_night_diff_end_time)}</div>
                      <div className="text-amber-600 dark:text-amber-400 font-bold">
                        ND Pay = (ND Mins ÷ 60) × Hourly Rate × {(parseFloat(form.payroll_night_diff_rate || "0.1") * 100).toFixed(0)}%
                      </div>
                    </div>

                    <p className="text-[11px]">
                      Overtime premiums are evaluated cleanly without stacking. Unfinished incremental brackets are automatically truncated to ensure fair and consistent payroll accounting.
                    </p>
                  </CardContent>
                </Card>

                {/* Audit & Storage Metadata Card */}
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      System Audit &amp; Persistence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Storage Destination:</span>
                      <span className="font-mono font-medium text-foreground">general_setting</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Configured Parameters:</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        11 active keys
                      </Badge>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Sync State:</span>
                      {isDirty ? (
                        <span className="text-amber-600 font-medium">Pending Save</span>
                      ) : (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" /> In Sync
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Last Modified:</span>
                      <span className="font-medium text-foreground">{formattedLastUpdated}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleSave}
                      disabled={loading || saving || !isDirty}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving Changes..." : isDirty ? "Commit Changes" : "Configuration Saved"}
                    </Button>
                  </CardFooter>
                </Card>

              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Live Simulator Sandbox */}
          <TabsContent value="simulator" className="space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-indigo-500" />
                      Interactive Wage &amp; Overtime Simulator
                    </CardTitle>
                    <CardDescription>
                      Simulate how employee daily wages and raw overtime minutes convert into billable overtime under your minimum threshold and incremental count settings.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 bg-background p-2.5 rounded-lg border shadow-sm">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Daily Wage (₱)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        value={simDailyWage}
                        onChange={(e) => setSimDailyWage(parseFloat(e.target.value) || 0)}
                        className="h-8 w-28 font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Raw OT (Mins)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="5"
                        value={simOtMinutes}
                        onChange={(e) => setSimOtMinutes(parseFloat(e.target.value) || 0)}
                        className="h-8 w-28 font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Night Diff (Mins)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="15"
                        value={simNightMins}
                        onChange={(e) => setSimNightMins(parseFloat(e.target.value) || 0)}
                        className="h-8 w-28 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                {/* Simulator Base Conversion Badges with Rounding Verification */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/40 border">
                  <div>
                    <div className="text-xs text-muted-foreground">Raw Overtime Input</div>
                    <div className="text-xl font-bold font-mono text-foreground">{simOtMinutes} mins</div>
                    <div className="text-[10px] text-muted-foreground">Logged by attendance</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Credited / Billable OT</div>
                    <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {simEffectiveOtMinutes} mins
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {simMinimumThreshold > 0 && simOtMinutes < simMinimumThreshold ? (
                        <span className="text-amber-600 font-semibold">Disqualified (&lt;{simMinimumThreshold}m min)</span>
                      ) : (
                        `Counted in ${simIncrementalBracket}m brackets`
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Base Hourly Rate</div>
                    <div className="text-xl font-bold font-mono text-foreground">{formatPhp(simHourly)}</div>
                    <div className="text-[10px] text-muted-foreground">Daily ÷ 8 hours</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Night Window Hours</div>
                    <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                      {formatTime12h(form.payroll_night_diff_start_time)} – {formatTime12h(form.payroll_night_diff_end_time)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Active considered period</div>
                  </div>
                </div>

                {/* Scenario Comparison Table */}
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-semibold">Shift Scenario</TableHead>
                        <TableHead className="font-semibold text-center">Configured Multiplier</TableHead>
                        <TableHead className="font-semibold text-right">Effective Hourly Rate</TableHead>
                        <TableHead className="font-semibold text-right">Simulated Pay ({simEffectiveOtMinutes}m)</TableHead>
                        <TableHead className="font-semibold text-center">DOLE Benchmark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simResults.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="font-semibold text-sm text-foreground">{row.scenario}</div>
                            <div className="text-xs text-muted-foreground">{row.detail}</div>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-base">
                            <Badge variant="outline" className="font-mono text-xs">
                              {typeof row.multiplier === "number" && row.multiplier < 1
                                ? `${(row.multiplier * 100).toFixed(0)}%`
                                : `${row.multiplier.toFixed(2)}×`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {formatPhp(row.hourlyRateEq)} / hr
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                            {formatPhp(row.otPay)}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.isBenchmarkMatch ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                Matches DOLE ({row.doleBenchmark})
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                Custom vs {row.doleBenchmark}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: DOLE Reference Guidelines */}
          <TabsContent value="reference" className="space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-500" />
                  Philippine DOLE Labor Code Statutory Guidelines
                </CardTitle>
                <CardDescription>
                  Official benchmarks per the Labor Code of the Philippines (Presidential Decree No. 442) and DOLE Handbook.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="space-y-2 p-4 rounded-xl border bg-muted/20">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Article 87: Overtime Work &amp; Rounding
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Work performed beyond eight (8) hours on ordinary working days is compensated at regular wage plus at least 25% (1.25×). Employers commonly implement minimum increments (e.g. 30 minutes) under company CBA or policy:
                    </p>
                    <div className="p-2.5 bg-background rounded border font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Regular OT Rate = Hourly Rate × 125% (1.25)
                    </div>
                  </div>

                  <div className="space-y-2 p-4 rounded-xl border bg-muted/20">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <Calendar className="h-4 w-4 text-emerald-500" />
                      Article 93: Rest Day Duty
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Work performed on a scheduled rest day receives a 30% premium on the first 8 hours (130%). Work performed beyond 8 hours receives an additional 30% of the rest day rate:
                    </p>
                    <div className="p-2.5 bg-background rounded border font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Rest Day OT = Hourly Rate × 130% × 130% = 169% (1.69)
                    </div>
                  </div>

                  <div className="space-y-2 p-4 rounded-xl border bg-muted/20">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <ShieldCheck className="h-4 w-4 text-purple-500" />
                      Article 94: Regular Holiday Pay
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Employees required to work on a Regular Holiday are paid 200% for the first 8 hours. Overtime beyond 8 hours receives an additional 30% of the holiday rate:
                    </p>
                    <div className="p-2.5 bg-background rounded border font-mono text-xs text-purple-600 dark:text-purple-400 font-medium">
                      Regular Holiday OT = Hourly Rate × 200% × 130% = 260% (2.60)
                    </div>
                  </div>

                  <div className="space-y-2 p-4 rounded-xl border bg-muted/20">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <Moon className="h-4 w-4 text-amber-500" />
                      Article 86: Night Shift Differential
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Every employee is paid a night shift differential of not less than ten percent (10%) of their regular wage for each hour of work performed between <strong>10:00 PM and 6:00 AM</strong> (or the employer&apos;s configured nocturnal window):
                    </p>
                    <div className="p-2.5 bg-background rounded border font-mono text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Night Differential = Hourly Rate × 10% (0.10)
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>

      {/* Preset Confirmation Dialogs (shadcn/ui AlertDialog - No browser dialogs!) */}
      <AlertDialog
        open={presetConfirmDialog !== null}
        onOpenChange={(open) => !open && setPresetConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              {presetConfirmDialog === "dole" && "Apply DOLE Statutory Standards?"}
              {presetConfirmDialog === "lgu" && "Apply LGU / Public Sector Standards?"}
              {presetConfirmDialog === "flat" && "Apply 1.0× Flat Overtime Rates?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm space-y-2 pt-2">
              {presetConfirmDialog === "dole" && (
                <p>
                  This will populate the official Philippine DOLE statutory multipliers (<strong>1.25×</strong> for Normal OT, <strong>1.69×</strong> for Rest Day OT, and <strong>2.60×</strong> for Regular Holiday OT), with <strong>10:00 PM &rarr; 06:00 AM Night Window</strong>, and <strong>30-minute incremental brackets</strong>.
                </p>
              )}
              {presetConfirmDialog === "lgu" && (
                <p>
                  This will populate common government and public sector benchmarks (<strong>1.25×</strong> Normal OT, <strong>1.50×</strong> Rest Day OT, and <strong>2.00×</strong> Holiday OT), with a <strong>60-minute minimum</strong>.
                </p>
              )}
              {presetConfirmDialog === "flat" && (
                <p>
                  This will populate straight-time <strong>1.00×</strong> multipliers for standard overtime.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => {
                if (presetConfirmDialog) handleApplyPreset(presetConfirmDialog);
              }}
            >
              Confirm Preset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
