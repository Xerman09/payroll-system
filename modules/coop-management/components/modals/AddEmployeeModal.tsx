"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { Membership, User } from "../../types";
import { createItem, listItems } from "../../providers/coopApi";
import { getLoggedUserIdFallback1 } from "../../helpers";

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
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setUserId("");
    setMonthlyAmount("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");

    const run = async () => {
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

    run();
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!userId) return toast.error("Please select an employee.");
    if (!monthlyAmount || Number(monthlyAmount) <= 0)
      return toast.error("Please enter a valid monthly amount.");
    if (!startDate) return toast.error("Please select a start date.");
    if (endDate && new Date(endDate) < new Date(startDate))
      return toast.error("End date cannot be before start date.");

    const payload = {
      user_id: Number(userId),
      monthly_amount: Number(monthlyAmount),
      start_date: startDate,
      end_date: endDate || null,
      is_active: 1,
      created_by: Number(getLoggedUserIdFallback1()),
    };

    setSubmitting(true);
    try {
      const created = await createItem<Membership>("coop_savings_membership", payload);
      onAdded(created);
      toast.success("Member added successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add member.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Employee to COOP Savings</DialogTitle>
          <DialogDescription>
            Search and select an employee to start their savings plan.
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

              <PopoverContent className="w-[450px] p-0" align="start">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>End Date (Optional)</Label>
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
            {submitting ? "Adding..." : "Add Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
