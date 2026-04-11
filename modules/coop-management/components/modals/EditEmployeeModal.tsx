"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CutoffSetting, Membership, User } from "../../types";
import { listItems, updateItem } from "../../providers/coopApi";
import { getLoggedUserIdFallback1 } from "../../helpers";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateMid(ymd: string) {
  return new Date(`${ymd}T00:00:00`);
}

function todayMid() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function generateMembershipId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `COOP-${y}${m}${day}-${rand}`;
}

function isForbiddenFieldError(err: unknown, field: string) {
  const e = err as Record<string, unknown>;
  const status = e?.status;
  const msg = String(e?.message ?? "");
  return (
    status === 403 ||
    (msg.includes("FORBIDDEN") && msg.includes(field)) ||
    (msg.includes("permission") && msg.includes(field))
  );
}

async function checkMembershipIdExistsExcludingCurrent(
  membershipId: string,
  currentId: number
): Promise<{ supported: boolean; exists: boolean }> {
  try {
    const res = await listItems<Membership>("coop_savings_membership", {
      limit: "1",
      ["filter[membership_id][_eq]"]: membershipId,
      ["filter[id][_neq]"]: String(currentId),
    });
    return { supported: true, exists: res.data.length > 0 };
  } catch (err) {
    if (isForbiddenFieldError(err, "membership_id")) {
      return { supported: false, exists: false };
    }
    throw err;
  }
}

type StartMode = "PRESENT_CUTOFF" | "NEXT_CUTOFF" | "CUSTOM_DATE";

function cutoffLabel(c: CutoffSetting) {
  return `${c.cutoff_type} (${c.start_date} to ${c.end_date})`;
}

function pickPresentAndNext(cutoffs: CutoffSetting[]) {
  const now = todayMid();

  const preferred = cutoffs.filter(
    (c) => String(c.period_status ?? "").toUpperCase() === "OPEN"
  );
  const source = preferred.length > 0 ? preferred : cutoffs;

  const sorted = [...source].sort(
    (a, b) =>
      toDateMid(a.start_date).getTime() - toDateMid(b.start_date).getTime()
  );

  if (sorted.length === 0)
    return {
      present: null as CutoffSetting | null,
      next: null as CutoffSetting | null,
    };

  const idxInRange = sorted.findIndex((c) => {
    const s = toDateMid(c.start_date).getTime();
    const e = toDateMid(c.end_date).getTime();
    const t = now.getTime();
    return t >= s && t <= e;
  });

  if (idxInRange >= 0) {
    return {
      present: sorted[idxInRange],
      next: sorted[idxInRange + 1] ?? null,
    };
  }

  const idxUpcoming = sorted.findIndex(
    (c) => toDateMid(c.start_date).getTime() > now.getTime()
  );
  if (idxUpcoming >= 0) {
    const present = sorted[Math.max(0, idxUpcoming - 1)];
    const next = sorted[idxUpcoming] ?? null;
    return {
      present,
      next: next === present ? sorted[idxUpcoming + 1] ?? null : next,
    };
  }

  return { present: sorted[sorted.length - 1], next: null };
}

export function EditEmployeeModal({
  isOpen,
  membership,
  users,
  onClose,
  onEdited,
}: {
  isOpen: boolean;
  membership: Membership | null;
  users: User[];
  onClose: () => void;
  onEdited: (updatedMembership: Membership) => void;
}) {
  const [userId, setUserId] = useState("");
  const [membershipId, setMembershipId] = useState("");

  const [checkingMembershipId, setCheckingMembershipId] = useState(false);
  const [membershipIdOk, setMembershipIdOk] = useState<boolean | null>(null);
  const [membershipIdCheckSupported, setMembershipIdCheckSupported] =
    useState(true);

  const warnedPermissionRef = useRef(false);

  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startMode, setStartMode] = useState<StartMode>("CUSTOM_DATE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(1);


  const [loadingCutoffs, setLoadingCutoffs] = useState(false);
  const [presentCutoff, setPresentCutoff] = useState<CutoffSetting | null>(
    null
  );
  const [nextCutoff, setNextCutoff] = useState<CutoffSetting | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const warnPermissionOnce = (field: string) => {
    if (warnedPermissionRef.current) return;
    warnedPermissionRef.current = true;
    toast.error(
      `Directus forbids reading/filtering "${field}". Ask admin to allow the field/collection permissions.`
    );
  };

  const loadCutoffSettings = async () => {
    setLoadingCutoffs(true);
    try {
      const res = await listItems<CutoffSetting>("cutoff_settings", {
        limit: "-1",
      });
      const list = res.data ?? [];

      const { present, next } = pickPresentAndNext(list);
      setPresentCutoff(present);
      setNextCutoff(next);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCutoffs(false);
    }
  };

  useEffect(() => {
    if (membership && isOpen) {
      warnedPermissionRef.current = false;

      setUserId(String(membership.user_id));
      const mRecord = membership as unknown as Record<string, unknown>;
      setMembershipId(String(mRecord?.membership_id ?? ""));
      setMonthlyAmount(String(mRecord?.monthly_amount ?? ""));

      setStartDate(membership.start_date || "");
      setEndDate(membership.end_date || "");
      setIsActive(membership.is_active);

      setStartMode("CUSTOM_DATE"); // default to custom for edit
      setMembershipIdOk(null);
      setMembershipIdCheckSupported(true);
      setCheckingMembershipId(false);

      void loadCutoffSettings();
    }
  }, [membership, isOpen]);

  useEffect(() => {
    if (startMode === "PRESENT_CUTOFF") {
      if (presentCutoff?.start_date) setStartDate(presentCutoff.start_date);
      else setStartMode("CUSTOM_DATE");
    } else if (startMode === "NEXT_CUTOFF") {
      if (nextCutoff?.start_date) setStartDate(nextCutoff.start_date);
      else {
        toast.message("No next cutoff found. Please use Custom Date.");
        setStartMode("CUSTOM_DATE");
      }
    }
  }, [startMode, presentCutoff, nextCutoff]);

  if (!membership) return null;

  const generateAndSetId = async () => {
    setCheckingMembershipId(true);
    setMembershipIdOk(null);

    try {
      if (!membershipIdCheckSupported) {
        setMembershipId(generateMembershipId());
        return;
      }

      for (let i = 0; i < 6; i++) {
        const candidate = generateMembershipId();
        const r = await checkMembershipIdExistsExcludingCurrent(
          candidate,
          membership.id
        );

        if (!r.supported) {
          setMembershipIdCheckSupported(false);
          setMembershipId(candidate);
          setMembershipIdOk(null);
          warnPermissionOnce("membership_id");
          return;
        }

        if (!r.exists) {
          setMembershipId(candidate);
          setMembershipIdOk(true);
          return;
        }
      }

      setMembershipId(generateMembershipId());
      setMembershipIdOk(null);
      toast.message(
        "Membership ID generated. Uniqueness will be validated on save."
      );
    } catch (e) {
      console.error(e);
      setMembershipId(generateMembershipId());
      setMembershipIdOk(null);
    } finally {
      setCheckingMembershipId(false);
    }
  };

  const validateMembershipId = async () => {
    const trimmed = membershipId.trim();
    if (!trimmed) {
      setMembershipIdOk(false);
      toast.error("Membership ID is required.");
      return false;
    }

    if (!membershipIdCheckSupported) {
      setMembershipIdOk(null);
      warnPermissionOnce("membership_id");
      return true;
    }

    setCheckingMembershipId(true);
    try {
      const r = await checkMembershipIdExistsExcludingCurrent(
        trimmed,
        membership.id
      );

      if (!r.supported) {
        setMembershipIdCheckSupported(false);
        setMembershipIdOk(null);
        warnPermissionOnce("membership_id");
        return true;
      }

      if (r.exists) {
        setMembershipIdOk(false);
        toast.error("Membership ID already exists. Please enter a unique ID.");
        return false;
      }

      setMembershipIdOk(true);
      return true;
    } catch (e) {
      console.error(e);
      setMembershipIdOk(null);
      toast.error("Unable to validate Membership ID.");
      return false;
    } finally {
      setCheckingMembershipId(false);
    }
  };

  const handleSubmit = async () => {
    if (!membershipId.trim()) return toast.error("Membership ID is required.");
    if (!monthlyAmount || Number(monthlyAmount) <= 0)
      return toast.error("Please enter a valid monthly amount.");
    if (!startDate) return toast.error("Start date is required.");
    if (endDate && new Date(endDate) < new Date(startDate))
      return toast.error("End date cannot be before start date.");

    const ok = await validateMembershipId();
    if (!ok) return;

    // ✅ Payroll Run owns total_months and total_collection → do NOT patch those here
    const payload = {
      membership_id: membershipId.trim(),
      monthly_amount: Number(monthlyAmount),
      start_date: startDate,
      end_date: endDate || null,
      is_active: isActive,
      updated_by: Number(getLoggedUserIdFallback1()),
    };

    setSubmitting(true);
    try {
      const updated = await updateItem<Membership>(
        "coop_savings_membership",
        membership.id,
        payload
      );
      onEdited(updated);
      toast.success("Updated successfully.");
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("membership_id")) {
        toast.error(
          'Update failed: ensure Directus role has Update access to "membership_id".'
        );
      } else {
        toast.error("Failed to update membership.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit Employee COOP Savings</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Employee</Label>
            <Select value={userId} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={String(u.user_id)}>
                    {u.user_fname} {u.user_lname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Membership ID</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateAndSetId}
                disabled={checkingMembershipId || submitting}
                className="h-8"
              >
                {checkingMembershipId ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" /> Generate
                  </span>
                )}
              </Button>
            </div>

            <Input
              value={membershipId}
              onChange={(e) => {
                setMembershipId(e.target.value);
                setMembershipIdOk(null);
              }}
              onBlur={() => {
                if (membershipId.trim()) void validateMembershipId();
              }}
              placeholder="Unique Membership ID"
            />

            <div className="text-xs text-muted-foreground">
              Must be unique. Manual input allowed.
              {membershipIdOk === true ? (
                <span className="ml-2 text-emerald-600">Unique</span>
              ) : membershipIdOk === false ? (
                <span className="ml-2 text-red-600">Already exists</span>
              ) : !membershipIdCheckSupported ? (
                <span className="ml-2 text-amber-600">
                  Cannot validate (Directus permission)
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Monthly Deduction</Label>
            <Input
              type="number"
              step="0.01"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Start Date Mode</Label>
              {loadingCutoffs ? (
                <span className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading
                  cutoffs...
                </span>
              ) : null}
            </div>

            <Select
              value={startMode}
              onValueChange={(v) => setStartMode(v as StartMode)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENT_CUTOFF">
                  Present Cutoff{" "}
                  {presentCutoff ? `- ${cutoffLabel(presentCutoff)}` : ""}
                </SelectItem>
                <SelectItem value="NEXT_CUTOFF">
                  Next Cutoff {nextCutoff ? `- ${cutoffLabel(nextCutoff)}` : ""}
                </SelectItem>
                <SelectItem value="CUSTOM_DATE">Custom Date</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  disabled={startMode !== "CUSTOM_DATE"}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={String(isActive)}
              onValueChange={(val) => setIsActive(Number(val))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Active</SelectItem>
                <SelectItem value="0">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={submitting}
          >
            {submitting ? "Updating..." : "Update Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditEmployeeModal;
