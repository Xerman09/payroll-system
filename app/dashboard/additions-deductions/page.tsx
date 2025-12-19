"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Edit,
  Trash2,
  RotateCcw,
  RefreshCw,
  ArrowUpDown,
  Calendar as CalendarIcon,
  User as UserIcon,
} from "lucide-react";

// --- TYPES ---
type User = {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  user_position?: string;
  user_image?: string | null;
};

type PayrollRecord = {
  id: number;
  user_id: number;
  amount: string | number;
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  created_by?: number | null;
  created_date?: string | null;
};

// --- CONSTANTS ---
const INTERNAL_API = "/api/additions-deductions";

/* ===========================
   UTILITIES
   =========================== */
function formatCurrency(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return "₱0.00";
  return n.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
}

function fullname(u?: User | null) {
  if (!u) return "Unknown";
  return `${u.user_fname} ${u.user_mname ? u.user_mname + " " : ""}${
    u.user_lname
  }`;
}

// Fetcher
const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) {
      const text = await r.text();
      try {
        const jsonErr = JSON.parse(text);
        throw new Error(jsonErr.error || r.statusText);
      } catch {
        throw new Error(text || r.statusText);
      }
    }
    return r.json();
  });

// API Calls
async function getUsers(): Promise<User[]> {
  const json = await fetcher(`${INTERNAL_API}?resource=users`);
  return json?.data ?? json ?? [];
}

async function getAdditions(): Promise<PayrollRecord[]> {
  const json = await fetcher(`${INTERNAL_API}?resource=additions`);
  return json?.data ?? json ?? [];
}

async function getDeductions(): Promise<PayrollRecord[]> {
  const json = await fetcher(`${INTERNAL_API}?resource=deductions`);
  return json?.data ?? json ?? [];
}

// Hooks
function useUsers() {
  const { data, error } = useSWR(`${INTERNAL_API}?resource=users`, getUsers, {
    revalidateOnFocus: false,
  });
  return { users: data ?? [], loading: !data && !error, error };
}

function useAdditions() {
  const { data, error, isLoading } = useSWR(
    `${INTERNAL_API}?resource=additions`,
    getAdditions,
    { revalidateOnFocus: false }
  );
  return { additions: data ?? [], loading: isLoading, error };
}

function useDeductions() {
  const { data, error, isLoading } = useSWR(
    `${INTERNAL_API}?resource=deductions`,
    getDeductions,
    { revalidateOnFocus: false }
  );
  return { deductions: data ?? [], loading: isLoading, error };
}

/** Cutoff auto compute rule */
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
  } else {
    const start = new Date(year, month, 16);
    const end = new Date(year, month + 1, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }
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

export default function AdditionsDeductionsPage() {
  const [activeTab, setActiveTab] = useState<"additions" | "deductions">(
    "additions"
  );

  // Data
  const { additions, loading: loadingAdd } = useAdditions();
  const { deductions, loading: loadingDed } = useDeductions();
  const { users } = useUsers();

  // Search & Filter State
  const [searchName, setSearchName] = useState("");
  const [searchDesc, setSearchDesc] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof PayrollRecord | "user_name";
    direction: "asc" | "desc";
  } | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const pageOptions = [5, 10, 15, 20];

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{
    record: PayrollRecord | null;
    mode: "addition" | "deduction" | null;
  }>({ record: null, mode: null });

  const [loading, setLoading] = useState(false);

  // Modal Form State
  type NewRow = {
    user?: User | null;
    user_id?: number | null;
    searchText: string;
    showDropdown?: boolean;
    datePicked: string;
    cutoff_start?: string;
    cutoff_end?: string;
    description?: string;
    amountText?: string;
  };

  const [newRows, setNewRows] = useState<NewRow[]>(() => {
    const datePicked = new Date().toISOString().slice(0, 10);
    const { start, end } = computeCutoffForDate(datePicked);
    return [
      {
        user: null,
        user_id: null,
        searchText: "",
        showDropdown: false,
        datePicked,
        cutoff_start: start,
        cutoff_end: end,
        description: "",
        amountText: "",
      },
    ];
  });
  const [newMode, setNewMode] = useState<"addition" | "deduction">("addition");

  // --- FILTERING & SORTING LOGIC ---

  // 1. Create a map of users for fast lookup by ID
  const userMap = useMemo(() => {
    const map = new Map<number, User>();
    users.forEach((u) => map.set(u.user_id, u));
    return map;
  }, [users]);

  // 2. Filter and Sort the data
  const processedData = useMemo(() => {
    let data = activeTab === "additions" ? [...additions] : [...deductions];

    // Filter by Name
    if (searchName) {
      const lowerQ = searchName.toLowerCase();
      data = data.filter((item) => {
        const u = userMap.get(Number(item.user_id));
        const name = u ? fullname(u).toLowerCase() : "";
        return name.includes(lowerQ);
      });
    }

    // Filter by Description
    if (searchDesc) {
      const lowerQ = searchDesc.toLowerCase();
      data = data.filter((item) =>
        item.description?.toLowerCase().includes(lowerQ)
      );
    }

    // Sort
    if (sortConfig) {
      data.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof PayrollRecord];
        let valB: any = b[sortConfig.key as keyof PayrollRecord];

        // Special handling for Name sort (which isn't directly on the record)
        if (sortConfig.key === "user_name") {
          const uA = userMap.get(Number(a.user_id));
          const uB = userMap.get(Number(b.user_id));
          valA = uA ? fullname(uA) : "";
          valB = uB ? fullname(uB) : "";
        }

        // Numeric handling
        if (sortConfig.key === "amount") {
          valA = parseFloat(String(valA));
          valB = parseFloat(String(valB));
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [
    activeTab,
    additions,
    deductions,
    searchName,
    searchDesc,
    userMap,
    sortConfig,
  ]);

  // 3. Pagination based on processed data
  const total = processedData.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const pagedData = useMemo(() => {
    // Safety check if page is out of bounds after filter
    const safePage = page > pageCount ? 1 : page;
    const start = (safePage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, page, pageSize, pageCount]);

  // Reset pagination when search changes
  useEffect(() => {
    setPage(1);
  }, [searchName, searchDesc, activeTab]);

  // Handlers
  const handleSort = (key: keyof PayrollRecord | "user_name") => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const handleReset = () => {
    setSearchName("");
    setSearchDesc("");
    setSortConfig(null);
  };

  const handleRefresh = () => {
    mutate(`${INTERNAL_API}?resource=additions`);
    mutate(`${INTERNAL_API}?resource=deductions`);
    toast.success("Refreshed data");
  };

  function getCurrentUserId() {
    try {
      const u = JSON.parse(sessionStorage.getItem("user") || "{}");
      return u?.user_id ?? null;
    } catch {
      return null;
    }
  }

  function addNewRow() {
    const datePicked = new Date().toISOString().slice(0, 10);
    const { start, end } = computeCutoffForDate(datePicked);
    setNewRows((s) => [
      ...s,
      {
        user: null,
        user_id: null,
        searchText: "",
        showDropdown: false,
        datePicked,
        cutoff_start: start,
        cutoff_end: end,
        description: "",
        amountText: "",
      },
    ]);
  }

  function removeNewRow(idx: number) {
    if (newRows.length <= 1) {
      // Optional: clear instead of remove if it's the only one
      updateNewRow(idx, {
        user: null,
        user_id: null,
        searchText: "",
        description: "",
        amountText: "",
      });
      return;
    }
    setNewRows((s) => s.filter((_, i) => i !== idx));
  }

  function updateNewRow(idx: number, patch: Partial<NewRow>) {
    setNewRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function handleDateChange(idx: number, iso: string) {
    const { start, end } = computeCutoffForDate(iso);
    updateNewRow(idx, {
      datePicked: iso,
      cutoff_start: start,
      cutoff_end: end,
    });
  }

  // Submit Logic
  async function handleSubmitNewRows() {
    setLoading(true);
    const mode = newMode;
    const resourceKey = mode === "addition" ? "additions" : "deductions";
    const currentUserId = getCurrentUserId();

    try {
      for (let i = 0; i < newRows.length; i++) {
        const r = newRows[i];
        if (!r.user_id) throw new Error(`Row ${i + 1}: employee is required`);
        const amt = parseFloat((r.amountText || "").replace(/[^\d.]/g, ""));
        if (!amt || amt <= 0)
          throw new Error(`Row ${i + 1}: amount must be greater than 0`);
      }

      const results = [];
      for (const r of newRows) {
        const amt = parseFloat((r.amountText || "").replace(/[^\d.]/g, ""));
        const payloadData = {
          user_id: r.user_id,
          amount: Number(amt).toFixed(2),
          description: r.description ?? "",
          cutoff_start: r.cutoff_start,
          cutoff_end: r.cutoff_end,
          created_by: currentUserId,
        };

        const res = await fetch(INTERNAL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource: resourceKey, data: payloadData }),
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(
            `Failed to create ${mode}: ${json.error || "Unknown error"}`
          );
        }
        results.push(await res.json());
      }

      toast.success(`Created ${results.length} ${mode}(s)`);
      setShowAddModal(false);
      handleRefresh();

      // Reset form
      const date = new Date().toISOString().slice(0, 10);
      const { start, end } = computeCutoffForDate(date);
      setNewRows([
        {
          user: null,
          user_id: null,
          searchText: "",
          showDropdown: false,
          datePicked: date,
          cutoff_start: start,
          cutoff_end: end,
          description: "",
          amountText: "",
        },
      ]);
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, mode: "addition" | "deduction") {
    if (!confirm("Are you sure?")) return;
    const resourceKey = mode === "addition" ? "additions" : "deductions";
    try {
      const res = await fetch(
        `${INTERNAL_API}?resource=${resourceKey}&id=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted");
      handleRefresh();
    } catch {
      toast.error("Delete failed");
    }
  }

  function openEdit(record: PayrollRecord, mode: "addition" | "deduction") {
    setEditingRecord({ record, mode });
    setShowEditModal(true);
  }

  async function handleSaveEdit(updated: PayrollRecord) {
    if (!updated?.id) return;
    const resourceKey =
      editingRecord.mode === "addition" ? "additions" : "deductions";
    try {
      const res = await fetch(INTERNAL_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: resourceKey,
          id: updated.id,
          data: {
            amount: updated.amount,
            description: updated.description,
            cutoff_start: updated.cutoff_start,
            cutoff_end: updated.cutoff_end,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Updated");
      setShowEditModal(false);
      handleRefresh();
    } catch (e) {
      toast.error("Update failed");
    }
  }

  // --- RENDER ---
  return (
    <DashboardLayout>
      <div className="flex justify-between items-center p-6 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Additions & Deductions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage employee additions and deductions for payroll processing.
          </p>
        </div>
        <Button
          onClick={() => {
            setNewMode(activeTab === "additions" ? "addition" : "deduction");
            setShowAddModal(true);
          }}
          className="bg-blue-700 hover:bg-blue-800 text-white"
        >
          + Add {activeTab === "additions" ? "Addition" : "Deduction"}
        </Button>
      </div>
      <div className="space-y-6 p-4">
        <Separator />

        <Card>
          <CardContent>
            {/* SEARCH & FILTERS ROW */}
            <div className="flex flex-col xl:flex-row gap-4 mb-6 pb-2 pt-6">
              <div className="flex-1 space-y-2">
                <Label>Search employee</Label>
                <Input
                  placeholder="Type name..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Search description</Label>
                <Input
                  placeholder="e.g. Load, Motor, Others"
                  value={searchDesc}
                  onChange={(e) => setSearchDesc(e.target.value)}
                />
              </div>
              <div className="w-full xl:w-48 space-y-2">
                <Label>Processed</Label>
                <Select disabled>
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
              <div className="space-y-2">
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
                    className="bg-blue-700 hover:bg-blue-800"
                    onClick={handleRefresh}
                    title="Refresh Data"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                  </Button>
                </div>
              </div>
            </div>
            <Tabs
              defaultValue="additions"
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as any);
                setPage(1);
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="additions">Additions</TabsTrigger>
                <TabsTrigger value="deductions">Deductions</TabsTrigger>
              </TabsList>

              {/* SHARED TABLE CONTENT */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[50px]">No.</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("user_name")}
                      >
                        <div className="flex items-center gap-1">
                          Name <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("amount")}
                      >
                        <div className="flex items-center gap-1">
                          Amount <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Cut Off</TableHead>
                      <TableHead>Processed</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAdd || loadingDed ? (
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
                      pagedData.map((r, idx) => (
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
                          <TableCell>{r.description}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {r.cutoff_start} <br /> to {r.cutoff_end}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">
                              Pending
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
                                className="text-blue-500 hover:text-blue-700 transition-colors"
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
                                className="text-red-500 hover:text-red-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">
                  Showing {(page - 1) * pageSize + 1} -{" "}
                  {Math.min(page * pageSize, total)} of {total}
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
            </Tabs>
          </CardContent>
        </Card>

        {/* --- ADD MODAL REFACTORED TO MATCH IMAGES --- */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white gap-0">
            <DialogHeader className="px-6 py-5 border-b">
              <DialogTitle className="text-lg font-semibold">
                Add {newMode === "addition" ? "Addition(s)" : "Deduction(s)"}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-y-auto px-6 py-6 space-y-8">
              {newRows.map((r, idx) => (
                <div
                  key={idx}
                  className={idx > 0 ? "pt-6 border-t border-dashed" : ""}
                >
                  <div className="space-y-5">
                    {/* Employee Field */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Employee</Label>
                      <div className="relative">
                        <Input
                          value={r.searchText}
                          onChange={(e) =>
                            updateNewRow(idx, {
                              searchText: e.target.value,
                              showDropdown: true,
                            })
                          }
                          onFocus={() =>
                            updateNewRow(idx, { showDropdown: true })
                          }
                          placeholder="Search by name or ID..."
                          className="w-full bg-blue-50/30 border-blue-200 focus-visible:ring-blue-500"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                          <UserIcon size={14} />
                        </div>

                        {/* Autocomplete Dropdown */}
                        {r.showDropdown &&
                          filterUsers(r.searchText, users).length > 0 && (
                            <div className="absolute bg-white border rounded-md shadow-lg z-20 w-full max-h-48 overflow-auto mt-1">
                              {filterUsers(r.searchText, users).map((u) => (
                                <div
                                  key={u.user_id}
                                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                  onClick={() =>
                                    updateNewRow(idx, {
                                      user_id: u.user_id,
                                      searchText: fullname(u),
                                      showDropdown: false,
                                    })
                                  }
                                >
                                  <div className="font-medium">
                                    {fullname(u)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    ID: {u.user_id}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Date Field */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Choose Date</Label>
                      <div className="relative">
                        <Input
                          type="date"
                          value={r.datePicked}
                          onChange={(e) =>
                            handleDateChange(idx, e.target.value)
                          }
                          className="w-full"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cutoff: {r.cutoff_start} → {r.cutoff_end}
                      </p>
                    </div>

                    {/* Description Field */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Description</Label>
                      <Input
                        value={r.description}
                        onChange={(e) =>
                          updateNewRow(idx, { description: e.target.value })
                        }
                        placeholder="e.g. Allowance, Income Tax, Loan"
                        className="w-full"
                      />
                    </div>

                    {/* Amount Field */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                          ₱
                        </span>
                        <Input
                          value={r.amountText}
                          onChange={(e) =>
                            updateNewRow(idx, { amountText: e.target.value })
                          }
                          placeholder="0.00"
                          className="pl-7 w-full"
                        />
                      </div>
                    </div>

                    {/* Row Actions */}
                    <div className="flex justify-between items-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeNewRow(idx)}
                        className="text-gray-500 hover:text-red-600 hover:bg-red-50 border-gray-200"
                      >
                        Remove
                      </Button>

                      {/* Show 'Add Another' only on the last item */}
                      {idx === newRows.length - 1 && (
                        <Button
                          size="sm"
                          onClick={addNewRow}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          + Add another
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="px-6 py-4 border-t bg-gray-50 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="bg-white hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitNewRows}
                className="bg-blue-700 hover:bg-blue-800 text-white px-6"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- EDIT MODAL --- */}
        <EditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          record={editingRecord.record}
          onSave={handleSaveEdit}
        />
      </div>
    </DashboardLayout>
  );
}

// Optimized Employee Name for Table
function EmployeeNameInternal({
  userId,
  userMap,
}: {
  userId: number;
  userMap: Map<number, User>;
}) {
  const u = userMap.get(Number(userId));
  if (!u) return <span className="text-gray-400">Unknown (ID: {userId})</span>;
  return <span>{fullname(u)}</span>;
}

// Edit Modal
function EditModal({ isOpen, onClose, record, onSave }: any) {
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    if (record) {
      setDesc(record.description || "");
      setAmt(record.amount);
      setStart(record.cutoff_start);
      setEnd(record.cutoff_end);
    }
  }, [record]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                ₱
              </span>
              <Input
                className="pl-7"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...record,
                description: desc,
                amount: amt,
                cutoff_start: start,
                cutoff_end: end,
              })
            }
            className="bg-blue-700 hover:bg-blue-800"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
