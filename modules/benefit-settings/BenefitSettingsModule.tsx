"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { BENEFITS } from "./index";
import type { BenefitCode, CutoffType } from "./types";
import { useBenefitData } from "./providers/useBenefitData";
import { useBenefitCrud } from "./providers/useBenefitCrud";

import BenefitCard from "./components/BenefitCard";
import SaveButton from "./components/SaveButton";

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
      setTimeout(() => setStatus("idle"), 800);
      loadSettings();
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Benefit Settings</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-0">
              {BENEFITS.map((b, index) => (
                <div
                  key={b.code}
                  className={
                    index < BENEFITS.length - 1
                      ? "border-b border-gray-100 dark:border-gray-700"
                      : ""
                  }
                >
                  <BenefitCard
                    name={b.name}
                    code={b.code}
                    setting={settings[b.code]}
                    getUserName={getUserName}
                    onCutoff={handleCutoffChange}
                    onDateChange={handleDateChange}
                  />
                </div>
              ))}

              <SaveButton
                saving={saving}
                status={status}
                onClick={handleSave}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
