"use client";
import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Search, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { Department, UserLookup } from "./types";
import * as departmentApi from "./providers/departmentApi";

import DepartmentTable from "./components/DepartmentTable";
import DepartmentFormModal from "./components/DepartmentFormModal";

export function DepartmentModule() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<UserLookup[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [sortField, setSortField] = useState<keyof Department>("department_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);

  // Fetch lookups
  useEffect(() => {
    async function init() {
      try {
        const [depts, users, readOnlySetting] = await Promise.all([
          departmentApi.fetchAllDepartments(),
          departmentApi.fetchAllUsers(),
          departmentApi.fetchGeneralSetting("payroll_department_management_read_only"),
        ]);
        setAllDepartments(depts);
        setAllUsers(users);
        setIsReadOnly(readOnlySetting === "1" || readOnlySetting === "true");
      } catch (err: any) {
        toast.error("Failed to load department lookups");
      }
    }
    init();
  }, [refreshKey]); // re-fetch all departments if we add a new one

  // Fetch paginated
  useEffect(() => {
    let cancel = false;
    setLoading(true);

    departmentApi
      .fetchDepartmentsPaged({
        page: currentPage,
        pageSize: rowsPerPage,
        search: searchTerm,
        sortField,
        sortOrder,
      })
      .then(({ rows, total }) => {
        if (cancel) return;
        setDepartments(rows);
        setTotalItems(total);
      })
      .catch((err: any) => {
        if (!cancel) toast.error("Failed to load departments");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });

    return () => {
      cancel = true;
    };
  }, [currentPage, rowsPerPage, searchTerm, sortField, sortOrder, refreshKey]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const openCreateModal = () => {
    if (isReadOnly) {
      toast.error("Department management is in read-only mode. Adding departments is disabled.");
      return;
    }
    setSelectedDept(null);
    setFormModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setSelectedDept(dept);
    setFormModalOpen(true);
  };

  const confirmDelete = (dept: Department) => {
    if (isReadOnly) {
      toast.error("Department management is in read-only mode. Deleting departments is disabled.");
      return;
    }
    setDeptToDelete(dept);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (isReadOnly) {
      toast.error("Department management is in read-only mode. Deleting departments is disabled.");
      return;
    }
    if (!deptToDelete?.department_id) return;
    
    try {
      await departmentApi.deleteDepartment(deptToDelete.department_id);
      toast.success("Department deleted successfully");
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete department");
    } finally {
      setDeleteDialogOpen(false);
      setDeptToDelete(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full pt-6">
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Building2 className="h-7 w-7 text-primary" />
                Department Management
              </h1>
              {isReadOnly && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <Lock className="h-3 w-3" /> Read-Only
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isReadOnly
                ? "Department management is in read-only mode. Adding, editing, and deleting records are restricted."
                : "Manage and organize company departments and hierarchical divisions."}
            </p>
          </div>
          {!isReadOnly && (
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" /> Add Department
            </Button>
          )}
        </div>
        
        <Separator className="bg-gray-200 dark:bg-gray-800" />

        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              Departments Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by ID, name, or head..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-9"
                />
              </div>
            </div>

            <DepartmentTable
              loading={loading}
              departments={departments}
              allDepartments={allDepartments}
              allUsers={allUsers}
              totalItems={totalItems}
              page={currentPage}
              pageSize={rowsPerPage}
              sortField={sortField}
              sortOrder={sortOrder}
              onPageChange={setCurrentPage}
              onSort={(field) => {
                if (sortField === field) {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortField(field);
                  setSortOrder("asc");
                }
              }}
              onEdit={openEditModal}
              onDelete={confirmDelete}
              isReadOnly={isReadOnly}
            />
          </CardContent>
        </Card>
      </div>

      <DepartmentFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        department={selectedDept}
        allDepartments={allDepartments}
        allUsers={allUsers}
        onSaved={() => {
          setRefreshKey((k) => k + 1);
        }}
        isReadOnly={isReadOnly}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the department &quot;{deptToDelete?.department_name}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
