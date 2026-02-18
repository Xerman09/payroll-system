// modules/cutoff-settings/components/CutoffSettingsModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CutoffSettingRow, PeriodKey } from "../types";
import { computeDefaultCutoffsForPeriod } from "../providers/cutoffSettingsApi";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: CutoffSettingRow | null;
  period: PeriodKey;
  onConfirm: (updated: CutoffSettingRow) => void;
  saving?: boolean;
};

export default function CutoffSettingsModal({
  open,
  onOpenChange,
  row,
  period,
  onConfirm,
  saving = false,
}: Props) {
  const defaults = useMemo(
    () => computeDefaultCutoffsForPeriod(period),
    [period]
  );

  const [draft, setDraft] = useState<CutoffSettingRow | null>(row);

  useEffect(() => {
    setDraft(row);
  }, [row]);

  if (!draft) return null;

  const title =
    draft.cutoff_type === "FIRST"
      ? "1st Cutoff Configuration"
      : "2nd Cutoff Configuration";

  function handleResetToDefault() {
    if (!draft) return;
    const d = draft.cutoff_type === "FIRST" ? defaults.FIRST : defaults.SECOND;

    setDraft((prev) =>
      prev
        ? {
            ...prev,
            start_date: d.start_date,
            end_date: d.end_date,
          }
        : prev
    );
  }

  function handleSave() {
    if (!draft) return;
    onConfirm(draft);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold">
              {title}
            </DialogTitle>
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground"
            >
              {draft.cutoff_type}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">From</Label>
              <Input
                id="start_date"
                type="date"
                value={draft.start_date}
                onChange={(e) =>
                  setDraft({ ...draft, start_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">To</Label>
              <Input
                id="end_date"
                type="date"
                value={draft.end_date}
                onChange={(e) =>
                  setDraft({ ...draft, end_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payout_date">Payout Date (optional)</Label>
              <Input
                id="payout_date"
                type="date"
                value={draft.payout_date ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, payout_date: e.target.value || null })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_status">Period Status</Label>
              <select
                id="period_status"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.period_status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    period_status: e.target
                      .value as CutoffSettingRow["period_status"],
                  })
                }
              >
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col-reverse md:flex-row md:justify-between gap-2">
            <Button variant="outline" onClick={handleResetToDefault}>
              Reset to Default Dates
            </Button>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Applying..." : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
