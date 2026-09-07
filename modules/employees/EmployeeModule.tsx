"use client";
import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Users, Plus, Search, Lock } from "lucide-react";
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

import type { Employee, Department, EmploymentStatus } from "./types";
import * as employeeApi from "./providers/employeeApi";

import EmployeeTable from "./components/EmployeeTable";
import EmployeeFormModal from "./components/EmployeeFormModal";

export function EmployeeModule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState<number>(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employmentStatuses, setEmploymentStatuses] = useState<EmploymentStatus[]>([]);

  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [sortField, setSortField] = useState<keyof Employee>("user_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [showInactive, setShowInactive] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  // Fetch lookups
  useEffect(() => {
    async function init() {
      try {
        const [depts, statuses, readOnlySetting] = await Promise.all([
          employeeApi.fetchDepartments(),
          employeeApi.fetchEmploymentStatuses(),
          employeeApi.fetchGeneralSetting("payroll_employee_management_read_only"),
        ]);
        setDepartments(depts);
        setEmploymentStatuses(statuses);
        setIsReadOnly(readOnlySetting === "1" || readOnlySetting === "true");
      } catch (err: any) {
        toast.error("Failed to load departments or statuses");
      }
    }
    init();
  }, []);

  // Fetch employees
  useEffect(() => {
    let cancel = false;
    setLoading(true);

    employeeApi
      .fetchEmployeesPaged({
        page: currentPage,
        pageSize: rowsPerPage,
        search: searchTerm,
        deptId: selectedDept,
        statusId: selectedStatus,
        sortField,
        sortOrder,
        showInactive,
      })
      .then(({ rows, total }) => {
        if (cancel) return;
        setEmployees(rows);
        setTotalEmployees(total);
      })
      .catch((err: any) => {
        if (!cancel) toast.error("Failed to load employees");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });

    return () => {
      cancel = true;
    };
  }, [
    currentPage,
    rowsPerPage,
    searchTerm,
    selectedDept,
    selectedStatus,
    sortField,
    sortOrder,
    showInactive,
    refreshKey,
  ]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const openCreateModal = () => {
    if (isReadOnly) {
      toast.error("Employee management is in read-only mode. Adding employees is disabled.");
      return;
    }
    setSelectedEmployee(null);
    setFormModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFormModalOpen(true);
  };

  const confirmDelete = (emp: Employee) => {
    if (isReadOnly) {
      toast.error("Employee management is in read-only mode. Deleting employees is disabled.");
      return;
    }
    setEmployeeToDelete(emp);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (isReadOnly) {
      toast.error("Employee management is in read-only mode. Deleting employees is disabled.");
      return;
    }
    if (!employeeToDelete?.user_id) return;

    try {
      await employeeApi.deleteEmployee(employeeToDelete.user_id);
      toast.success("Employee deleted successfully");
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete employee");
    } finally {
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
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
                <Users className="h-7 w-7 text-primary" />
                Employee Management
              </h1>
              {isReadOnly && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <Lock className="h-3 w-3" /> Read-Only
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isReadOnly
                ? "Employee management is in read-only mode. Adding, editing, and deleting records are restricted."
                : "Manage and organize employee records."}
            </p>
          </div>
          {!isReadOnly && (
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          )}
        </div>
        
        <Separator className="bg-gray-200 dark:bg-gray-800" />

        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              Employees Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by ID, name, email..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                <select
                  className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-sm w-full md:w-48"
                  value={selectedDept ?? ""}
                  onChange={(e) => {
                    setSelectedDept(e.target.value ? Number(e.target.value) : null);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
                
                <select
                  className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-sm w-full md:w-48"
                  value={selectedStatus ?? ""}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value ? Number(e.target.value) : null);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">All Statuses</option>
                  {employmentStatuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.status_name}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Show Inactive
                </label>
              </div>
            </div>

            <EmployeeTable
              loading={loading}
              employees={employees}
              departments={departments}
              totalEmployees={totalEmployees}
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

      <EmployeeFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        employee={selectedEmployee}
        departments={departments}
        employmentStatuses={employmentStatuses}
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
              This will permanently delete employee "{employeeToDelete?.user_fname} {employeeToDelete?.user_lname}".
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
