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

import { Plus } from "lucide-react";

import type { EmployeeLoan } from "../../types";
import { updateItem } from "../../providers/coopApi";
import { getLoggedUserIdFallback1 } from "../../helpers";

export function EditLoanModal({
  isOpen,
  loan,
  totalPaid,
  onClose,
  onUpdated,
  onOpenOnboardPayment,
}: {
  isOpen: boolean;
  loan: EmployeeLoan | null;
  totalPaid?: number;
  onClose: () => void;
  onUpdated: (updated: EmployeeLoan) => void;
  onOpenOnboardPayment?: (loan: EmployeeLoan) => void;
}) {
  const [status, setStatus] = useState<EmployeeLoan["status"]>("ACTIVE");
  const [monthlyPay, setMonthlyPay] = useState<number>(0);
  const [endDate, setEndDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const accumulatedAmount =
    totalPaid !== undefined ? totalPaid : Number(loan?.accumulated_amount || 0);

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
            <div className="flex items-center justify-between">
              <Label>Total Paid (Accumulated)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-normal">(Read-only)</span>
                {onOpenOnboardPayment && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onOpenOnboardPayment(loan);
                    }}
                    className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Onboard Payment
                  </Button>
                )}
              </div>
            </div>
            <Input
              type="number"
              step="0.01"
              value={accumulatedAmount}
              disabled
              readOnly
              className="bg-muted text-muted-foreground cursor-not-allowed select-none"
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
