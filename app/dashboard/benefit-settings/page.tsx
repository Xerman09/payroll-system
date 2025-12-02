"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type BenefitCode = "SSS" | "PAGIBIG" | "PHILHEALTH";
type CutoffType = "FIRST" | "SECOND" | null;

interface BenefitSetting {
  id: number;
  benefit_code: BenefitCode;
  benefit_name: string;
  cutoff: CutoffType;
  is_active: number;
  effective_from: string | null;
  effective_to: string | null;
  updated_by: number | null;
  updated_date: string | null;
}

interface UserData {
  user_id: number;
  user_fname: string;
  user_lname: string;
}

const BENEFITS: { code: BenefitCode; name: string }[] = [
  { code: "SSS", name: "SSS" },
  { code: "PAGIBIG", name: "Pagibig" },
  { code: "PHILHEALTH", name: "Philhealth" },
];

export default function BenefitSettingsPage() {
  const [settings, setSettings] = useState<
    Record<BenefitCode, BenefitSetting | null>
  >({
    SSS: null,
    PAGIBIG: null,
    PHILHEALTH: null,
  });

  const [users, setUsers] = useState<UserData[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  async function loadSettings() {
    const res = await fetch(
      "http://100.126.246.124:8060/items/benefit_cutoff_settings"
    );
    const data = await res.json();

    const mapped: Record<BenefitCode, BenefitSetting | null> = {
      SSS: null,
      PAGIBIG: null,
      PHILHEALTH: null,
    };

    data.data.forEach((item: any) => {
      mapped[item.benefit_code as BenefitCode] = { ...item };
    });

    setSettings(mapped);
  }

  async function loadUsers() {
    const res = await fetch("http://100.126.246.124:8060/items/user");
    const data = await res.json();
    setUsers(data.data);
  }

  function getUserName(id: number | null) {
    if (!id) return "Unknown";
    const user = users.find((u) => u.user_id === id);
    return user ? `${user.user_fname} ${user.user_lname}` : `User ${id}`;
  }

  const handleCutoffChange = (benefit: BenefitCode, cutoff: CutoffType) => {
    setSettings((prev) => {
      const updated = { ...prev };
      updated[benefit] = {
        ...(updated[benefit] || {
          id: 0,
          benefit_code: benefit,
          benefit_name:
            BENEFITS.find((b) => b.code === benefit)?.name || benefit,
          is_active: 1,
          cutoff: null,
          effective_from: null,
          effective_to: null,
          updated_by: null,
          updated_date: null,
        }),
        cutoff,
      };
      return updated;
    });
  };

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");

    try {
      for (const benefit of BENEFITS) {
        const s = settings[benefit.code];
        if (!s) continue;

        const payload = {
          benefit_code: s.benefit_code,
          benefit_name: s.benefit_name,
          cutoff: s.cutoff,
          is_active: 1,
          effective_from: s.effective_from,
          effective_to: s.effective_to,
          updated_by: 176,
        };

        await fetch(
          `http://100.126.246.124:8060/items/benefit_cutoff_settings/${
            s.id || ""
          }`,
          {
            method: s.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      }

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 800);
      loadSettings();
    } catch (error) {
      alert("Error saving settings");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 1000);
    }

    setSaving(false);
  }

  return (
    <DashboardLayout>
      <div className="p-2 space-y-2">
        <h1 className="text-lg font-semibold mb-1">Benefit Settings</h1>

        <Card className="border rounded-md shadow-sm">
          <CardContent className="p-2 space-y-2">
            {BENEFITS.map((benefit) => {
              const s = settings[benefit.code];

              return (
                <div
                  key={benefit.code}
                  className="border p-2 rounded-md space-y-2 bg-white"
                >
                  <div className="flex justify-between">
                    <h2 className="font-medium text-sm">{benefit.name}</h2>
                  </div>

                  {s && s.updated_by && (
                    <p className="text-[10px] text-gray-500 italic">
                      Updated by {getUserName(s.updated_by)} on{" "}
                      {s.updated_date
                        ? new Date(s.updated_date).toLocaleDateString()
                        : "—"}
                    </p>
                  )}

                  {/* Cutoff */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center space-x-1">
                      <Checkbox
                        checked={s?.cutoff === "FIRST"}
                        onCheckedChange={() =>
                          handleCutoffChange(
                            benefit.code,
                            s?.cutoff === "FIRST" ? null : "FIRST"
                          )
                        }
                      />
                      <span>First Cutoff</span>
                    </label>

                    <label className="flex items-center space-x-1">
                      <Checkbox
                        checked={s?.cutoff === "SECOND"}
                        onCheckedChange={() =>
                          handleCutoffChange(
                            benefit.code,
                            s?.cutoff === "SECOND" ? null : "SECOND"
                          )
                        }
                      />
                      <span>Second Cutoff</span>
                    </label>
                  </div>

                  {/* Effective Dates */}
                  <div className="text-xs">
                    <label className="font-medium">Effective Dates</label>
                    <div className="grid grid-cols-2 gap-1 mt-0.5">
                      <Input
                        type="date"
                        className="h-6 text-xs"
                        value={s?.effective_from || ""}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            [benefit.code!]: {
                              ...(prev[benefit.code] as BenefitSetting),
                              effective_from: e.target.value,
                            },
                          }))
                        }
                      />
                      <Input
                        type="date"
                        className="h-6 text-xs"
                        value={s?.effective_to || ""}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            [benefit.code!]: {
                              ...(prev[benefit.code] as BenefitSetting),
                              effective_to: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <Button
              onClick={handleSave}
              className={`
                w-full py-1.5 text-xs font-medium transition-all
                ${saveStatus === "success" ? "bg-green-600" : ""}
                ${saveStatus === "error" ? "bg-red-600" : ""}
              `}
              disabled={saving}
            >
              {saving ? (
                <div className="flex items-center space-x-1 justify-center">
                  <span className="animate-spin border-2 border-t-transparent border-white rounded-full w-3 h-3" />
                  <span>Saving...</span>
                </div>
              ) : saveStatus === "success" ? (
                "Saved!"
              ) : (
                "Save Settings"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
