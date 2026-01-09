"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

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

import type { Membership, User } from "../../types";
import { updateItem } from "../../providers/coopApi";
import { getLoggedUserIdFallback1 } from "../../helpers";

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
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (membership && isOpen) {
      setUserId(String(membership.user_id));
      setMonthlyAmount(String(membership.monthly_amount));
      setStartDate(membership.start_date || "");
      setEndDate(membership.end_date || "");
      setIsActive(membership.is_active);
    }
  }, [membership, isOpen]);

  if (!membership) return null;

  const handleSubmit = async () => {
    const payload = {
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
    } catch (err) {
      console.error(err);
      toast.error("Failed to update membership.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
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
            <Label>Monthly Deduction</Label>
            <Input
              type="number"
              step="0.01"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={String(isActive)} onValueChange={(val) => setIsActive(Number(val))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Active</SelectItem>
                <SelectItem value="0">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={submitting}
          >
            {submitting ? "Updating..." : "Update Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
