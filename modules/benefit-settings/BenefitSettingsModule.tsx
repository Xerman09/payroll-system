"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState } from "react";
import { toast } from "sonner";
import { Layers, Save } from "lucide-react"; // Make sure you have lucide-react

import { BENEFITS } from "./index";
import type { BenefitCode, CutoffType } from "./types";
import { useBenefitData } from "./providers/useBenefitData";
import { useBenefitCrud } from "./providers/useBenefitCrud";

import BenefitCard from "./components/BenefitCard";
import SaveButton from "./components/SaveButton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function BenefitSettingsModule() {
  const { settings, setSettings, getUserName, loadSettings } = useBenefitData();
  const { save } = useBenefitCrud();

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleCutoffChange = (benefit: BenefitCode, cutoff: CutoffType) => {
    setSettings((prev) => ({
      ...prev,
      [benefit]: {
        ...(prev[benefit] || {}),
        cutoff,
      },
    }));
  };

  const handleDateChange = (
    benefit: BenefitCode,
    field: "effective_from" | "effective_to",
    value: string
  ) => {
    setSettings((prev) => ({
      ...prev,
      [benefit]: {
        ...(prev[benefit] || {}),
        [field]: value,
      },
    }));
  };

  async function handleSave() {
    try {
      setSaving(true);
      setStatus("idle");
      await save(settings);
      setStatus("success");
      toast.success("Benefit settings saved successfully.");
      setTimeout(() => setStatus("idle"), 800);
      loadSettings();
    } catch {
      setStatus("error");
      toast.error("Failed to save benefit settings.");
      setTimeout(() => setStatus("idle"), 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-2 md:p-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center  justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Benefit Configuration
            </h2>
            <p className="text-muted-foreground text-sm">
              Manage deduction schedules and effective dates for employee
              benefits.
            </p>
          </div>

          {/* Top Save Button for accessibility */}
          <div className="hidden md:block">
            <SaveButton saving={saving} status={status} onClick={handleSave} />
          </div>
        </div>

        <Separator />

        {/* Grid Layout for Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {BENEFITS.map((b) => (
            <BenefitCard
              key={b.code}
              name={b.name}
              code={b.code}
              setting={settings[b.code]}
              getUserName={getUserName}
              onCutoff={handleCutoffChange}
              onDateChange={handleDateChange}
            />
          ))}
        </div>

        {/* Mobile/Bottom Save Button */}
        <div className="md:hidden sticky bottom-4">
          <SaveButton saving={saving} status={status} onClick={handleSave} />
        </div>
      </div>
    </DashboardLayout>
  );
}
