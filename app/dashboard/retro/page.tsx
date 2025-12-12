"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Edit, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Types
 */
type Employee = {
  user_id: number;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  user_email?: string;
  user_position?: string;
};

type RetroPayFromApi = {
  retro_id: number;
  user_id: number | Employee; // Directus may expand to object or keep numeric id
  amount: string; // decimal as string, e.g. "1000.00"
  description?: string | null;
  cutoff_start: string;
  cutoff_end: string;
  is_processed?: number;
  created_by?: number | null;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
};

export default function RetroPayPage() {
  const [retroPays, setRetroPays] = useState<RetroPayFromApi[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // dialog and add/edit form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRetro, setEditingRetro] = useState<RetroPayFromApi | null>(
    null
  );
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [addForm, setAddForm] = useState({
    user_id: "",
    amount: "",
    description: "",
    cutoff_start: "",
    cutoff_end: "",
  });

  // delete confirmation
  const [deleteRetro, setDeleteRetro] = useState<RetroPayFromApi | null>(null);

  // table UI
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>(""); // "name" | "amount" | "cutoff_start"
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const API_BASE = "http://100.126.246.124:8060";

  // ---------- Fetching ----------
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        // Fetch employees (all)
        const empRes = await fetch(
          `${API_BASE}/items/user?limit=-1&fields=user_id,user_fname,user_mname,user_lname,user_email,user_position`,
          { cache: "no-store" }
        );
        const empJson = await empRes.json();
        setEmployees(empJson.data || []);

        // Fetch retro pays with expanded user (so user_id becomes object)
        const retroRes = await fetch(
          `${API_BASE}/items/retro_pay?fields=*,user_id.*`,
          { cache: "no-store" }
        );
        const retroJson = await retroRes.json();
        setRetroPays(retroJson.data || []);
      } catch (err) {
        console.error("Failed to load data:", err);
        toast.error("Failed to load retro pays or employees");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  // helper to refresh retro pays (call after add)
  const refreshRetroPays = async () => {
    try {
      const retroRes = await fetch(
        `${API_BASE}/items/retro_pay?fields=*,user_id.*`,
        { cache: "no-store" }
      );
      const retroJson = await retroRes.json();
      setRetroPays(retroJson.data || []);
    } catch (err) {
      console.error("Failed to refresh retro pays:", err);
    }
  };

  // ---------- Helper: get employee name ----------
  const getEmployeeFromId = useCallback(
    (userId: number) => employees.find((e) => e.user_id === userId),
    [employees]
  );

  const formatEmployeeName = useCallback(
    (maybeUser: number | Employee | undefined) => {
      if (!maybeUser && maybeUser !== 0) return "Unknown";
      if (typeof maybeUser === "number") {
        const emp = getEmployeeFromId(maybeUser);
        if (!emp) return `ID ${maybeUser}`;
        return `${emp.user_fname} ${
          emp.user_mname ? emp.user_mname + " " : ""
        }${emp.user_lname}`;
      } else {
        // Employee object
        return `${maybeUser.user_fname} ${
          maybeUser.user_mname ? maybeUser.user_mname + " " : ""
        }${maybeUser.user_lname}`;
      }
    },
    [getEmployeeFromId]
  );

  // ---------- Filtering / Sorting / Pagination ----------
  const filteredRetroPays = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return retroPays;
    return retroPays.filter((r) => {
      // search by id, name
      const idMatch = String(
        typeof r.user_id === "number" ? r.user_id : r.user_id?.user_id
      ).includes(q);
      const name = formatEmployeeName(r.user_id).toLowerCase();
      return idMatch || name.includes(q);
    });
  }, [retroPays, searchTerm, formatEmployeeName]);

  const sortedRetroPays = useMemo(() => {
    const arr = [...filteredRetroPays];
    if (!sortBy) return arr;

    arr.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "name":
          aValue = formatEmployeeName(a.user_id).toLowerCase();
          bValue = formatEmployeeName(b.user_id).toLowerCase();
          break;
        case "amount":
          aValue = parseFloat(a.amount || "0");
          bValue = parseFloat(b.amount || "0");
          break;
        case "cutoff_start":
          aValue = new Date(a.cutoff_start).getTime();
          bValue = new Date(b.cutoff_start).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return arr;
  }, [filteredRetroPays, sortBy, sortOrder, formatEmployeeName]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedRetroPays.length / rowsPerPage)
  );
  const paginatedRetroPays = sortedRetroPays.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  useEffect(() => {
    // keep currentPage in range if rowsPerPage or list changes
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // ---------- Add Retro ----------
  const handleAddRetro = async () => {
    // validation
    if (
      !addForm.user_id ||
      !addForm.amount ||
      !addForm.cutoff_start ||
      !addForm.cutoff_end
    ) {
      toast.error(
        "Please fill required fields: employee, amount, cutoff dates"
      );
      return;
    }

    const session = sessionStorage.getItem("user");
    if (!session) {
      toast.error("User not logged in");
      return;
    }
    const loggedUser = JSON.parse(session);

    const payload = {
      user_id: parseInt(addForm.user_id, 10),
      amount: parseFloat(addForm.amount).toFixed(2),
      description: addForm.description || null,
      cutoff_start: addForm.cutoff_start,
      cutoff_end: addForm.cutoff_end,
      created_by: loggedUser.user_id,
    };

    try {
      const res = await fetch(`${API_BASE}/items/retro_pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      toast.success("Retro pay added");
      setDialogOpen(false);
      setAddForm({
        user_id: "",
        amount: "",
        description: "",
        cutoff_start: "",
        cutoff_end: "",
      });
      setEmployeeSearchTerm("");
      await refreshRetroPays();
    } catch (err) {
      console.error("Add retro failed:", err);
      toast.error("Failed to add retro pay");
    }
  };

  // ---------- Edit Retro ----------
  const handleEditRetro = (retro: RetroPayFromApi) => {
    setIsEditing(true);
    setEditingRetro(retro);
    setAddForm({
      user_id: String(
        typeof retro.user_id === "number"
          ? retro.user_id
          : retro.user_id.user_id
      ),
      amount: retro.amount,
      description: retro.description || "",
      cutoff_start: retro.cutoff_start,
      cutoff_end: retro.cutoff_end,
    });
    setDialogOpen(true);
  };

  // ---------- Update Retro ----------
  const handleUpdateRetro = async () => {
    if (!editingRetro) return;

    // validation
    if (
      !addForm.user_id ||
      !addForm.amount ||
      !addForm.cutoff_start ||
      !addForm.cutoff_end
    ) {
      toast.error(
        "Please fill required fields: employee, amount, cutoff dates"
      );
      return;
    }

    const session = sessionStorage.getItem("user");
    if (!session) {
      toast.error("User not logged in");
      return;
    }
    const loggedUser = JSON.parse(session);

    const payload = {
      user_id: parseInt(addForm.user_id, 10),
      amount: parseFloat(addForm.amount).toFixed(2),
      description: addForm.description || null,
      cutoff_start: addForm.cutoff_start,
      cutoff_end: addForm.cutoff_end,
      updated_by: loggedUser.user_id,
    };

    try {
      const res = await fetch(
        `${API_BASE}/items/retro_pay/${editingRetro.retro_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      toast.success("Retro pay updated");
      setDialogOpen(false);
      await refreshRetroPays();
    } catch (err) {
      console.error("Update retro failed:", err);
      toast.error("Failed to update retro pay");
    }
  };

  // ---------- Delete Retro ----------
  const confirmDelete = async () => {
    if (!deleteRetro) return;

    try {
      const res = await fetch(
        `${API_BASE}/items/retro_pay/${deleteRetro.retro_id}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt}`);
      }

      toast.success("Retro pay deleted");
      setDeleteRetro(null);
      await refreshRetroPays();
    } catch (err) {
      console.error("Delete retro failed:", err);
      toast.error("Failed to delete retro pay");
    }
  };

  // ---------- Utilities ----------
  const formatCurrency = (amountStr?: string) => {
    if (!amountStr) return "₱0.00";
    const num = parseFloat(amountStr);
    if (Number.isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ---------- Employee modal filtering ----------
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
        (emp.user_email || "").toLowerCase().includes(q) ||
        (emp.user_position || "").toLowerCase().includes(q)
      );
    });
  }, [employees, employeeSearchTerm]);

  // ---------- Pagination buttons helper ----------
  const getPageButtons = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(currentPage - 2, 1);
      let end = start + 4;
      if (end > totalPages) {
        end = totalPages;
        start = end - 4;
      }
      if (start > 1) pages.push(1, "...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages) pages.push("...", totalPages);
    }
    return pages;
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Retro Pay
          </h1>
        </div>

        <div className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-6 shadow-sm bg-white dark:bg-gray-900">
          <h2 className="text-xl font-semibold mb-3">Retro Pay Records</h2>

          <div className="flex gap-4 items-center mb-4">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search Employee ID or Name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setDialogOpen(true);
                }}
              >
                Add Retro
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">No.</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => {
                      setSortBy("name");
                      setSortOrder((s) => (s === "asc" ? "desc" : "asc"));
                    }}
                  >
                    Name{" "}
                    {sortBy === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => {
                      setSortBy("amount");
                      setSortOrder((s) => (s === "asc" ? "desc" : "asc"));
                    }}
                  >
                    Amount{" "}
                    {sortBy === "amount"
                      ? sortOrder === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => {
                      setSortBy("cutoff_start");
                      setSortOrder((s) => (s === "asc" ? "desc" : "asc"));
                    }}
                  >
                    Cut Off{" "}
                    {sortBy === "cutoff_start"
                      ? sortOrder === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  // skeleton rows
                  Array.from({ length: rowsPerPage }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="h-4 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedRetroPays.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-gray-500"
                    >
                      No retro pays found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRetroPays.map((retro, idx) => (
                    <TableRow key={retro.retro_id}>
                      <TableCell>
                        {(currentPage - 1) * rowsPerPage + idx + 1}
                      </TableCell>
                      <TableCell>{formatEmployeeName(retro.user_id)}</TableCell>
                      <TableCell>{formatCurrency(retro.amount)}</TableCell>
                      <TableCell>{retro.description || "-"}</TableCell>
                      <TableCell>
                        {formatDate(retro.cutoff_start)} -{" "}
                        {formatDate(retro.cutoff_end)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleEditRetro(retro)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteRetro(retro)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Retro Pay
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this retro pay
                                  for {formatEmployeeName(deleteRetro?.user_id)}
                                  ? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel
                                  onClick={() => setDeleteRetro(null)}
                                >
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive"
                                  onClick={confirmDelete}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4 p-4">
            <div>
              Rows per page:{" "}
              <select
                className="border px-2 py-1 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
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
                onClick={() => setCurrentPage(1)}
              >
                First
              </Button>
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
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
              >
                Next
              </Button>
              <Button
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                Last
              </Button>
            </div>
          </div>
        </div>

        {/* Add/Edit Retro Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setIsEditing(false);
              setEditingRetro(null);
              setAddForm({
                user_id: "",
                amount: "",
                description: "",
                cutoff_start: "",
                cutoff_end: "",
              });
              setEmployeeSearchTerm("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Edit Retro Pay" : "Add Retro Pay"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Select Employee</Label>
                <Popover
                  open={employeeDropdownOpen}
                  onOpenChange={setEmployeeDropdownOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={employeeDropdownOpen}
                      className="w-full justify-between dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                      {addForm.user_id
                        ? formatEmployeeName(Number(addForm.user_id))
                        : "Search Employee ID or Name..."}
                      <span className="ml-2">▼</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <div className="p-2">
                      <Input
                        placeholder="Search Employee ID, Name, Email, Position..."
                        value={employeeSearchTerm}
                        onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                        className="mb-2"
                      />
                      <div className="max-h-60 overflow-y-auto">
                        {filteredEmployees.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">
                            No employees found.
                          </div>
                        ) : (
                          filteredEmployees.map((emp) => (
                            <div
                              key={emp.user_id}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                              onClick={() => {
                                setAddForm((p) => ({
                                  ...p,
                                  user_id: String(emp.user_id),
                                }));
                                setEmployeeDropdownOpen(false);
                                setEmployeeSearchTerm("");
                              }}
                            >
                              <div className="font-medium">
                                {emp.user_fname}{" "}
                                {emp.user_mname ? emp.user_mname + " " : ""}
                                {emp.user_lname}
                              </div>
                              <div className="text-xs text-gray-500">
                                ID: {emp.user_id}{" "}
                                {emp.user_position
                                  ? `· ${emp.user_position}`
                                  : ""}
                              </div>
                              {emp.user_email && (
                                <div className="text-xs text-gray-500">
                                  {emp.user_email}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    ₱
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={addForm.amount}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Enter description"
                  value={addForm.description}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cutoff_start">Cutoff Start</Label>
                  <Input
                    id="cutoff_start"
                    type="date"
                    value={addForm.cutoff_start}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        cutoff_start: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="cutoff_end">Cutoff End</Label>
                  <Input
                    id="cutoff_end"
                    type="date"
                    value={addForm.cutoff_end}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, cutoff_end: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={isEditing ? handleUpdateRetro : handleAddRetro}>
                {isEditing ? "Update Retro Pay" : "Add Retro Pay"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
