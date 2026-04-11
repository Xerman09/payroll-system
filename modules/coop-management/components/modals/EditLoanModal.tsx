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

import type { EmployeeLoan } from "../../types";
import { updateItem } from "../../providers/coopApi";
import { getLoggedUserIdFallback1 } from "../../helpers";

export function EditLoanModal({
  isOpen,
  loan,
  onClose,
  onUpdated,
}: {
  isOpen: boolean;
  loan: EmployeeLoan | null;
  onClose: () => void;
  onUpdated: (updated: EmployeeLoan) => void;
}) {
  const [status, setStatus] = useState<EmployeeLoan["status"]>("ACTIVE");
  const [monthlyPay, setMonthlyPay] = useState<number>(0);
  const [endDate, setEndDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loan && isOpen) {
      setStatus(loan.status);
      setMonthlyPay(Number(loan.monthly_payment || 0));
      setEndDate(loan.end_date || "");
    }
  }, [loan, isOpen]);

  if (!loan) return null;

  const handleSubmit = async () => {
    const payload: Partial<EmployeeLoan> = {
      status,
      monthly_payment: monthlyPay,
      end_date: endDate || null,
      updated_by: Number(getLoggedUserIdFallback1()),
    };

    setSubmitting(true);
    try {
      const updated = await updateItem<EmployeeLoan>("employee_loan", loan.loan_id, payload);
      onUpdated(updated);
      toast.success("Updated successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update loan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Edit Loan #{loan.loan_id}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as EmployeeLoan["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="PAID">PAID</SelectItem>
                <SelectItem value="CANCELLED">CANCELLED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Monthly Amortization</Label>
            <Input
              type="number"
              step="0.01"
              value={monthlyPay}
              onChange={(e) => setMonthlyPay(Number(e.target.value) || 0)}
            />
          </div>

          <div className="grid gap-2">
            <Label>End Date (Optional)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
            {submitting ? "Updating..." : "Update Loan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
