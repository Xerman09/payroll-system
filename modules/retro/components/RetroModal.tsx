import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Employee, RetroFormState } from "../types";

interface RetroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  initialData?: RetroFormState;
  employees: Employee[];
  onSubmit: (data: RetroFormState) => void;
}

export default function RetroModal({
  open,
  onOpenChange,
  isEditing,
  initialData,
  employees,
  onSubmit,
}: RetroModalProps) {
  const [form, setForm] = useState<RetroFormState>({
    user_id: "",
    amount: "",
    description: "",
    cutoff_start: "",
    cutoff_end: "",
  });

  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");

  // Reset or populate form when dialog opens/closes
  useEffect(() => {
    if (open && initialData) {
      setTimeout(() => setForm(initialData), 0);
    } else if (!open) {
      setTimeout(() => {
        setForm({
          user_id: "",
          amount: "",
          description: "",
          cutoff_start: "",
          cutoff_end: "",
        });
        setEmployeeSearchTerm("");
      }, 0);
    }
  }, [open, initialData]);

  // Helper to format employee name
  const getEmployeeName = (id: string) => {
    const emp = employees.find((e) => String(e.user_id) === id);
    if (!emp) return "Select Employee";
    return `${emp.user_fname} ${emp.user_mname ? emp.user_mname + " " : ""}${
      emp.user_lname
    }`;
  };

  // Filter employees for dropdown
  const filteredEmployees = useMemo(() => {
    const q = employeeSearchTerm.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const name = `${emp.user_fname} ${
        emp.user_mname ? emp.user_mname + " " : ""
      }${emp.user_lname}`.toLowerCase();
      return (
        String(emp.user_id).includes(q) ||
        name.includes(q) ||
        (emp.user_email || "").toLowerCase().includes(q)
      );
    });
  }, [employees, employeeSearchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Retro Pay" : "Add New Retro Pay"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify the details of this retroactive payment."
              : "Create a new retroactive payment record for an employee."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Employee Selector */}
          <div className="grid gap-2">
            <Label>Employee</Label>
            <Popover
              open={employeeDropdownOpen}
              onOpenChange={setEmployeeDropdownOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between",
                    !form.user_id && "text-muted-foreground"
                  )}
                >
                  {form.user_id
                    ? getEmployeeName(form.user_id)
                    : "Select employee..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[460px] p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search by name or ID..."
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {filteredEmployees.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No employees found.
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <div
                        key={emp.user_id}
                        className={cn(
                          "relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                          String(emp.user_id) === form.user_id && "bg-accent"
                        )}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            user_id: String(emp.user_id),
                          }));
                          setEmployeeDropdownOpen(false);
                          setEmployeeSearchTerm("");
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {emp.user_fname} {emp.user_mname} {emp.user_lname}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ID: {emp.user_id} • {emp.user_email}
                          </span>
                        </div>
                        {String(emp.user_id) === form.user_id && (
                          <Check className="ml-auto h-4 w-4 opacity-100" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  ₱
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: e.target.value }))
                  }
                  className="pl-7 font-mono"
                />
              </div>
            </div>
            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g. Adjustment for March"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cutoff_start">Cutoff Start</Label>
              <Input
                id="cutoff_start"
                type="date"
                className="w-full block"
                value={form.cutoff_start}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cutoff_start: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cutoff_end">Cutoff End</Label>
              <Input
                id="cutoff_end"
                type="date"
                className="w-full block"
                value={form.cutoff_end}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cutoff_end: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(form)}>
            {isEditing ? "Save Changes" : "Create Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
