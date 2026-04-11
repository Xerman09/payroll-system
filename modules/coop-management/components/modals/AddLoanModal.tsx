"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { EmployeeLoan, User } from "../../types";
import { formatPeso, getLoggedUserIdFallback1 } from "../../helpers";
import { createItem, listItems } from "../../providers/coopApi";

export function AddLoanModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (newLoan: EmployeeLoan) => void;
}) {
  const [userId, setUserId] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [monthsToPay, setMonthsToPay] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setUserId("");
    setLoanAmount("");
    setMonthsToPay(1);
    setStartDate(new Date().toISOString().slice(0, 10));

    const run = async () => {
      setLoadingUsers(true);
      try {
        const res = await listItems<User>("user", { limit: "-1" });
        setAvailableUsers(res.data);
      } catch (error) {
        console.error("Failed to fetch employees", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    run();
  }, [isOpen]);

  const numericLoanAmount = Number(loanAmount || 0);
  const interestRate = 0.03; // default 3%
  const interestAmount = Math.round(numericLoanAmount * interestRate * 100) / 100;
  const netReceived = Math.round((numericLoanAmount - interestAmount) * 100) / 100;
  const monthlyPayment =
    monthsToPay > 0 ? Math.round((numericLoanAmount / monthsToPay) * 100) / 100 : 0;

  const handleSubmit = async () => {
    if (!userId) return toast.error("Please select an employee.");
    if (!loanAmount || Number(loanAmount) <= 0) return toast.error("Please enter loan amount.");
    if (!monthsToPay || monthsToPay <= 0) return toast.error("Please enter months to pay.");
    if (!startDate) return toast.error("Please select a start date.");

    const payload = {
      user_id: Number(userId),
      loan_amount: Number(Number(loanAmount).toFixed(2)),
      interest_rate: 3.0,
      interest_amount: Number(interestAmount.toFixed(2)),
      net_amount_released: Number(netReceived.toFixed(2)),
      months_to_pay: Number(monthsToPay),
      monthly_payment: Number(monthlyPayment.toFixed(2)),
      start_date: startDate,
      end_date: null,
      status: "ACTIVE" as const,
      created_by: Number(getLoggedUserIdFallback1()),
    };

    setSubmitting(true);
    try {
      const created = await createItem<EmployeeLoan>("employee_loan", payload);
      onCreate(created);
      toast.success("Loan created successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create loan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Loan</DialogTitle>
          <DialogDescription>
            Search and select an employee to create a new loan record.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Search Employee</Label>

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
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading employees...
                    </span>
                  ) : userId ? (
                    availableUsers.find((u) => String(u.user_id) === String(userId)) ? (
                      `${availableUsers.find((u) => String(u.user_id) === String(userId))?.user_fname} ${
                        availableUsers.find((u) => String(u.user_id) === String(userId))?.user_lname
                      }`
                    ) : (
                      "Select employee..."
                    )
                  ) : (
                    "Select employee..."
                  )}

                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[550px] p-0" align="start">
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
                              String(userId) === String(user.user_id) ? "opacity-100" : "opacity-0"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Loan Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="e.g. 1000.00"
              />
            </div>

            <div className="grid gap-2">
              <Label>Months to Pay</Label>
              <Input
                type="number"
                min={1}
                value={monthsToPay}
                onChange={(e) => setMonthsToPay(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm border border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate (3%):</span>
              <span className="font-medium text-red-600">{formatPeso(interestAmount)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Proceeds:</span>
              <span className="font-medium text-emerald-600">{formatPeso(netReceived)}</span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                Monthly Amortization:
              </span>
              <span className="text-lg font-bold text-primary">
                {formatPeso(monthlyPayment)}
              </span>
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
            {submitting ? "Processing..." : "Confirm Loan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
