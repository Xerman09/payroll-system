"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getLoggedUser } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Edit,
  Trash2,
  RefreshCw,
  RotateCcw,
  ArrowUpDown,
  User as UserIcon,
} from "lucide-react";

import type {
  ModeKey,
  NewRecordForm,
  PayrollRecord,
  SortConfig,
  TabKey,
  User,
} from "./types";
import * as api from "./providers/additionsDeductionsApi";
import EmployeeNameInternal from "./components/EmployeeNameInternal";
import EditModal from "./components/EditModal";

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function formatCurrency(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return "₱0.00";
  return n.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
}

function computeCutoffForDate(dateIso: string) {
  if (!dateIso) return { start: "", end: "" };
  const d = new Date(dateIso);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  if (day <= 15) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month, 15);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  const start = new Date(year, month, 16);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function truthyFlag(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string")
    return v !== "" && v !== "0" && v.toLowerCase() !== "false";
  // Directus / MySQL can sometimes come as Buffer-like { data: [0|1] }
  if (
    typeof v === "object" &&
    v !== null &&
    "data" in (v as Record<string, unknown>)
  ) {
    const data = (v as { data?: unknown }).data;
    if (Array.isArray(data) && data.length > 0) return Number(data[0]) !== 0;
  }
  return Boolean(v);
}

function getCurrentUserId(): number | null {
  const user = getLoggedUser();
  if (!user || !user.user_id) return null;
  return Number(user.user_id);
}

function fullname(u?: User | null) {
  if (!u) return "Unknown";
  return `${u.user_fname} ${u.user_mname ? u.user_mname + " " : ""}${
    u.user_lname
  }`;
}

function filterUsers(query: string, list: User[]): User[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  return list
    .filter((u) => {
      const name = fullname(u).toLowerCase();
      return name.includes(q) || String(u.user_id).includes(q);
    })
    .slice(0, 20);
}

export default function AdditionsDeductionsModule() {
  const [activeTab, setActiveTab] = useState<TabKey>("additions");

  // Data state (no SWR hooks folder)
  const [users, setUsers] = useState<User[]>([]);
  const [additions, setAdditions] = useState<PayrollRecord[]>([]);
  const [deductions, setDeductions] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters / sort
  const [searchName, setSearchName] = useState<string>("");
  const [searchDesc, setSearchDesc] = useState<string>("");
  const [processedFilter, setProcessedFilter] = useState<
    "all" | "pending" | "processed"
  >("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const pageOptions = [5, 10, 15, 20];

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingMode, setEditingMode] = useState<ModeKey>("addition");
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(
    null
  );

  const [saving, setSaving] = useState<boolean>(false);

  const initialForm = useMemo<NewRecordForm>(() => {
    const datePicked = new Date().toISOString().slice(0, 10);
    const { start, end } = computeCutoffForDate(datePicked);
    return {
      user_id: null,
      searchText: "",
      showDropdown: false,
      datePicked,
      cutoff_start: start,
      cutoff_end: end,
      description: "",
      amountText: "",
    };
  }, []);

  const [form, setForm] = useState<NewRecordForm>(initialForm);

  async function loadAll() {
    setLoading(true);
    try {
      const [u, a, d] = await Promise.all([
        api.getUsers(),
        api.getAdditions(),
        api.getDeductions(),
      ]);
      setUsers(u);
      setAdditions(a);
      setDeductions(d);
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
     
  }, []);

  const userMap = useMemo(() => {
    const map = new Map<number, User>();
    for (const u of users) map.set(u.user_id, u);
    return map;
  }, [users]);

  const rawData = activeTab === "additions" ? additions : deductions;

  const processedData = useMemo(() => {
    let data = [...rawData];

    // Filter: Name
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      data = data.filter((item) => {
        const u = userMap.get(Number(item.user_id));
        const name = u ? fullname(u).toLowerCase() : "";
        return name.includes(q) || String(item.user_id).includes(q);
      });
    }

    // Filter: Description
    if (searchDesc.trim()) {
      const q = searchDesc.trim().toLowerCase();
      data = data.filter((item) =>
        (item.description ?? "").toLowerCase().includes(q)
      );
    }

    // Filter: Processed
    if (processedFilter !== "all") {
      data = data.filter((item) => {
        const processed = truthyFlag(item.is_processed);
        return processedFilter === "processed" ? processed : !processed;
      });
    }

    // Sort
    if (sortConfig) {
      data.sort((a, b) => {
        let valA: unknown = (a as Record<string, unknown>)[
          sortConfig.key as string
        ];
        let valB: unknown = (b as Record<string, unknown>)[
          sortConfig.key as string
        ];

        if (sortConfig.key === "user_name") {
          const uA = userMap.get(Number(a.user_id));
          const uB = userMap.get(Number(b.user_id));
          valA = uA ? fullname(uA) : "";
          valB = uB ? fullname(uB) : "";
        }

        if (sortConfig.key === "amount") {
          const nA = parseFloat(String(valA ?? "0"));
          const nB = parseFloat(String(valB ?? "0"));
          valA = Number.isNaN(nA) ? 0 : nA;
          valB = Number.isNaN(nB) ? 0 : nB;
        }

        const aStr = typeof valA === "string" ? valA : String(valA ?? "");
        const bStr = typeof valB === "string" ? valB : String(valB ?? "");

        const cmp =
          typeof valA === "number" && typeof valB === "number"
            ? valA - valB
            : aStr.localeCompare(bStr);

        return sortConfig.direction === "asc"
          ? cmp < 0
            ? -1
            : cmp > 0
            ? 1
            : 0
          : cmp < 0
          ? 1
          : cmp > 0
          ? -1
          : 0;
      });
    }

    return data;
  }, [rawData, searchName, searchDesc, processedFilter, sortConfig, userMap]);

  const total = processedData.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const pagedData = useMemo(() => {
    const safePage = page > pageCount ? 1 : page;
    const start = (safePage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, page, pageSize, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [searchName, searchDesc, processedFilter, activeTab]);

  function handleSort(key: keyof PayrollRecord | "user_name") {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }

  function handleReset() {
    setSearchName("");
    setSearchDesc("");
    setProcessedFilter("all");
    setSortConfig(null);
    setPage(1);
  }

  async function handleRefresh() {
    await loadAll();
    toast.success("Refreshed data");
  }

  function openAdd(mode: ModeKey) {
    setEditingMode(mode);
    setShowAddModal(true);
    setForm(initialForm);
  }

  function openEdit(record: PayrollRecord, mode: ModeKey) {
    setEditingMode(mode);
    setEditingRecord(record);
    setShowEditModal(true);
  }

  async function handleDelete(id: number, mode: ModeKey) {
    if (!confirm("Are you sure?")) return;
    const resourceKey = mode === "addition" ? "additions" : "deductions";
    try {
      await api.deleteRecord(resourceKey, id);
      toast.success("Deleted");
      await loadAll();
    } catch (err) {
      toast.error(messageOf(err));
    }
  }

  async function handleSaveEdit(updated: PayrollRecord) {
    if (!updated?.id) return;
    const resourceKey = editingMode === "addition" ? "additions" : "deductions";

    try {
      await api.updateRecord(resourceKey, updated.id, {
        amount: updated.amount,
        description: updated.description,
        cutoff_start: updated.cutoff_start,
        cutoff_end: updated.cutoff_end,
      });
      toast.success("Updated");
      setShowEditModal(false);
      await loadAll();
    } catch (err) {
      toast.error(messageOf(err));
    }
  }

  async function handleCreate() {
    setSaving(true);
    const resourceKey = editingMode === "addition" ? "additions" : "deductions";
    const currentUserId = getCurrentUserId();

    try {
      if (!form.user_id) throw new Error("Employee is required");
      const amt = parseFloat((form.amountText || "").replace(/[^\d.]/g, ""));
      if (!amt || amt <= 0) throw new Error("Amount must be greater than 0");

      await api.createRecord(resourceKey, {
        user_id: form.user_id,
        amount: Number(amt).toFixed(2),
        description: form.description ?? "",
        cutoff_start: form.cutoff_start,
        cutoff_end: form.cutoff_end,
        created_by: currentUserId,
      });

      toast.success(
        `Created ${editingMode === "addition" ? "addition" : "deduction"}`
      );
      setShowAddModal(false);
      await loadAll();
      setForm(initialForm);
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Additions &amp; Deductions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage employee additions and deductions for payroll processing.
            </p>
          </div>

          <Button
            onClick={() =>
              openAdd(activeTab === "additions" ? "addition" : "deduction")
            }
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            + Add {activeTab === "additions" ? "Addition" : "Deduction"}
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-4">
        <Separator />

        <Card className="max-w-6xl mx-auto">
          <CardContent className="pt-6">
            {/* Filters: keep width consistent with other modules */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-6">
              <div className="xl:col-span-4 space-y-2">
                <Label>Search employee</Label>
                <Input
                  placeholder="Type name..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>

              <div className="xl:col-span-4 space-y-2">
                <Label>Search description</Label>
                <Input
                  placeholder="e.g. Load, Motor, Others"
                  value={searchDesc}
                  onChange={(e) => setSearchDesc(e.target.value)}
                />
              </div>

              <div className="xl:col-span-2 space-y-2">
                <Label>Processed</Label>
                <Select
                  value={processedFilter}
                  onValueChange={(v) =>
                    setProcessedFilter(v as "all" | "pending" | "processed")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="xl:col-span-2 space-y-2">
                <Label>Quick Actions</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    title="Reset Filters"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Reset
                  </Button>
                  <Button
                    variant="default"
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleRefresh}
                    title="Refresh Data"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs - keep width constrained */}
            <div className="w-full max-w-full overflow-hidden">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("additions")}
                  className={
                    activeTab === "additions"
                      ? "rounded-md bg-white py-2 text-sm font-medium shadow"
                      : "rounded-md py-2 text-sm font-medium text-slate-600 hover:bg-white/60"
                  }
                >
                  Additions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("deductions")}
                  className={
                    activeTab === "deductions"
                      ? "rounded-md bg-white py-2 text-sm font-medium shadow"
                      : "rounded-md py-2 text-sm font-medium text-slate-600 hover:bg-white/60"
                  }
                >
                  Deductions
                </button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[60px]">No.</TableHead>

                    <TableHead
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("user_name")}
                    >
                      <div className="flex items-center gap-1">
                        Name <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>

                    <TableHead
                      className="cursor-pointer hover:bg-gray-100 select-none w-40"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-1">
                        Amount <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>

                    <TableHead>Description</TableHead>
                    <TableHead className="w-[180px]">Cut Off</TableHead>
                    <TableHead className="w-[120px]">Processed</TableHead>
                    <TableHead className="text-center w-[120px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-24">
                        Loading data...
                      </TableCell>
                    </TableRow>
                  ) : pagedData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center h-24 text-gray-500"
                      >
                        No records found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedData.map((r, idx) => {
                      const processed = truthyFlag(r.is_processed);
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            {(page - 1) * pageSize + idx + 1}
                          </TableCell>

                          <TableCell className="font-medium">
                            <EmployeeNameInternal
                              userId={r.user_id}
                              userMap={userMap}
                            />
                          </TableCell>

                          <TableCell>{formatCurrency(r.amount)}</TableCell>

                          <TableCell className="truncate max-w-[260px]">
                            {r.description}
                          </TableCell>

                          <TableCell>
                            <div className="text-xs">
                              {r.cutoff_start} <br /> to {r.cutoff_end}
                            </div>
                          </TableCell>

                          <TableCell>
                            <span
                              className={
                                processed
                                  ? "bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium"
                                  : "bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium"
                              }
                            >
                              {processed ? "Processed" : "Pending"}
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() =>
                                  openEdit(
                                    r,
                                    activeTab === "additions"
                                      ? "addition"
                                      : "deduction"
                                  )
                                }
                                className="text-primary hover:text-primary/80 transition-colors"
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() =>
                                  handleDelete(
                                    r.id,
                                    activeTab === "additions"
                                      ? "addition"
                                      : "deduction"
                                  )
                                }
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-4">
              <div className="text-sm text-gray-500">
                {total === 0
                  ? "Showing 0 entries"
                  : `Showing ${(page - 1) * pageSize + 1} - ${Math.min(
                      page * pageSize,
                      total
                    )} of ${total}`}
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="border rounded p-1 text-sm"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {pageOptions.map((o) => (
                    <option key={o} value={o}>
                      {o} / page
                    </option>
                  ))}
                </select>

                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>

            {/* Add Dialog */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden bg-white gap-0">
                <DialogHeader className="px-6 py-5 border-b">
                  <DialogTitle className="text-lg font-semibold">
                    Add {editingMode === "addition" ? "Addition" : "Deduction"}
                  </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Employee</Label>
                    <div className="relative">
                      <Input
                        value={form.searchText}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            searchText: e.target.value,
                            showDropdown: true,
                          }))
                        }
                        onFocus={() =>
                          setForm((s) => ({ ...s, showDropdown: true }))
                        }
                        placeholder="Search by name or ID..."
                        className="w-full bg-primary/5/30 border-primary/20 focus-visible:ring-blue-500"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        <UserIcon size={14} />
                      </div>

                      {form.showDropdown &&
                        filterUsers(form.searchText, users).length > 0 && (
                          <div className="absolute bg-white border rounded-md shadow-lg z-20 w-full max-h-48 overflow-auto mt-1">
                            {filterUsers(form.searchText, users).map((u) => (
                              <div
                                key={u.user_id}
                                className="px-3 py-2 hover:bg-primary/5 cursor-pointer text-sm"
                                onClick={() =>
                                  setForm((s) => ({
                                    ...s,
                                    user_id: u.user_id,
                                    searchText: fullname(u),
                                    showDropdown: false,
                                  }))
                                }
                              >
                                <div className="font-medium">{fullname(u)}</div>
                                <div className="text-xs text-muted-foreground">
                                  ID: {u.user_id}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Choose Date</Label>
                    <Input
                      type="date"
                      value={form.datePicked}
                      onChange={(e) => {
                        const iso = e.target.value;
                        const { start, end } = computeCutoffForDate(iso);
                        setForm((s) => ({
                          ...s,
                          datePicked: iso,
                          cutoff_start: start,
                          cutoff_end: end,
                        }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Cutoff: {form.cutoff_start} → {form.cutoff_end}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, description: e.target.value }))
                      }
                      placeholder="e.g. Allowance, Income Tax, Loan"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        ₱
                      </span>
                      <Input
                        value={form.amountText}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, amountText: e.target.value }))
                        }
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-gray-50 flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <EditModal
              isOpen={showEditModal}
              onClose={() => setShowEditModal(false)}
              record={editingRecord}
              onSave={handleSaveEdit}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}