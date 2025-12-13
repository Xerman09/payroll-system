"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Edit2, Trash2 } from "lucide-react";

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
  created_date?: string | null; // datetime
};

const API_BASE = "http://100.126.246.124:8060";

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

/* ===========================
   Simple fetcher and API service
   =========================== */
const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) {
      const text = await r.text();
      throw new Error(text || r.statusText);
    }
    return r.json();
  });

async function getUsers(): Promise<User[]> {
  const json = await fetcher(`${API_BASE}/items/user?limit=-1`);
  return json?.data ?? json ?? [];
}

async function getAdditions(): Promise<PayrollRecord[]> {
  const json = await fetcher(
    `${API_BASE}/items/payroll_other_additions?limit=-1`
  );
  return json?.data ?? json ?? [];
}

async function getDeductions(): Promise<PayrollRecord[]> {
  const json = await fetcher(
    `${API_BASE}/items/payroll_other_deductions?limit=-1`
  );
  return json?.data ?? json ?? [];
}







/* ===========================
   Hook-like helpers (wrapped in file)
   =========================== */
function useUsers() {
  const { data, error } = useSWR("/users", getUsers, {
    revalidateOnFocus: false,
  });
  return { users: data ?? [], loading: !data && !error, error };
}

function useAdditions() {
  const { data, error } = useSWR("/additions", getAdditions, {
    revalidateOnFocus: false,
  });
  return { additions: data ?? [], loading: !data && !error, error };
}

function useDeductions() {
  const { data, error } = useSWR("/deductions", getDeductions, {
    revalidateOnFocus: false,
  });
  return { deductions: data ?? [], loading: !data && !error, error };
}

/** Cutoff auto compute rule (Option A: semi-monthly)
  - if selected day <= 15 => cutoff_start = 1st of month; cutoff_end = 15th
  - else => cutoff_start = 16th; cutoff_end = last day of month
*/
function computeCutoffForDate(dateIso: string) {
  const d = new Date(dateIso);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-index
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
    const end = new Date(year, month + 1, 0); // last day of month
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
      const name = `${u.user_fname} ${u.user_mname ?? ""} ${u.user_lname}`
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      return name.includes(q) || String(u.user_id).includes(q);
    })
    .slice(0, 20);
}

export default function AdditionsDeductionsPage() {
  const [activeTab, setActiveTab] = useState<"additions" | "deductions">(
    "additions"
  );

  // data lists from SWR
  const { additions } = useAdditions();
  const { deductions } = useDeductions();
  const { users } = useUsers();

  // pagination & page size
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(5); // default 5
  const pageOptions = [5, 10, 15, 20];

  // modal controls
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{
    record: PayrollRecord | null;
    mode: "addition" | "deduction" | null;
  }>({ record: null, mode: null });

  // modal form for adding multiple entries
  type NewRow = {
    user?: User | null;
    user_id?: number | null;
    searchText: string; // free-typed input for search (name or ID)
    showDropdown?: boolean; // controls visibility of the suggestions
    datePicked: string; // chosen date string (ISO)
    cutoff_start?: string;
    cutoff_end?: string;
    description?: string;
    amountText?: string; // free-typed amount with optional symbols
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

  // employee search handled per-row using searchText and local filtering

  // loading / alerts
  const [loading, setLoading] = useState(false);
  
  // SWR handles fetching automatically

  // fetch user by id (for created_by)
  async function fetchUserById(id?: number | null) {
    if (!id) return null;
    try {
      const res = await fetch(`${API_BASE}/items/user/${id}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ?? json;
    } catch (e) {
      console.error("fetchUserById", e);
      return null;
    }
  }

  // preload created_by user names for current lists
  // we'll maintain a small cache
  const [userCache, setUserCache] = useState<Record<number, User>>({});
  useEffect(() => {
    const ids = new Set<number>();
    [...additions, ...deductions].forEach((r) => {
      if (r.created_by) ids.add(Number(r.created_by));
    });
    if (!ids.size) return;
    (async () => {
      const entries = Array.from(ids).filter((i) => !userCache[i]);
      if (!entries.length) return;
      const fetched: Record<number, User> = { ...userCache };
      await Promise.all(
        entries.map(async (id) => {
          const u = await fetchUserById(id);
          if (u) fetched[id] = u;
        })
      );
      setUserCache(fetched);
    })();
  }, [additions, deductions, userCache]);

  // employee search moved to local filter using loaded users list

  // helper: get current user id from sessionStorage
  function getCurrentUserId(): number | null {
    try {
      const raw = sessionStorage.getItem("user");
      if (!raw) return null;
      const u = JSON.parse(raw);
      return u?.user_id ?? null;
    } catch {
      return null;
    }
  }

  // Add modal helpers
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
    setNewRows((s) => s.filter((_, i) => i !== idx));
  }
  function updateNewRow(idx: number, patch: Partial<NewRow>) {
    setNewRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  // set cutoff when date changes
  function handleDateChange(idx: number, iso: string) {
    const { start, end } = computeCutoffForDate(iso);
    updateNewRow(idx, {
      datePicked: iso,
      cutoff_start: start,
      cutoff_end: end,
    });
  }

  // submit bulk (will POST each row)
  async function handleSubmitNewRows() {
    setLoading(true);
    const mode = newMode; // addition or deduction
    const endpoint =
      mode === "addition"
        ? `${API_BASE}/items/payroll_other_additions`
        : `${API_BASE}/items/payroll_other_deductions`;
    const currentUserId = getCurrentUserId();
    try {
      // validation
      for (let i = 0; i < newRows.length; i++) {
        const r = newRows[i];
        if (!r.user_id) throw new Error(`Row ${i + 1}: employee is required`);
        const amt = parseFloat((r.amountText || "").replace(/[^\d.]/g, ""));
        if (!amt || amt <= 0)
          throw new Error(`Row ${i + 1}: amount must be greater than 0`);
        if (!r.cutoff_start || !r.cutoff_end)
          throw new Error(`Row ${i + 1}: choose a date to compute cutoff`);
      }

      // do multiple POSTs
      const results = [];
      for (const r of newRows) {
        const amt = parseFloat((r.amountText || "").replace(/[^\d.]/g, ""));
        const payload = {
          user_id: r.user_id,
          amount: Number(amt).toFixed(2),
          description: r.description ?? "",
          cutoff_start: r.cutoff_start,
          cutoff_end: r.cutoff_end,
          created_by: currentUserId,
        };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Failed to create ${mode} for user ${r.user_id}: ${text}`
          );
        }
        const j = await res.json();
        results.push(j);
      }

      toast.success(`Created ${results.length} ${mode}(s)`);
      setShowAddModal(false);
      // refresh lists
      mutate("/additions");
      mutate("/deductions");
      // reset modal rows
      setNewRows(() => {
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
    } catch (e) {
      console.error("submit new rows", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // edit flow
  function openEdit(record: PayrollRecord, mode: "addition" | "deduction") {
    setEditingRecord({ record, mode });
    setShowEditModal(true);
  }

  async function handleSaveEdit(updated: PayrollRecord) {
    if (!updated?.id) return;
    const endpoint =
      editingRecord.mode === "addition"
        ? `${API_BASE}/items/payroll_other_additions/${updated.id}`
        : `${API_BASE}/items/payroll_other_deductions/${updated.id}`;
    const payload = {
      description: updated.description ?? "",
      amount: updated.amount,
      cutoff_start: updated.cutoff_start,
      cutoff_end: updated.cutoff_end,
    };
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update");
      }
      toast.success("Updated successfully.");
      setShowEditModal(false);
      setEditingRecord({ record: null, mode: null });
      mutate("/additions");
      mutate("/deductions");
    } catch (e) {
      console.error("save edit", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    }
  }

  // delete
  async function handleDelete(id: number, mode: "addition" | "deduction") {
    if (!confirm("Are you sure you want to delete this record?")) return;
    const endpoint =
      mode === "addition"
        ? `${API_BASE}/items/payroll_other_additions/${id}`
        : `${API_BASE}/items/payroll_other_deductions/${id}`;
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Deleted successfully.");
      mutate("/additions");
      mutate("/deductions");
    } catch (e) {
      console.error("delete", e);
      toast.error("Delete failed.");
    }
  }

  // table data slicing
  const currentList = activeTab === "additions" ? additions : deductions;
  const total = currentList.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return currentList.slice(start, start + pageSize);
  }, [currentList, page, pageSize]);

  // quick helper to map created_by to name
  function createdByDisplay(r: PayrollRecord) {
    const id = Number(r.created_by);
    const u = id ? userCache[id] : null;
    return u ? fullname(u) : r.created_by ? `User #${r.created_by}` : "—";
  }

  /* ----------------- RENDER ----------------- */
  return (
    <DashboardLayout>
      <div className="space-y-4 p-4">
        <Card>
          <h2 className="text-xl font-semibold ps-7">Additions & Deductions</h2>

          <CardContent>
            <Tabs
              defaultValue="additions"
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v === "additions" ? "additions" : "deductions")
              }
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger
                  value="additions"
                  className="data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white"
                >
                  Additions
                </TabsTrigger>
                <TabsTrigger
                  value="deductions"
                  className="data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white"
                >
                  Deductions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="additions">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <Button
                      onClick={() => {
                        setNewMode("addition");
                        setShowAddModal(true);
                      }}
                    >
                      + Add Addition
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label>Rows</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {pageOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Cut Off</TableHead>
                      <TableHead>Created By / Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedData.map((r, idx) => (
                      <TableRow key={`add-${r.id}`}>
                        <TableCell>{(page - 1) * pageSize + idx + 1}</TableCell>
                        <TableCell>
                          {/* show user name by fetching user record from API on demand */}
                          <EmployeeName userId={r.user_id} />
                        </TableCell>
                        <TableCell>
                          {formatCurrency(Number(r.amount))}
                        </TableCell>
                        <TableCell>{r.description}</TableCell>
                        <TableCell>
                          {r.cutoff_start} → {r.cutoff_end}
                        </TableCell>
                        <TableCell>
                          <div>{createdByDisplay(r)}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            {r.created_date
                              ? new Date(r.created_date).toLocaleString()
                              : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => openEdit(r, "addition")}
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleDelete(r.id, "addition")}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-between items-center mt-3">
                  <div>
                    Showing {(page - 1) * pageSize + 1} -{" "}
                    {Math.min(page * pageSize, total)} of {total}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Prev
                    </Button>
                    <div>
                      Page {page} / {pageCount}
                    </div>
                    <Button
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="deductions">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <Button
                      onClick={() => {
                        setNewMode("deduction");
                        setShowAddModal(true);
                      }}
                    >
                      + Add Deduction
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label>Rows</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {pageOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Cut Off</TableHead>
                      <TableHead>Created By / Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedData.map((r, idx) => (
                      <TableRow key={`ded-${r.id}`}>
                        <TableCell>{(page - 1) * pageSize + idx + 1}</TableCell>
                        <TableCell>
                          <EmployeeName userId={r.user_id} />
                        </TableCell>
                        <TableCell>
                          {formatCurrency(Number(r.amount))}
                        </TableCell>
                        <TableCell>{r.description}</TableCell>
                        <TableCell>
                          {r.cutoff_start} → {r.cutoff_end}
                        </TableCell>
                        <TableCell>
                          <div>{createdByDisplay(r)}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            {r.created_date
                              ? new Date(r.created_date).toLocaleString()
                              : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => openEdit(r, "deduction")}
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleDelete(r.id, "deduction")}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-between items-center mt-3">
                  <div>
                    Showing {(page - 1) * pageSize + 1} -{" "}
                    {Math.min(page * pageSize, total)} of {total}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Prev
                    </Button>
                    <div>
                      Page {page} / {pageCount}
                    </div>
                    <Button
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Add Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                Add {newMode === "addition" ? "Addition(s)" : "Deduction(s)"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {newRows.map((r, idx) => (
                <div
                  key={`newrow-${idx}`}
                  className="border p-4 rounded-md space-y-4"
                >
                  <div className="space-y-4">
                    <div className="md:col-span-1">
                      <Label htmlFor={`employee-${idx}`}>Employee</Label>
                      <div className="relative">
                        <Input
                          id={`employee-${idx}`}
                          type="text"
                          value={r.searchText}
                          onFocus={() =>
                            updateNewRow(idx, { showDropdown: true })
                          }
                          onChange={(e) => {
                            updateNewRow(idx, {
                              searchText: e.target.value,
                              showDropdown: true,
                            });
                          }}
                          placeholder="Search by name or ID..."
                        />
                        {(r.showDropdown ?? false) &&
                          filterUsers(r.searchText, users).length > 0 && (
                            <div className="absolute z-10 w-full border bg-white max-h-36 overflow-auto mt-1 rounded-md shadow-lg">
                              {filterUsers(r.searchText, users).map((u) => (
                                <div
                                  key={u.user_id}
                                  className="p-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => {
                                    updateNewRow(idx, {
                                      user: u,
                                      user_id: u.user_id,
                                      searchText: fullname(u),
                                      showDropdown: false,
                                    });
                                  }}
                                >
                                  {fullname(u)} (ID: {u.user_id})
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                    <div className="md:col-span-1">
                      <Label htmlFor={`date-${idx}`}>Choose Date</Label>
                      <Input
                        id={`date-${idx}`}
                        type="date"
                        value={r.datePicked}
                        onChange={(e) => handleDateChange(idx, e.target.value)}
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        Cutoff: {r.cutoff_start || "—"} → {r.cutoff_end || "—"}
                      </div>
                    </div>
                    <div className="md:col-span-1">
                      <Label htmlFor={`description-${idx}`}>Description</Label>
                      <Input
                        id={`description-${idx}`}
                        type="text"
                        value={r.description ?? ""}
                        onChange={(e) =>
                          updateNewRow(idx, { description: e.target.value })
                        }
                        placeholder="e.g. Allowance, Income Tax, Loan"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Label htmlFor={`amount-${idx}`}>Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          ₱
                        </span>
                        <Input
                          id={`amount-${idx}`}
                          type="text"
                          className="pl-7"
                          value={r.amountText ?? ""}
                          onChange={(e) =>
                            updateNewRow(idx, { amountText: e.target.value })
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeNewRow(idx)}
                      disabled={newRows.length === 1}
                    >
                      Remove
                    </Button>
                    {idx === newRows.length - 1 && (
                      <Button size="sm" onClick={addNewRow}>
                        + Add another
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitNewRows} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <EditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          record={editingRecord.record}
          onSave={(updated) => {
            handleSaveEdit(updated);
          }}
        />

        {/* notifications handled by global Toaster in DashboardLayout */}
      </div>
    </DashboardLayout>
  );
}

/* ----------------- Small helper components / utils ----------------- */

// Employee name component (fetches the user when rendered).
function EmployeeName({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/items/user/${userId}`);
        if (!res.ok) return;
        const json = await res.json();
        const u = json.data ?? json;
        if (!cancelled) setUser(u);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!user) return <span>Loading...</span>;
  return (
    <span>{`${user.user_fname} ${user.user_mname ?? ""} ${
      user.user_lname
    }`}</span>
  );
}


/* ----------------- Edit Modal Component ----------------- */
function EditModal({
  isOpen,
  onClose,
  record,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  record: PayrollRecord | null;
  onSave: (updated: PayrollRecord) => void;
}) {
  const [description, setDescription] = useState(record?.description ?? "");
  const [amountText, setAmountText] = useState(
    record?.amount != null ? String(record.amount) : ""
  );
  const [cutoffStart, setCutoffStart] = useState(record?.cutoff_start ?? "");
  const [cutoffEnd, setCutoffEnd] = useState(record?.cutoff_end ?? "");

  // initialize from record on mount; EditModal is keyed by parent when record changes

  const handleSave = () => {
    if (!record) return;
    const amt = parseFloat((amountText || "").replace(/[^\d.]/g, ""));
    onSave({
      ...record,
      description,
      amount: isNaN(amt) ? "0.00" : amt.toFixed(2),
      cutoff_start: cutoffStart,
      cutoff_end: cutoffEnd,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Employee</Label>
            <div className="p-2 border rounded bg-gray-50">
              {record && <EmployeeName userId={record.user_id} />}
            </div>
          </div>
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Allowance, Income Tax, Loan"
            />
          </div>
          <div>
            <Label htmlFor="edit-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                ₱
              </span>
              <Input
                id="edit-amount"
                type="text"
                className="pl-7"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-cutoff-start">Cutoff Start</Label>
            <Input
              id="edit-cutoff-start"
              type="date"
              value={cutoffStart}
              onChange={(e) => setCutoffStart(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-cutoff-end">Cutoff End</Label>
            <Input
              id="edit-cutoff-end"
              type="date"
              value={cutoffEnd}
              onChange={(e) => setCutoffEnd(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
