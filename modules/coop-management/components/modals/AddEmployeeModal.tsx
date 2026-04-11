"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, ChevronsUpDown, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CutoffSetting, Membership, User } from "../../types";
import { createItem, listItems } from "../../providers/coopApi";
import { getLoggedUserIdFallback1 } from "../../helpers";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateMid(ymd: string) {
  // Force local midnight
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

async function checkMembershipIdExists(membershipId: string): Promise<{
  supported: boolean;
  exists: boolean;
}> {
  try {
    const res = await listItems<Membership>("coop_savings_membership", {
      limit: "1",
      ["filter[membership_id][_eq]"]: membershipId,
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

  // Fallback: find the first upcoming cutoff
  const idxUpcoming = sorted.findIndex(
    (c) => toDateMid(c.start_date).getTime() > now.getTime()
  );
  if (idxUpcoming >= 0) {
    // "present" becomes the immediate previous if exists, else upcoming itself
    const present = sorted[Math.max(0, idxUpcoming - 1)];
    const next = sorted[idxUpcoming] ?? null;
    return {
      present,
      next: next === present ? sorted[idxUpcoming + 1] ?? null : next,
    };
  }

  // All cutoffs are in the past → present is last, next is null
  return { present: sorted[sorted.length - 1], next: null };
}

export function AddEmployeeModal({
  isOpen,
  onClose,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (newMembership: Membership) => void;
}) {
  const [userId, setUserId] = useState("");

  const [membershipId, setMembershipId] = useState("");
  const [checkingMembershipId, setCheckingMembershipId] = useState(false);
  const [membershipIdOk, setMembershipIdOk] = useState<boolean | null>(null);
  const [membershipIdCheckSupported, setMembershipIdCheckSupported] =
    useState(true);

  const warnedPermissionRef = useRef(false);

  const [monthlyAmount, setMonthlyAmount] = useState("");

  const [startMode, setStartMode] = useState<StartMode>("PRESENT_CUTOFF");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  ); // actual value used in payload
  const [endDate, setEndDate] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cutoffs, setCutoffs] = useState<CutoffSetting[]>([]);
  const [loadingCutoffs, setLoadingCutoffs] = useState(false);
  const [presentCutoff, setPresentCutoff] = useState<CutoffSetting | null>(
    null
  );
  const [nextCutoff, setNextCutoff] = useState<CutoffSetting | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const selectedUserLabel = useMemo(() => {
    if (!userId) return "";
    const u = availableUsers.find((x) => String(x.user_id) === String(userId));
    return u ? `${u.user_fname} ${u.user_lname}` : "";
  }, [userId, availableUsers]);

  const warnPermissionOnce = useCallback((field: string) => {
    if (warnedPermissionRef.current) return;
    warnedPermissionRef.current = true;
    toast.error(
      `Directus forbids reading/filtering "${field}". Ask admin to allow the field/collection permissions.`
    );
  }, []);

  const generateAndCheckUnique = useCallback(async () => {
    setCheckingMembershipId(true);
    setMembershipIdOk(null);

    try {
      if (!membershipIdCheckSupported) {
        setMembershipId(generateMembershipId());
        setMembershipIdOk(null);
        return;
      }

      for (let i = 0; i < 6; i++) {
        const candidate = generateMembershipId();
        const r = await checkMembershipIdExists(candidate);

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
        "Membership ID generated. Uniqueness will be validated on submit."
      );
    } catch (e) {
      console.error(e);
      setMembershipId(generateMembershipId());
      setMembershipIdOk(null);
    } finally {
      setCheckingMembershipId(false);
    }
  }, [membershipIdCheckSupported, warnPermissionOnce]);

  const loadCutoffSettings = async () => {
    setLoadingCutoffs(true);
    try {
      const res = await listItems<CutoffSetting>("cutoff_settings", {
        limit: "-1",
      });
      const list = res.data ?? [];
      setCutoffs(list);

      const { present, next } = pickPresentAndNext(list);
      setPresentCutoff(present);
      setNextCutoff(next);

      // default mode behavior
      if (present?.start_date) {
        setStartMode("PRESENT_CUTOFF");
        setStartDate(present.start_date);
      } else {
        setStartMode("CUSTOM_DATE");
        setStartDate(new Date().toISOString().slice(0, 10));
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load cutoff settings.");
      setStartMode("CUSTOM_DATE");
      setStartDate(new Date().toISOString().slice(0, 10));
    } finally {
      setLoadingCutoffs(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    warnedPermissionRef.current = false;

    setUserId("");
    setMonthlyAmount("");
    setEndDate("");

    setMembershipId("");
    setMembershipIdOk(null);
    setMembershipIdCheckSupported(true);
    setCheckingMembershipId(false);

    const runUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await listItems<User>("user", { limit: "-1" });
        setAvailableUsers(res.data);
      } catch (e) {
        console.error("Failed to fetch employees", e);
      } finally {
        setLoadingUsers(false);
      }
    };

    void runUsers();
    void generateAndCheckUnique();
    void loadCutoffSettings();
  }, [isOpen, generateAndCheckUnique]);

  useEffect(() => {
    // When start mode changes, update startDate accordingly
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
      const r = await checkMembershipIdExists(trimmed);

      if (!r.supported) {
        setMembershipIdCheckSupported(false);
        setMembershipIdOk(null);
        warnPermissionOnce("membership_id");
        return true;
      }

      if (r.exists) {
        setMembershipIdOk(false);
        toast.error("Membership ID already exists. Please use a unique ID.");
        return false;
      }

      setMembershipIdOk(true);
      return true;
    } catch (e) {
      console.error(e);
      setMembershipIdOk(null);
      toast.error("Unable to validate Membership ID. Please try again.");
      return false;
    } finally {
      setCheckingMembershipId(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId) return toast.error("Please select an employee.");
    if (!membershipId.trim())
      return toast.error("Please enter a Membership ID.");
    if (!monthlyAmount || Number(monthlyAmount) <= 0)
      return toast.error("Please enter a valid monthly amount.");
    if (!startDate) return toast.error("Please select a start date.");
    if (endDate && new Date(endDate) < new Date(startDate))
      return toast.error("End date cannot be before start date.");

    const ok = await validateMembershipId();
    if (!ok) return;

    // We want totals to be 0 on creation (payroll run updates them later).
    const basePayload: Record<string, unknown> = {
      user_id: Number(userId),
      membership_id: membershipId.trim(),
      monthly_amount: Number(monthlyAmount),
      start_date: startDate,
      end_date: endDate || null,
      is_active: 1,
      created_by: Number(getLoggedUserIdFallback1()),
    };

    const payloadWithTotals: Record<string, unknown> = {
      ...basePayload,
      total_months: 0,
      total_collection: 0,
    };

    setSubmitting(true);
    try {
      let created: Membership;

      try {
        created = await createItem<Membership>(
          "coop_savings_membership",
          payloadWithTotals
        );
      } catch (err) {
        // If Directus forbids those fields, retry without them (DB defaults to 0).
        if (
          isForbiddenFieldError(err, "total_months") ||
          isForbiddenFieldError(err, "total_collection")
        ) {
          created = await createItem<Membership>(
            "coop_savings_membership",
            basePayload
          );
        } else {
          throw err;
        }
      }

      onAdded(created);
      toast.success("Member added successfully.");
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("membership_id")) {
        toast.error(
          'Create failed: ensure Directus role has Create access to "membership_id".'
        );
      } else {
        toast.error("Failed to add member.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add Employee to COOP Savings</DialogTitle>
          <DialogDescription>
            Select an employee, assign a unique Membership ID, and choose the
            start date mode.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="employee">Search Employee</Label>

            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                >
                  {loadingUsers ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading
                      employees...
                    </span>
                  ) : userId ? (
                    selectedUserLabel || "Select employee..."
                  ) : (
                    "Select employee..."
                  )}

                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[470px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search employee by name..." />
                  <CommandList>
                    <CommandEmpty>No employee found.</CommandEmpty>
                    <CommandGroup>
                      {availableUsers.map((user) => (
                        <CommandItem
                          key={user.user_id}
                          value={`${user.user_fname} ${user.user_lname}`}
                          onSelect={() => {
                            setUserId(String(user.user_id));
                            setOpenCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              String(userId) === String(user.user_id)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {user.user_fname} {user.user_lname}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="membershipId">Membership ID</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateAndCheckUnique}
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
              id="membershipId"
              value={membershipId}
              onChange={(e) => {
                setMembershipId(e.target.value);
                setMembershipIdOk(null);
              }}
              onBlur={() => {
                if (membershipId.trim()) void validateMembershipId();
              }}
              placeholder="Auto-generated, but manual input is allowed"
            />

            <div className="text-xs text-muted-foreground">
              Must be unique.
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
            <Label htmlFor="amount">Monthly Deduction Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
              placeholder="e.g. 1000.00"
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
                {startMode !== "CUSTOM_DATE" ? (
                  <div className="text-xs text-muted-foreground">
                    Locked to{" "}
                    {startMode === "PRESENT_CUTOFF" ? "present" : "next"} cutoff
                    start date.
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>End Date (Optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
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
            {submitting ? "Adding..." : "Add Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
