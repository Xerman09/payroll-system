"use client";

import React, { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  ALLOWANCE_TYPES,
  Allowance,
  FormRow,
  User,
  AllowanceType,
  AllowanceListParams,
} from "./types";
import { useUsers, useAllowancesQuery } from "./providers/allowanceApi";
import AllowanceTable from "./components/AllowanceTable";
import AllowanceDialog from "./components/AllowanceDialog";

function iso(date: Date) {
  return date.toISOString().split("T")[0];
}

function computeCutoffFromDate(dStr: string) {
  if (!dStr) return { start: "", end: "" };
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return { start: "", end: "" };
  const day = d.getDate(),
    y = d.getFullYear(),
    m = d.getMonth();
  let start: Date, end: Date;
  if (day >= 11 && day <= 25) {
    start = new Date(y, m, 11);
    end = new Date(y, m, 25);
  } else if (day >= 26) {
    start = new Date(y, m, 26);
    end = new Date(y, m + 1, 10);
  } else {
    start = new Date(y, m - 1, 26);
    end = new Date(y, m, 10);
  }
  return { start: iso(start), end: iso(end) };
}

export default function AllowanceModule() {
  const { users, loading: usersLoading } = useUsers();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [searchName, setSearchName] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [filterProcessed, setFilterProcessed] = useState<
    "all" | "processed" | "unprocessed"
  >("all");

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
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const effectivePage = Math.min(Math.max(page, 1), totalPages);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Allowance | null>(null);
  const [formEmployee, setFormEmployee] = useState<number | null>(null);
  const [formDate, setFormDate] = useState(() => iso(new Date()));
  const [formRows, setFormRows] = useState<FormRow[]>([
    { type: "Meals", other: "", amount: "" },
  ]);

  const cutoffPreview = useMemo(
    () => computeCutoffFromDate(formDate),
    [formDate]
  );

  const reloadAll = useCallback(() => {
    reloadAllowances();
  }, [reloadAllowances]);

  const handleCreateOrUpdate = async () => {
    if (!formEmployee) return toast.error("Select employee.");
    if (!formDate) return toast.error("Select a date for cutoff preview.");
    for (let i = 0; i < formRows.length; i++) {
      const r = formRows[i];
      if (!r.type) return toast.error(`Row ${i + 1}: choose description`);
      if (r.type === "Others" && !r.other?.trim())
        return toast.error(`Row ${i + 1}: specify 'Others' description`);
      if (!r.amount || isNaN(Number(r.amount)) || Number(r.amount) <= 0)
        return toast.error(`Row ${i + 1}: provide valid amount`);
    }
    const payloads = formRows.map((r) => ({
      user_id: formEmployee,
      amount: Number(r.amount).toFixed(2),
      description: r.type === "Others" ? r.other : r.type,
      cutoff_start: cutoffPreview.start,
      cutoff_end: cutoffPreview.end,
      is_processed: editing?.is_processed ?? 0,
    }));
    try {
      if (editing) {
        await fetch(`/api/allowance?id=${editing.allowance_id}`, {
          method: "PATCH",
          body: JSON.stringify(payloads[0]),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("Allowance updated successfully.");
      } else {
        for (const p of payloads)
          await fetch(`/api/allowance`, {
            method: "POST",
            body: JSON.stringify(p),
            headers: { "Content-Type": "application/json" },
          });
        toast.success("Allowance(s) created successfully.");
      }
      setDialogOpen(false);
      setEditing(null);
      setFormRows([{ type: "Meals", other: "", amount: "" }]);
      reloadAll();
    } catch (err) {
      console.error(err);
      toast.error(
        "Failed: " + (err instanceof Error ? err.message : String(err))
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this allowance? This cannot be undone.")) return;
    try {
      await fetch(`/api/allowance?id=${id}`, { method: "DELETE" });
      toast.success("Deleted successfully.");
      reloadAll();
    } catch (err) {
      console.error(err);
      toast.error(
        "Delete failed: " + (err instanceof Error ? err.message : String(err))
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Allowance Management</CardTitle>
            <Button
              onClick={() => {
                setEditing(null);
                setFormEmployee(null);
                setFormDate(iso(new Date()));
                setFormRows([{ type: "Meals", other: "", amount: "" }]);
                setDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Allowance
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-3 mb-4">
              <div>
                <Label>Search employee</Label>
                <Input
                  placeholder="Type name..."
                  value={searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <Label>Search description</Label>
                <Input
                  placeholder="e.g. Load, Motor, Others"
                  value={searchDescription}
                  onChange={(e) => {
                    setSearchDescription(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <Label>Processed</Label>
                <Select
                  defaultValue="all"
                  onValueChange={(v) => {
                    setFilterProcessed(
                      v as "all" | "processed" | "unprocessed"
                    );
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="unprocessed">Unprocessed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quick Actions</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchName("");
                      setSearchDescription("");
                      setFilterProcessed("all");
                    }}
                  >
                    Reset
                  </Button>
                  <Button onClick={reloadAll}>Refresh</Button>
                </div>
              </div>
            </div>

            <AllowanceTable
              allowances={allowances}
              users={users}
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              loading={allowancesLoading}
              onEdit={(a) => {
                const isPreset = ALLOWANCE_TYPES.includes(
                  a.description as AllowanceType
                );
                setFormEmployee(a.user_id);
                setFormDate(a.cutoff_start || iso(new Date()));
                setFormRows([
                  {
                    type: isPreset
                      ? (a.description as AllowanceType)
                      : "Others",
                    other: isPreset ? "" : a.description,
                    amount: String(a.amount ?? ""),
                  },
                ]);
                setEditing(a);
                setDialogOpen(true);
              }}
              onDelete={handleDelete}
            />

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm">
                Showing <b>{(effectivePage - 1) * PAGE_SIZE + 1}</b> -{" "}
                <b>{Math.min(effectivePage * PAGE_SIZE, total)}</b> of{" "}
                <b>{total}</b>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={effectivePage === 1}
                >
                  Prev
                </Button>
                <div>
                  Page {effectivePage} / {totalPages}
                </div>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={effectivePage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AllowanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        users={users}
        formEmployee={formEmployee}
        setFormEmployee={setFormEmployee}
        formDate={formDate}
        setFormDate={setFormDate}
        formRows={formRows}
        setFormRows={setFormRows}
        cutoffPreview={cutoffPreview}
        editing={editing}
        onSubmit={handleCreateOrUpdate}
        onCancel={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </DashboardLayout>
  );
}
