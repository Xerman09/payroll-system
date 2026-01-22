"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BenefitSetting, CutoffSetting } from "../types";
import { Clock, AlertTriangle } from "lucide-react";
import { fetchCutoffSettings } from "../providers/benefitApi";

function pickLatestCutoffByType(
  cutoffs: CutoffSetting[],
  type: "FIRST" | "SECOND",
) {
  const matches = cutoffs.filter((c) => c.cutoff_type === type);
  if (!matches.length) return null;

  // pick latest by start_date
  return matches
    .slice()
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    )[0];
}

export default function BenefitDates({
  value,
  onChange,
}: {
  value: BenefitSetting;
  onChange: (field: "effective_from" | "effective_to", val: string) => void;
}) {
  const [cutoffs, setCutoffs] = React.useState<CutoffSetting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch cutoff settings once (this API should be only 2 rows, but still safe if it grows)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchCutoffSettings();
        if (!mounted) return;
        setCutoffs(rows);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Failed to fetch cutoff settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-sync effective_from/to from cutoff_settings based on selected cutoff type
  React.useEffect(() => {
    if (loading) return;
    if (!value.cutoff) return; // no selected cutoff type
    if (value.cutoff !== "FIRST" && value.cutoff !== "SECOND") return;

    const selected = pickLatestCutoffByType(cutoffs, value.cutoff);
    if (!selected) return;

    const nextFrom = selected.start_date;
    const nextTo = selected.end_date;

    // Avoid loops: only push changes if different
    if ((value.effective_from ?? "") !== nextFrom)
      onChange("effective_from", nextFrom);
    if ((value.effective_to ?? "") !== nextTo) onChange("effective_to", nextTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, cutoffs, value.cutoff]);

  const synced =
    value.cutoff && (value.cutoff === "FIRST" || value.cutoff === "SECOND")
      ? pickLatestCutoffByType(cutoffs, value.cutoff)
      : null;

  const from = value.effective_from || (synced?.start_date ?? "");
  const to = value.effective_to || (synced?.end_date ?? "");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
          <Clock className="h-4 w-4 text-primary" />
          <span>Effectivity Period</span>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {loading ? "Syncing…" : "Auto-synced"}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-semibold">Cutoff sync failed</div>
            <div className="opacity-90">{error}</div>
          </div>
        </div>
      ) : null}

      {!value.cutoff ? (
        <div className="text-xs text-muted-foreground">
          Select a cutoff (FIRST/SECOND) to auto-fill the effectivity dates from{" "}
          <span className="font-medium">cutoff_settings</span>.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
            From
          </Label>
          <Input
            type="date"
            className="h-9 text-xs bg-slate-50"
            value={from}
            disabled
            readOnly
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
            To
          </Label>
          <Input
            type="date"
            className="h-9 text-xs bg-slate-50"
            value={to}
            disabled
            readOnly
          />
        </div>
      </div>

      {synced ? (
        <div className="text-[11px] text-muted-foreground">
          Source: cutoff_settings ({synced.cutoff_type}) • {synced.start_date} →{" "}
          {synced.end_date}
        </div>
      ) : null}
    </div>
  );
}
