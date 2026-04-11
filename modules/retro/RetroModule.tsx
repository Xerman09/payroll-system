"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getLoggedUser } from "@/lib/auth";
import { Plus, RefreshCw, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Employee, RetroPayFromApi, RetroFormState, SortConfig } from "./types";
import { retroApi } from "./providers/retroApi";
import RetroTable from "./components/RetroTable";
import RetroModal from "./components/RetroModal";

export default function RetroModule() {
  const [retroPays, setRetroPays] = useState<RetroPayFromApi[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "cutoff_start",
    order: "desc",
  });

  // 1. Fetch Data
  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await retroApi.fetchAll();
      setEmployees(data.employees || []);
      setRetroPays(data.retroPays || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // 2. Logic: Filtering & Sorting
  const getEmployeeName = useCallback(
    (userId: number | Employee) => {
      const id = typeof userId === "object" ? userId.user_id : userId;
      const emp = employees.find((e) => e.user_id === id);
      return emp
        ? `${emp.user_fname} ${emp.user_mname || ""} ${emp.user_lname}`
        : "";
    },
    [employees]
  );

  const filteredRetroPays = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return retroPays;
    return retroPays.filter((r) => {
      const idMatch = String(
        typeof r.user_id === "number" ? r.user_id : r.user_id?.user_id
      ).includes(q);
      const name = getEmployeeName(r.user_id).toLowerCase();
      return idMatch || name.includes(q);
    });
  }, [retroPays, searchTerm, getEmployeeName]);

  const sortedRetroPays = useMemo(() => {
    const arr = [...filteredRetroPays];
    if (!sortConfig.key) return arr;

    arr.sort((a, b) => {
      let aValue: string | number = "";
      let bValue: string | number = "";

      switch (sortConfig.key) {
        case "name":
          aValue = getEmployeeName(a.user_id).toLowerCase();
          bValue = getEmployeeName(b.user_id).toLowerCase();
          break;
        case "amount":
          aValue = parseFloat(a.amount || "0");
          bValue = parseFloat(b.amount || "0");
          break;
        case "cutoff_start":
          aValue = new Date(a.cutoff_start).getTime();
          bValue = new Date(b.cutoff_start).getTime();
          break;
      }

      if (aValue < bValue) return sortConfig.order === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.order === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredRetroPays, sortConfig, getEmployeeName]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedRetroPays.length / rowsPerPage)
  );
  const paginatedData = sortedRetroPays.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // 3. Handlers
  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      order: current.key === key && current.order === "asc" ? "desc" : "asc",
    }));
  };

  const handleCreate = async (data: RetroFormState) => {
    const loggedUser = getLoggedUser();
    if (!loggedUser) {
      toast.error("User not logged in");
      return;
    }

    if (
      !data.user_id ||
      !data.amount ||
      !data.cutoff_start ||
      !data.cutoff_end
    ) {
      toast.error("Please fill required fields");
      return;
    }

    try {
      await retroApi.create(data, Number(loggedUser.user_id));
      toast.success("Retro pay added successfully");
      setDialogOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add";
      toast.error(msg);
    }
  };

  const handleUpdate = async (data: RetroFormState) => {
    if (!editingId) return;
    const loggedUser = getLoggedUser();
    if (!loggedUser) return;

    try {
      await retroApi.update(editingId, data, Number(loggedUser.user_id));
      toast.success("Retro pay updated successfully");
      setDialogOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      toast.error(msg);
    }
  };

  const handleDelete = async (retro: RetroPayFromApi) => {
    try {
      await retroApi.delete(retro.retro_id);
      toast.success("Record deleted");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      toast.error(msg);
    }
  };

  const openAddDialog = () => {
    setIsEditing(false);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (retro: RetroPayFromApi) => {
    setIsEditing(true);
    setEditingId(retro.retro_id);
    setDialogOpen(true);
  };

  // Reset Filter Handler
  const handleReset = () => {
    setSearchTerm("");
    setSortConfig({ key: "cutoff_start", order: "desc" });
    setCurrentPage(1);
    toast.info("Filters reset");
  };

  // Pagination Helper
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

  const getInitialFormData = (): RetroFormState | undefined => {
    if (!editingId) return undefined;
    const retro = retroPays.find((r) => r.retro_id === editingId);
    if (!retro) return undefined;
    return {
      user_id: String(
        typeof retro.user_id === "number"
          ? retro.user_id
          : retro.user_id.user_id
      ),
      amount: retro.amount,
      description: retro.description || "",
      cutoff_start: retro.cutoff_start,
      cutoff_end: retro.cutoff_end,
    };
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Section to match COOP Image */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Retro Pay
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage retroactive payment adjustments and records.
            </p>
          </div>
          <Button
            onClick={openAddDialog}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Retro Pay
          </Button>
        </div>
        <Separator />

        {/* Main Content Card */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-6 space-y-6">
            {/* Filter Bar Grid - Matching Image Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Search */}
              <div className="md:col-span-5 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Search employee
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type name..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Sort/Filter (Using as Sort since we don't have Status) */}
              <div className="md:col-span-3 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sort By
                </Label>
                <Select
                  value={sortConfig.key}
                  onValueChange={(val) => handleSort(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cutoff_start">Cutoff Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quick Actions */}
              <div className="md:col-span-4 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quick Actions
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Reset
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => loadData()}
                    disabled={isRefreshing}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 mr-2 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            {/* Table */}
            <RetroTable
              data={paginatedData}
              loading={isLoading}
              refreshing={isRefreshing}
              employees={employees}
              pagination={{
                currentPage,
                totalPages,
                rowsPerPage,
                onPageChange: setCurrentPage,
                onRowsPerPageChange: (rows) => {
                  setRowsPerPage(rows);
                  setCurrentPage(1);
                },
                getPageButtons,
              }}
              sorting={{
                sortConfig,
                onSort: handleSort,
              }}
              onEdit={openEditDialog}
              onDelete={handleDelete}
            />
          </CardContent>
        </Card>

        <RetroModal
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          isEditing={isEditing}
          employees={employees}
          initialData={getInitialFormData()}
          onSubmit={isEditing ? handleUpdate : handleCreate}
        />
      </div>
    </DashboardLayout>
  );
}
