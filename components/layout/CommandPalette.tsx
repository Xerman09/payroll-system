"use client";

import { useEffect, useState, useCallback } from "react";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Calendar,
  CreditCard,
  LayoutDashboard,
  Settings,
  User,
  Briefcase,
  History,
  FileText,
  PhilippinePeso,
  PiggyBank,
  Folders,
  HandCoins,
  Calendars,
  Anchor
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { searchEmployees } from "@/modules/profile/providers/profileApi";
import { getLoggedUser } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface EmployeeSearch {
  user_id: string | number;
  user_fname: string;
  user_lname: string;
  user_image?: string;
  user_position: string;
}

export function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<EmployeeSearch[]>([]);
  const loggedUser = getLoggedUser();
  const userId = loggedUser?.user_id || "me";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  // Handle dynamic employee search
  useEffect(() => {
    const fetchResults = async () => {
      if (query.length < 2) {
        setEmployees([]);
        return;
      }

      try {
        const results = await searchEmployees(query);
        setEmployees(results);
      } catch (err) {
        console.error("Search failed:", err);
      }
    };

    const timer = setTimeout(fetchResults, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, [setOpen]);

  const NEXT_PUBLIC_DIRECTUS_URL = process.env.NEXT_PUBLIC_DIRECTUS_URL || "";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Type a name, module, or command..." 
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[450px]">
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Main Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push(`/dashboard/${userId}`))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-blue-500" />
            <span>Dashboard</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Navigation &gt; Main</span>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => router.push(`/wage/${userId}`))}>
            <PhilippinePeso className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Compensation Management</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Payroll &gt; Wage</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push(`/wage/${userId}?tab=salary-grade`))}>
            <FileText className="mr-2 h-4 w-4 text-emerald-400" />
            <span className="pl-4">Salary Grade</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Wage &gt; Grade</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push(`/coop/${userId}`))}>
            <PiggyBank className="mr-2 h-4 w-4 text-pink-500" />
            <span>COOP Management</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Payroll &gt; COOP</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push(`/coop/${userId}?tab=loans`))}>
            <CreditCard className="mr-2 h-4 w-4 text-pink-400" />
            <span className="pl-4">Loans Management</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">COOP &gt; Loans</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push(`/payroll-records/${userId}`))}>
            <Folders className="mr-2 h-4 w-4 text-yellow-500" />
            <span>Payroll Records</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Records &gt; Main</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push(`/payroll-records/${userId}?tab=top-sheet`))}>
            <FileText className="mr-2 h-4 w-4 text-yellow-400" />
            <span className="pl-4">Payroll Top Sheet</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Records &gt; Sheets</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push(`/payroll-run/${userId}`))}>
            <Calculator className="mr-2 h-4 w-4 text-orange-500" />
            <span>Payroll Run</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Processing &gt; Run</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings & Utilities">
          <CommandItem onSelect={() => runCommand(() => router.push(`/benefit-settings/${userId}`))}>
            <HandCoins className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Benefits Management</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Settings &gt; Benefits</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push(`/calendar-management/${userId}`))}>
            <Calendar className="mr-2 h-4 w-4 text-red-500" />
            <span>Holiday Calendar</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Settings &gt; Events</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => router.push(`/cutoff-settings/${userId}`))}>
            <Calendars className="mr-2 h-4 w-4 text-purple-500" />
            <span>Cutoff Settings</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Settings &gt; Dates</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Logistics Compensation">
          <CommandItem onSelect={() => runCommand(() => router.push(`/logistics-compensation/settings/${userId}`))}>
            <Anchor className="mr-2 h-4 w-4 text-cyan-600" />
            <span>Logistics Settings</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Logistics &gt; Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push(`/logistics-compensation/wage-matrix/${userId}`))}>
            <Calculator className="mr-2 h-4 w-4 text-cyan-500" />
            <span>Wage Matrix</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Logistics &gt; Matrix</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Hidden Utilities (Advanced)">
          <CommandItem onSelect={() => runCommand(() => router.push(`/additions-deductions/${userId}`))}>
            <Briefcase className="mr-2 h-4 w-4 text-slate-500" />
            <span>Additions & Deductions</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Advanced &gt; Adjustments</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push(`/allowance-management/${userId}`))}>
            <History className="mr-2 h-4 w-4 text-slate-500" />
            <span>Allowance Management</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Advanced &gt; Allowances</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push(`/retro/${userId}`))}>
            <PhilippinePeso className="mr-2 h-4 w-4 text-slate-500" />
            <span>Retro Pay</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Advanced &gt; Retro</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="User Info">
          <CommandItem onSelect={() => runCommand(() => router.push(`/profile/${userId}`))}>
            <User className="mr-2 h-4 w-4" />
            <span>My Profile</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">User &gt; Profile</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setOpen(false))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Keyboard Shortcuts</span>
            <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Help &gt; Info</span>
          </CommandItem>
        </CommandGroup>

        {employees.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Employees">
              {employees.map((employee) => {
                const imgUrl = employee.user_image 
                  ? `${NEXT_PUBLIC_DIRECTUS_URL}/assets/${employee.user_image}`
                  : null;
                
                return (
                  <CommandItem 
                    key={employee.user_id}
                    onSelect={() => runCommand(() => router.push(`/profile/${employee.user_id}`))}
                  >
                    <Avatar className="h-6 w-6 mr-2">
                       <AvatarImage src={imgUrl || ""} className="object-cover" />
                       <AvatarFallback className="text-[10px]">
                         {employee.user_fname?.[0]}{employee.user_lname?.[0]}
                       </AvatarFallback>
                    </Avatar>
                    <span>{employee.user_fname} {employee.user_lname}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground italic truncate max-w-[100px]">
                      {employee.user_position}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-widest">Employees &gt; Profile</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
