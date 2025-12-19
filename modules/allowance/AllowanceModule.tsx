"use client";

import React, { useCallback, useState, useMemo } from "react";
import { mutate } from "swr";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Search,
  Filter,
  RotateCcw,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Allowance, FormRow } from "./types";
import {
  useAllowancesQuery,
  useUsers,
  createAllowance,
  updateAllowance,
  deleteAllowance,
  fullnameFromUser, // <--- 1. Added import here
} from "./providers/allowanceApi";

import AllowanceTable from "./components/AllowanceTable";
import AllowanceModal from "./components/AllowanceModal";

export default function AllowanceModule() {
  const { users, loading: usersLoading } = useUsers();

  // -- State --
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [searchName, setSearchName] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [filterProcessed, setFilterProcessed] = useState<
    "all" | "processed" | "unprocessed"
  >("all");

  // -- Dialog State --
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Allowance | null>(null);

  // -- Logic: Convert Name Search to User IDs --
  // We use the already loaded 'users' list to find IDs that match the typed name.
  const filterUserIds = useMemo(() => {
    if (!searchName.trim()) return null; // No filter if search is empty

    const lowerSearch = searchName.toLowerCase();

    // Find all users whose name contains the search string
    return users
      .filter((u) => {
        const fullName = fullnameFromUser(u).toLowerCase();
        return fullName.includes(lowerSearch);
      })
      .map((u) => u.user_id);
  }, [searchName, users]);

  // -- Data --
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
    processed: filterProcessed,
    filterUserIds, // <--- 2. Pass the calculated IDs here
  });

  // -- Handlers --
  const reloadAll = useCallback(() => {
    reloadAllowances();
    mutate("/api/allowance?mode=users");
  }, [reloadAllowances]);

  const handleSave = async (
    rows: FormRow[],
    employeeId: number,
    dates: { start: string; end: string }
  ) => {
    const payloads = rows.map((r) => ({
      user_id: employeeId,
      amount: Number(r.amount).toFixed(2),
      description: r.type === "Others" ? r.other : r.type,
      cutoff_start: dates.start,
      cutoff_end: dates.end,
      is_processed: editing?.is_processed ?? 0,
    }));

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
      console.error(err);
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
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Delete failed: " + msg);
    }
  };

  // Reset Filters
  const handleReset = () => {
    setSearchName("");
    setSearchDescription("");
    setFilterProcessed("all");
    setPage(1); // Good practice to reset page on reset
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        {/* HEADER SECTION */}
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Allowance Management
            </h2>
            <p className="text-muted-foreground mt-1">
              Manage employee allowances, cutoffs, and processing status.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="bg-primary text-primary-foreground shadow hover:bg-primary/90"
              size="lg"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Allowance
            </Button>
          </div>
        </div>
        <Separator />

        {/* MAIN CONTENT CARD */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm mt-6">
          <div className="p-6 space-y-6">
            {/* TOOLBAR / FILTERS */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Left Side: Search Inputs */}
              <div className="flex flex-1 flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employee..."
                    value={searchName}
                    onChange={(e) => {
                      setSearchName(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 bg-background"
                  />
                </div>

                <div className="relative w-full sm:w-[280px]">
                  <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search description..."
                    value={searchDescription}
                    onChange={(e) => {
                      setSearchDescription(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 bg-background"
                  />
                </div>
              </div>

              {/* Right Side: Filters & Actions */}
              <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                <div className="w-full sm:w-[180px]">
                  <Select
                    value={filterProcessed}
                    onValueChange={(v) => {
                      setFilterProcessed(v as any);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Filter status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="processed">Processed</SelectItem>
                      <SelectItem value="unprocessed">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleReset}
                    title="Reset Filters"
                    className="h-10 w-10 shrink-0"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={reloadAll}
                    title="Refresh Data"
                    className="h-10 w-10 shrink-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* TABLE SECTION */}
            <div className="rounded-md border">
              <AllowanceTable
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
          </div>
        </div>

        {/* MODAL */}
        <AllowanceModal
          key={editing ? editing.allowance_id : "new"}
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
            setDialogOpen(open);
          }}
          editing={editing}
          users={users}
          usersLoading={usersLoading}
          onSave={handleSave}
        />
      </div>
    </DashboardLayout>
  );
}
