"use client";

import { useCallback, useState, useEffect } from "react";
import {
  BenefitCode,
  BenefitSetting,
  BenefitSettingRaw,
  UserData,
} from "../types";

const BENEFITS: BenefitCode[] = ["SSS", "PAGIBIG", "PHILHEALTH"];

export function useBenefitData() {
  const [settings, setSettings] = useState<
    Record<BenefitCode, BenefitSetting | null>
  >({
    SSS: null,
    PAGIBIG: null,
    PHILHEALTH: null,
  });

  const [users, setUsers] = useState<UserData[]>([]);

  const loadSettings = useCallback(async () => {
    const res = await fetch(
      "http://100.126.246.124:8060/items/benefit_cutoff_settings"
    );
    const json = await res.json();
    const data = json.data ?? json;

    const mapped: Record<BenefitCode, BenefitSetting | null> = {
      SSS: null,
      PAGIBIG: null,
      PHILHEALTH: null,
    };

    if (Array.isArray(data)) {
      data.forEach((item: BenefitSettingRaw) => {
        mapped[item.benefit_code] = { ...item };
      });
    }

    setSettings(mapped);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await fetch("http://100.126.246.124:8060/items/user");
    const json = await res.json();
    const data = json.data ?? json;
    setUsers(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, [loadSettings, loadUsers]);

  function getUserName(id: number | null) {
    if (!id) return "Unknown";
    const u = users.find((x) => x.user_id === id);
    return u ? `${u.user_fname} ${u.user_lname}` : `User ${id}`;
  }

  return { settings, setSettings, users, loadSettings, getUserName };
}
