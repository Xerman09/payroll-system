// modules/allowance/AllowanceModule.tsx
"use client";

import React, { useCallback, useMemo, useState } from "react";
import { mutate } from "swr";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Plus,
  Search,
  FileText,
  RotateCcw,
  Repeat,
  CalendarClock,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import type {
  Allowance,
  AllowanceMode,
  AllowanceSaveMeta,
  AllowanceStatusFilter,
  PayCycle,
  FormRow,
} from "./types";

import {
  useAllowancesQuery,
  useUsers,
  createAllowance,
  updateAllowance,
  deleteAllowance,
  fullnameFromUser,
} from "./providers/allowanceApi";

import AllowanceTable from "./components/AllowanceTable";
import AllowanceModal from "./components/AllowanceModal";

const PAGE_SIZE = 10;

const PAY_CYCLE_FILTERS: Array<{ value: "all" | PayCycle; label: string }> = [
  { value: "all", label: "All Pay Cycles" },
  { value: "PER_CUTOFF", label: "PER_CUTOFF" },
  { value: "PER_MONTH", label: "PER_MONTH" },
];

export default function AllowanceModule() {
  const { users, loading: usersLoading } = useUsers();

  // Tabs
  const [mode, setMode] = useState<AllowanceMode>("one_time");

  // Paging & filters
  const [page, setPage] = useState(1);
  const [searchName, setSearchName] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AllowanceStatusFilter>("all");

  // Recurring-only filter
  const [payCycleFilter, setPayCycleFilter] = useState<"all" | PayCycle>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Allowance | null>(null);

  // Convert typed name -> user IDs
  const filterUserIds = useMemo(() => {
    if (!searchName.trim()) return null;
    const lower = searchName.toLowerCase();

    return users
      .filter((u) => fullnameFromUser(u).toLowerCase().includes(lower))
      .map((u) => u.user_id);
  }, [searchName, users]);

  const {
    rows: allowances,
    total,
    loading: allowancesLoading,
    mutate: reloadAllowances,
  } = useAllowancesQuery({
    page,
    pageSize: PAGE_SIZE,
    searchName,
    searchDescription,
    mode,
    status: statusFilter,
    payCycle: mode === "recurring" ? payCycleFilter : "all",
    filterUserIds,
  });

  const reloadAll = useCallback(() => {
    reloadAllowances();
    mutate("/api/allowance?mode=users");
  }, [reloadAllowances]);

  const handleSave = async (
    rows: FormRow[],
    employeeId: number,
    meta: AllowanceSaveMeta
  ) => {
    const payloads = rows.map((r) => {
      const description = r.type === "Others" ? (r.other ?? "").trim() : r.type;

      const base = {
        user_id: employeeId,
        amount: Number(r.amount).toFixed(2),
        description,
      };

      if (meta.mode === "one_time") {
        return {
          ...base,
          is_recurring: 0 as const,
          pay_cycle: "N/A" as const,
          start_date: null,
          end_date: null,
          is_active: true,

          cutoff_start: meta.cutoff_start,
          cutoff_end: meta.cutoff_end,

          is_processed: editing?.is_processed ?? 0,
        };
      }

      return {
        ...base,
        is_recurring: 1 as const,
        pay_cycle: meta.pay_cycle,
        start_date: meta.start_date,
        end_date: meta.end_date,
        is_active: meta.is_active,

        cutoff_start: null,
        cutoff_end: null,

        is_processed: editing?.is_processed ?? 0,
      };
    });

    try {
      if (editing) {
        await updateAllowance(editing.allowance_id, payloads[0]);
        toast.success("Allowance updated successfully.");
      } else {
        for (const p of payloads) {
          await createAllowance(p);
        }
        toast.success("Allowance(s) created successfully.");
      }

      setDialogOpen(false);
      setEditing(null);
      reloadAll();
    } catch (err) {
      console.error("[allowance] save error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed: " + msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this allowance? This cannot be undone.")) return;
    try {
      await deleteAllowance(id);
      reloadAll();
      toast.success("Deleted successfully.");
    } catch (err) {
      console.error("[allowance] delete error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Delete failed: " + msg);
    }
  };

  const handleReset = () => {
    setSearchName("");
    setSearchDescription("");
    setStatusFilter("all");
    setPayCycleFilter("all");
    setPage(1);
    toast.info("Filters reset");
  };

  const statusOptions =
    mode === "one_time"
      ? [
          { value: "all" as const, label: "All Status" },
          { value: "processed" as const, label: "Processed" },
          { value: "unprocessed" as const, label: "Pending" },
        ]
      : [
          { value: "all" as const, label: "All Status" },
          { value: "active" as const, label: "Active" },
          { value: "inactive" as const, label: "Inactive" },
        ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Row (COOP-style) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Allowance Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage one-time (cutoff) and recurring allowances (monthly / per
              cutoff).
            </p>
          </div>

          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {mode === "one_time" ? "Add One-time" : "Add Recurring"}
          </Button>
        </div>

        <Separator />

        {/* Main Content Card (COOP-style) */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-6 space-y-6">
            {/* Filters Row (COOP-style grid) */}
            {/* Filters Row (inline Pay Cycle when recurring) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Search employee */}
              <div
                className={`space-y-2 ${
                  mode === "recurring" ? "md:col-span-3" : "md:col-span-4"
                }`}
              >
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Search employee
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type name..."
                    value={searchName}
                    onChange={(e) => {
                      setSearchName(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Search description */}
              <div
                className={`space-y-2 ${
                  mode === "recurring" ? "md:col-span-3" : "md:col-span-4"
                }`}
              >
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Search description
                </Label>
                <div className="relative">
                  <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type description..."
                    value={searchDescription}
                    onChange={(e) => {
                      setSearchDescription(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Status filter */}
              <div className="md:col-span-2 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v as AllowanceStatusFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pay cycle filter (recurring only) */}
              {mode === "recurring" && (
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pay Cycle
                  </Label>
                  <Select
                    value={payCycleFilter}
                    onValueChange={(v) => {
                      setPayCycleFilter(v as "all" | PayCycle);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select pay cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAY_CYCLE_FILTERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quick Actions */}
              <div className="md:col-span-2 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quick Actions
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleReset}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs BELOW fields (your request) */}
            <Tabs
              value={mode}
              onValueChange={(v) => {
                const next = v as AllowanceMode;
                setMode(next);
                setPage(1);
                setStatusFilter("all");
                if (next === "one_time") setPayCycleFilter("all");
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-2">
                <TabsTrigger value="one_time">
                  <span className="inline-flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    One-time Allowances
                  </span>
                </TabsTrigger>
                <TabsTrigger value="recurring">
                  <span className="inline-flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Recurring Allowances
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* Table (shared) */}
              <TabsContent value={mode} className="mt-0 space-y-4">
                <div className="rounded-md border bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                  <AllowanceTable
                    mode={mode}
                    data={allowances}
                    loading={allowancesLoading}
                    total={total}
                    page={page}
                    pageSize={PAGE_SIZE}
                    users={users}
                    onPageChange={setPage}
                    onEdit={(item) => {
                      setEditing(item);
                      setDialogOpen(true);
                    }}
                    onDelete={handleDelete}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Modal */}
        <AllowanceModal
          key={editing ? editing.allowance_id : `new-${mode}`}
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
            setDialogOpen(open);
          }}
          editing={editing}
          users={users}
          usersLoading={usersLoading}
          defaultMode={mode}
          onSave={handleSave}
        />
      </div>
    </DashboardLayout>
  );
}
