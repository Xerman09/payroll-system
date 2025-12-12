"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------- TYPES ----------------
type User = {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
};

type Addition = {
  id: number;
  user_id: number;
  amount: string | number;
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  created_by?: number | null;
  created_date?: string;
};

type Deduction = Addition;

// ---------------- CONSTANTS ----------------
const API_BASE = "http://100.126.246.124:8060/items";

// ---------------- UTILITIES ----------------
function normalizeArrayResponse<T>(resJson: any): T[] {
  if (!resJson) return [];
  if (Array.isArray(resJson)) return resJson;
  if (Array.isArray(resJson.data)) return resJson.data;
  if (resJson.data && typeof resJson.data === "object") return [resJson.data];
  if (typeof resJson === "object" && Object.keys(resJson).length > 0)
    return [resJson];
  return [];
}

const getCurrentCutoff = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const date = today.getDate();

  let cutoffStart: Date;
  let cutoffEnd: Date;

  if (date >= 11 && date <= 25) {
    cutoffStart = new Date(year, month, 11);
    cutoffEnd = new Date(year, month, 25);
  } else if (date >= 26) {
    cutoffStart = new Date(year, month, 26);
    cutoffEnd = new Date(year, month + 1, 10);
  } else {
    cutoffStart = new Date(year, month - 1, 26);
    cutoffEnd = new Date(year, month, 10);
  }

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  return {
    cutoff_start: formatDate(cutoffStart),
    cutoff_end: formatDate(cutoffEnd),
  };
};

// ---------------- MAIN COMPONENT ----------------

export default function AdditionsDeductionsPage() {
  const [activeTab, setActiveTab] = useState<"additions" | "deductions">("additions");
  const [data, setData] = useState<(Addition | Deduction)[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogFor, setDialogFor] = useState<"addition" | "deduction">("addition");
  const [form, setForm] = useState({
    user_id: "",
    amount: "",
    description: "",
    cutoff_start: "",
    cutoff_end: "",
  });

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [addRes, dedRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/additions`),
          fetch(`${API_BASE}/deductions`),
          fetch("http://100.126.246.124:8060/items/user"),
        ]);
        const addData = normalizeArrayResponse<Addition>(await addRes.json());
        const dedData = normalizeArrayResponse<Deduction>(await dedRes.json());
        const usersData = normalizeArrayResponse<User>(await usersRes.json());
        setData([...addData, ...dedData]);
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (activeTab === "additions") {
        return "id" in item && !("deduction" in item); // Assuming additions have id, deductions might have different structure
      } else {
        return "id" in item && "deduction" in item;
      }
    });
  }, [data, activeTab]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginated = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const getPageButtons = useCallback(() => {
    const buttons: (number | string)[] = [];
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    if (start > 1) {
      buttons.push(1);
      if (start > 2) buttons.push("...");
    }
    for (let i = start; i <= end; i++) buttons.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push("...");
      buttons.push(totalPages);
    }
    return buttons;
  }, [currentPage, totalPages]);

  const getUserName = useCallback((id: number) => {
    const user = users.find((u) => u.user_id === id);
    return user ? `${user.user_fname} ${user.user_mname ?? ""} ${user.user_lname}`.trim() : "Unknown";
  }, [users]);

  const getLoggedInUserId = () => {
    // Placeholder: implement actual logic to get logged in user ID
    return 1; // Example
  };

  const openAddDialog = useCallback((type: "addition" | "deduction") => {
    setDialogMode("add");
    setDialogFor(type);
    const current = getCurrentCutoff();
    setForm({
      user_id: "",
      amount: "",
      description: "",
      cutoff_start: current.cutoff_start,
      cutoff_end: current.cutoff_end,
    });
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((type: "addition" | "deduction", item: Addition | Deduction) => {
    setDialogMode("edit");
    setDialogFor(type);
    setForm({
      user_id: item.user_id.toString(),
      amount: item.amount.toString(),
      description: item.description || "",
      cutoff_start: item.cutoff_start,
      cutoff_end: item.cutoff_end,
    });
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (type: "addition" | "deduction", id: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await fetch(`${API_BASE}/${type}s/${id}`, { method: "DELETE" });
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error deleting:", error);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        user_id: Number(form.user_id),
        amount: Number(form.amount),
        created_by: getLoggedInUserId(),
        created_date: new Date().toISOString(),
      };
      if (dialogMode === "add") {
        const res = await fetch(`${API_BASE}/${dialogFor}s`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const newItem = await res.json();
        setData((prev) => [...prev, newItem]);
      } else {
        // Edit logic, assuming item has id
        const item = data.find((d) => d.id === (form as any).id);
        if (item) {
          await fetch(`${API_BASE}/${dialogFor}s/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          setData((prev) => prev.map((d) => (d.id === item.id ? { ...d, ...payload } : d)));
        }
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Error submitting:", error);
    }
  }, [form, dialogMode, dialogFor, data]);

  return (
  <DashboardLayout>
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Additions & Deductions
      </h1>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger
            value="additions"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Additions
          </TabsTrigger>
          <TabsTrigger
            value="deductions"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Deductions
          </TabsTrigger>
        </TabsList>

        {/* ADDITIONS */}
        <TabsContent value="additions">
          <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <CardHeader>
              <CardTitle>Additions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div />
                <div>
                  <Button onClick={() => openAddDialog("addition")}>
                    + Add Addition
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Cutoff Start</TableHead>
                      <TableHead>Cutoff End</TableHead>
                      <TableHead>Created By / Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6">
                          {loading ? "Loading..." : "No records"}
                        </TableCell>
                      </TableRow>
                    )}
                    {paginated.map((row, idx) => {
                      // only show rows that belong to additions
                      if (activeTab !== "additions") return null;
                      const globalIndex =
                        (currentPage - 1) * rowsPerPage + idx + 1;
                      return (
                        <TableRow key={`add-${row.id}`}>
                          <TableCell>{globalIndex}</TableCell>
                          <TableCell>{getUserName(row.user_id)}</TableCell>
                          <TableCell>
                            ₱
                            {Number(row.amount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>{row.description ?? "-"}</TableCell>
                          <TableCell>{row.cutoff_start}</TableCell>
                          <TableCell>{row.cutoff_end}</TableCell>
                          <TableCell>
                            {row.created_by
                              ? `${getUserName(row.created_by)} / `
                              : ""}
                            {row.created_date
                              ? new Date(row.created_date).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => openEditDialog("addition", row)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDelete("addition", row.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* pagination controls */}
              <div className="flex justify-between items-center mt-4 text-gray-900 dark:text-gray-100">
                <div>
                  Rows per page:{" "}
                  <select
                    className="border px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>

                  {getPageButtons().map((p, i) =>
                    p === "..." ? (
                      <span key={i} className="px-2 py-1">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={i}
                        size="sm"
                        variant={currentPage === p ? "default" : "outline"}
                        onClick={() => setCurrentPage(Number(p))}
                      >
                        {p}
                      </Button>
                    )
                  )}

                  <Button
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEDUCTIONS */}
        <TabsContent value="deductions">
          <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <CardHeader>
              <CardTitle>Deductions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div />
                <div>
                  <Button onClick={() => openAddDialog("deduction")}>
                    + Add Deduction
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Cutoff Start</TableHead>
                      <TableHead>Cutoff End</TableHead>
                      <TableHead>Created By / Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6">
                          {loading ? "Loading..." : "No records"}
                        </TableCell>
                      </TableRow>
                    )}
                    {paginated.map((row, idx) => {
                      // only show rows that belong to deductions
                      if (activeTab !== "deductions") return null;
                      const globalIndex =
                        (currentPage - 1) * rowsPerPage + idx + 1;
                      return (
                        <TableRow key={`ded-${row.id}`}>
                          <TableCell>{globalIndex}</TableCell>
                          <TableCell>{getUserName(row.user_id)}</TableCell>
                          <TableCell>
                            ₱
                            {Number(row.amount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>{row.description ?? "-"}</TableCell>
                          <TableCell>{row.cutoff_start}</TableCell>
                          <TableCell>{row.cutoff_end}</TableCell>
                          <TableCell>
                            {row.created_by
                              ? `${getUserName(row.created_by)} / `
                              : ""}
                            {row.created_date
                              ? new Date(row.created_date).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => openEditDialog("deduction", row)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDelete("deduction", row.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* pagination controls */}
              <div className="flex justify-between items-center mt-4 text-gray-900 dark:text-gray-100">
                <div>
                  Rows per page:{" "}
                  <select
                    className="border px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>

                  {getPageButtons().map((p, i) =>
                    p === "..." ? (
                      <span key={i} className="px-2 py-1">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={i}
                        size="sm"
                        variant={currentPage === p ? "default" : "outline"}
                        onClick={() => setCurrentPage(Number(p))}
                      >
                        {p}
                      </Button>
                    )
                  )}

                  <Button
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ADD / EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add"
                ? dialogFor === "addition"
                  ? "Add Addition"
                  : "Add Deduction"
                : dialogMode === "edit"
                ? dialogFor === "addition"
                  ? "Edit Addition"
                  : "Edit Deduction"
                : ""}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4">
                <label className="text-sm font-medium mb-1 block">
                  Employee
                </label>
                <select
                  value={form.user_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, user_id: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">Select employee</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.user_fname} {u.user_mname ?? ""} {u.user_lname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Description
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Cutoff Start
                  </label>
                  <input
                    type="date"
                    value={form.cutoff_start}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cutoff_start: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Cutoff End
                  </label>
                  <input
                    type="date"
                    value={form.cutoff_end}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cutoff_end: e.target.value }))
                    }
                    className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
              </div>

              <div className="p-4">
                <label className="text-sm font-medium mb-1 block">
                  Created By
                </label>
                <input
                  type="text"
                  readOnly
                  value={(() => {
                    const id = getLoggedInUserId();
                    return id ? `${getUserName(id)} (ID: ${id})` : "Not logged";
                  })()}
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit">
                {dialogMode === "add" ? "Create" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  </DashboardLayout>
);
