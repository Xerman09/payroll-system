// /modules/allowance/AllowanceModule.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2, Plus } from "lucide-react";

/* ===========================
   Config & Constants
   =========================== */
const API_BASE = "http://100.126.246.124:8060";
const ALLOWANCE_TYPES = [
  "Meals",
  "Load",
  "Motor Allowance",
  "Gas",
  "Others",
] as const;
type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

type User = {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
};

type Allowance = {
  allowance_id: number;
  user_id: number;
  amount: string | number;
  description: string;
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  is_processed?: 0 | 1;
  created_date?: string | null;
  // optional denormalized user fields may appear
  user_full_name?: string;
};

/* ===========================
   UTILITIES
   =========================== */
function iso(date: Date) {
  return date.toISOString().split("T")[0];
}

/**
 * Given a chosen date, compute cutoff start/end using rule:
 *  - if day between 11 and 25 -> start = 11 same month, end = 25 same month
 *  - if day >= 26 -> start = 26 same month, end = 10 next month
 *  - if day between 1 and 10 -> start = 26 previous month, end = 10 current month
 */
function computeCutoffFromDate(dStr: string) {
  if (!dStr) return { start: "", end: "" };
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return { start: "", end: "" };
  const day = d.getDate();
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based

  let start: Date, end: Date;
  if (day >= 11 && day <= 25) {
    start = new Date(y, m, 11);
    end = new Date(y, m, 25);
  } else if (day >= 26) {
    start = new Date(y, m, 26);
    end = new Date(y, m + 1, 10);
  } else {
    // 1..10
    start = new Date(y, m - 1, 26);
    end = new Date(y, m, 10);
  }
  return { start: iso(start), end: iso(end) };
}

function formatCurrency(v: string | number) {
  const num = typeof v === "string" ? Number(v) : v;
  if (isNaN(num)) return v;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(num);
}

function fullnameFromUser(u: User) {
  if (!u) return "Unknown";
  return `${u.user_fname}${u.user_mname ? " " + u.user_mname : ""} ${
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
  // some APIs return { data: [...] }
  return json?.data ?? json ?? [];
}

async function getAllowances(): Promise<Allowance[]> {
  const json = await fetcher(`${API_BASE}/items/employee_allowance?limit=-1`);
  return json?.data ?? json ?? [];
}

async function createAllowance(payload: Partial<Allowance>) {
  const res = await fetch(`${API_BASE}/items/employee_allowance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function updateAllowance(id: number, payload: Partial<Allowance>) {
  const res = await fetch(`${API_BASE}/items/employee_allowance/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteAllowance(id: number) {
  const res = await fetch(`${API_BASE}/items/employee_allowance/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res;
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

function useAllowances() {
  const { data, error } = useSWR("/allowances", getAllowances, {
    revalidateOnFocus: false,
  });
  return { allowances: data ?? [], loading: !data && !error, error };
}

/* ===========================
   MAIN MODULE COMPONENT
   =========================== */
export default function AllowanceModule() {
  // global data via SWR wrapper hooks
  const { users, loading: usersLoading } = useUsers();
  const { allowances, loading: allowancesLoading } = useAllowances();

  /* Table controls: search/filter/pagination */
  const [searchName, setSearchName] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [filterProcessed, setFilterProcessed] = useState<
    "all" | "processed" | "unprocessed"
  >("all");

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  /* Dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Allowance | null>(null); // null => create

  /* Form state: supports multiple rows when creating */
  type FormRow = { type: AllowanceType | ""; other?: string; amount: string };
  const [formEmployee, setFormEmployee] = useState<number | null>(null);
  const [formDate, setFormDate] = useState(() => {
    // default today
    const d = new Date();
    return iso(d);
  });
  const [formRows, setFormRows] = useState<FormRow[]>([
    { type: "Meals", other: "", amount: "" },
  ]);

  // when editing single allowance, show single-row form and prefill
  useEffect(() => {
    if (editing) {
      setFormEmployee(editing.user_id);
      setFormDate(editing.cutoff_start || iso(new Date()));
      setFormRows([
        {
          type: ALLOWANCE_TYPES.includes(editing.description as any)
            ? (editing.description as AllowanceType)
            : "Others",
          other: ALLOWANCE_TYPES.includes(editing.description as any)
            ? ""
            : editing.description,
          amount: String(editing.amount ?? ""),
        },
      ]);
      setDialogOpen(true);
    } else {
      // create mode: ensure at least one row
      setFormRows((r) =>
        r.length === 0 ? [{ type: "Meals", other: "", amount: "" }] : r
      );
    }
  }, [editing]);

  /* Derived cutoff preview */
  const cutoffPreview = useMemo(
    () => computeCutoffFromDate(formDate),
    [formDate]
  );

  /* Filtered & paginated list for table */
  const filtered = useMemo(() => {
    const normalize = (s = "") => s.trim().toLowerCase();
    const nameQ = normalize(searchName);
    const descQ = normalize(searchDescription);

    return allowances.filter((a) => {
      // filter processed
      if (filterProcessed === "processed" && Number(a.is_processed) !== 1)
        return false;
      if (filterProcessed === "unprocessed" && Number(a.is_processed) === 1)
        return false;

      // user name filter: find user by id
      if (nameQ) {
        const u = users.find((uu) => uu.user_id === a.user_id);
        const name = u
          ? fullnameFromUser(u).toLowerCase()
          : (a.user_full_name ?? "").toLowerCase();
        if (!name.includes(nameQ)) return false;
      }

      if (descQ) {
        if (!String(a.description).toLowerCase().includes(descQ)) return false;
      }

      return true;
    });
  }, [allowances, users, searchName, searchDescription, filterProcessed]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages]);

  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ===========================
     CRUD ACTIONS (wired to API & SWR mutate)
     =========================== */
  const reloadAll = useCallback(() => {
    // revalidate allowances and users
    mutate("/allowances");
    mutate("/users");
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!formEmployee) return alert("Select employee.");
    if (!formDate) return alert("Select a date for cutoff preview.");

    // validation
    for (let i = 0; i < formRows.length; i++) {
      const r = formRows[i];
      if (!r.type) return alert(`Row ${i + 1}: choose description`);
      if (r.type === "Others" && !r.other?.trim())
        return alert(`Row ${i + 1}: specify 'Others' description`);
      if (!r.amount || isNaN(Number(r.amount)) || Number(r.amount) <= 0)
        return alert(`Row ${i + 1}: provide valid amount`);
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
        // update single allowance (first row represents edited item)
        await updateAllowance(editing.allowance_id, payloads[0]);
        alert("Allowance updated.");
      } else {
        // create many allowances (one POST per row)
        for (const p of payloads) {
          await createAllowance(p);
        }
        alert("Allowance(s) created.");
      }
      setDialogOpen(false);
      setEditing(null);
      reloadAll();
      // reset create form
      setFormRows([{ type: "Meals", other: "", amount: "" }]);
    } catch (err: any) {
      console.error(err);
      alert("Failed: " + (err.message ?? err));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this allowance? This cannot be undone.")) return;
    try {
      await deleteAllowance(id);
      // immediate UI update by revalidating
      reloadAll();
      alert("Deleted");
    } catch (err: any) {
      console.error(err);
      alert("Delete failed: " + (err.message ?? err));
    }
  };

  /* ===========================
     UI Helpers for rows
     =========================== */
  const addFormRow = () =>
    setFormRows((s) => [...s, { type: "Meals", other: "", amount: "" }]);
  const removeFormRow = (idx: number) =>
    setFormRows((s) => s.filter((_, i) => i !== idx));
  const updateFormRow = (idx: number, patch: Partial<FormRow>) =>
    setFormRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  /* ===========================
     Render
     =========================== */
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Allowance Management</CardTitle>

            <div className="flex items-center gap-2">
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
            </div>
          </CardHeader>

          <CardContent>
            {/* FILTER BAR */}
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
                  onValueChange={(v) => {
                    setFilterProcessed(v as any);
                    setPage(1);
                  }}
                  defaultValue="all"
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
                    onClick={() => {
                      setSearchName("");
                      setSearchDescription("");
                      setFilterProcessed("all");
                    }}
                    variant="outline"
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => {
                      // quick reload
                      reloadAll();
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cutoff</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowancesLoading ? (
                    <TableRow>
                      <TableCell colSpan={7}>Loading...</TableCell>
                    </TableRow>
                  ) : pageData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>No records found.</TableCell>
                    </TableRow>
                  ) : (
                    pageData.map((a, idx) => {
                      const idxGlobal = (page - 1) * PAGE_SIZE + idx + 1;
                      const user = users.find((u) => u.user_id === a.user_id);
                      const fullname = user
                        ? fullnameFromUser(user)
                        : a.user_full_name ?? `User ${a.user_id}`;
                      return (
                        <TableRow key={a.allowance_id}>
                          <TableCell>{idxGlobal}</TableCell>
                          <TableCell>{fullname}</TableCell>
                          <TableCell>{formatCurrency(a.amount)}</TableCell>
                          <TableCell>{a.description}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">{a.cutoff_start}</span>
                              <span className="text-sm text-muted-foreground">
                                {a.cutoff_end}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {Number(a.is_processed) === 1 ? (
                              <Badge>Processed</Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditing(a);
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(a.allowance_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* PAGINATION */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm">
                Showing <b>{(page - 1) * PAGE_SIZE + 1}</b> -{" "}
                <b>{Math.min(page * PAGE_SIZE, filtered.length)}</b> of{" "}
                <b>{filtered.length}</b>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </Button>
                <div>
                  Page {page} / {totalPages}
                </div>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================
          ADD / EDIT DIALOG (SINGLE FILE)
         ============================ */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Allowance" : "Add Allowance(s)"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            {/* Employee */}
            <div>
              <Label>Employee</Label>
              <Select
                value={formEmployee ? String(formEmployee) : ""}
                onValueChange={(v) => setFormEmployee(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={String(u.user_id)}>
                      {fullnameFromUser(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usersLoading && (
                <div className="text-xs text-muted-foreground">
                  Loading employees...
                </div>
              )}
            </div>

            {/* Date for cutoff preview */}
            <div>
              <Label>Choose date (auto compute cutoff)</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
              <div className="text-sm text-muted-foreground mt-1">
                Cutoff preview:{" "}
                <span className="font-medium">{cutoffPreview.start}</span> →{" "}
                <span className="font-medium">{cutoffPreview.end}</span>
              </div>
            </div>

            {/* Multiple rows */}
            <div>
              <Label>Allowance entries</Label>
              <div className="space-y-3 mt-2">
                {formRows.map((row, i) => (
                  <div
                    key={i}
                    className="border rounded p-3 grid grid-cols-12 gap-3 items-end"
                  >
                    <div className="col-span-5">
                      <Label className="text-xs">Description</Label>
                      <Select
                        value={row.type}
                        onValueChange={(v) =>
                          updateFormRow(i, {
                            type: v as AllowanceType,
                            other: "",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALLOWANCE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-4">
                      {row.type === "Others" ? (
                        <>
                          <Label className="text-xs">Specify</Label>
                          <Input
                            value={row.other}
                            onChange={(e) =>
                              updateFormRow(i, { other: e.target.value })
                            }
                          />
                        </>
                      ) : (
                        <div className="h-10" />
                      )}
                    </div>

                    <div className="col-span-2">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        value={row.amount}
                        onChange={(e) => {
                          const v = e.target.value;
                          // simple validation: allow numbers and dot
                          if (/^[0-9]*\.?[0-9]{0,2}$/.test(v) || v === "") {
                            updateFormRow(i, { amount: v });
                          }
                        }}
                      />
                    </div>

                    <div className="col-span-1">
                      <div className="flex flex-col gap-2">
                        {formRows.length > 1 && (
                          <Button
                            variant="destructive"
                            onClick={() => removeFormRow(i)}
                            size="sm"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2">
                <Button variant="outline" onClick={addFormRow}>
                  + Add another allowance
                </Button>
              </div>
            </div>

            {/* Preview of what will be created */}
            <div>
              <Label>Submission preview</Label>
              <div className="p-3 rounded border">
                <div className="text-sm mb-2">
                  Employee:{" "}
                  <b>
                    {formEmployee
                      ? users.find((u) => u.user_id === formEmployee)
                        ? fullnameFromUser(
                            users.find((u) => u.user_id === formEmployee)!
                          )
                        : `User ${formEmployee}`
                      : "—"}
                  </b>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {formRows.map((r, i) => (
                    <div key={i} className="flex justify-between">
                      <div>{r.type === "Others" ? r.other : r.type}</div>
                      <div>{formatCurrency(r.amount)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Cutoff: <b>{cutoffPreview.start}</b> →{" "}
                  <b>{cutoffPreview.end}</b>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <div className="flex gap-2 w-full justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setDialogOpen(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateOrUpdate}>
                {editing ? "Save changes" : "Create Allowance(s)"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
