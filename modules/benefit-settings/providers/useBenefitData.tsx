"use client";

import { useCallback, useState, useEffect } from "react";
import { BenefitCode, BenefitSetting, UserData } from "../types";
import * as benefitApi from "./benefitApi";


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
    try {
      const data = await benefitApi.fetchBenefitSettings();
      const mapped: Record<BenefitCode, BenefitSetting | null> = {
        SSS: null,
        PAGIBIG: null,
        PHILHEALTH: null,
      };

      if (Array.isArray(data)) {
        data.forEach((item: BenefitSetting) => {
          mapped[item.benefit_code] = { ...item };
        });
      }

      setSettings(mapped);
    } catch (e) {
      console.error("Failed to load benefit settings", e);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await benefitApi.fetchUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load users", e);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      loadSettings();
      loadUsers();
    }, 0);
  }, [loadSettings, loadUsers]);

  function getUserName(id: number | null) {
    if (!id) return "Unknown";
    const u = users.find((x) => x.user_id === id);
    return u ? `${u.user_fname} ${u.user_lname}` : `User ${id}`;
  }

  return { settings, setSettings, users, loadSettings, getUserName };
}
