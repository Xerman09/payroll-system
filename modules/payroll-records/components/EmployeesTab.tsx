"use client";

import * as React from "react";
import type { Department, Employee } from "../types";


import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import SortableTableHead from "./SortableTableHead";
import PayslipHistoryModal from "./PayslipHistoryModal";
import BenefitHistoryModal from "./BenefitHistoryModal";
import { PayrollRecordsSkeleton } from "./PayrollRecordsSkeleton";

export default function EmployeesTab({
  loading,
  employees,
  departments,
  companyName,
}: {
  loading: boolean;
  employees: Employee[];
  departments: Department[];
  companyName: string;
}) {
  const [filterDept, setFilterDept] = React.useState<number | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{
    key: "id" | "fname" | "lname" | "department";
    direction: "asc" | "desc";
  }>({ key: "id", direction: "asc" });

  const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
  const [benefitModalOpen, setBenefitModalOpen] = React.useState(false);
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);

  const handleViewBenefitsHistory = (emp: Employee) => {
    setSelectedEmployee(emp);
    setBenefitModalOpen(true);
  };

  const handleSort = (key: "id" | "fname" | "lname" | "department") => {
    setSortConfig((prev) =>
      prev.key === key && prev.direction === "asc"
        ? { key, direction: "desc" }
        : { key, direction: "asc" },
    );
  };

  // pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  const filteredEmployees = React.useMemo(() => {
    return employees
      .filter((emp) => {
        const fullName =
          `${emp.user_fname} ${emp.user_mname ?? ""} ${emp.user_lname}`.toLowerCase();
        const matchesDept = filterDept
          ? emp.user_department === filterDept
          : true;
        const matchesSearch =
          emp.user_id.toString().includes(searchTerm.toLowerCase()) ||
          fullName.includes(searchTerm.toLowerCase());
        return matchesDept && matchesSearch;
      })
      .sort((a, b) => {
        let aVal: string | number = 0, bVal: string | number = 0;
        switch (sortConfig.key) {
          case "id":
            aVal = a.user_id;
            bVal = b.user_id;
            break;
          case "fname":
            aVal = a.user_fname;
            bVal = b.user_fname;
            break;
          case "lname":
            aVal = a.user_lname;
            bVal = b.user_lname;
            break;
          case "department":
            aVal =
              departments.find((d) => d.department_id === a.user_department)
                ?.department_name ?? "";
            bVal =
              departments.find((d) => d.department_id === b.user_department)
                ?.department_name ?? "";
            break;
        }
        if (typeof aVal === "string") {
          const cmp = aVal.localeCompare(String(bVal));
          return sortConfig.direction === "asc" ? cmp : -cmp;
        }
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      });
  }, [employees, departments, filterDept, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  const getPageButtons = () => {
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
  };

  return (
    <div className="space-y-6">
      <CardHeader className="px-0">
        <CardTitle>Employee List</CardTitle>
      </CardHeader>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Department</Label>
          <select
            className="border px-2 py-1 rounded bg-white dark:bg-gray-800 w-full"
            value={filterDept ?? ""}
            onChange={(e) =>
              setFilterDept(e.target.value ? parseInt(e.target.value) : null)
            }
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.department_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Search employee</Label>
          <input
            type="text"
            placeholder="Type name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-2 py-1 rounded bg-white dark:bg-gray-800 w-full"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Sort by</Label>
          <Select
            value={sortConfig.key}
            onValueChange={(value: "id" | "fname" | "lname" | "department") =>
              setSortConfig({ key: value, direction: "asc" })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="id">ID</SelectItem>
              <SelectItem value="fname">First Name</SelectItem>
              <SelectItem value="lname">Last Name</SelectItem>
              <SelectItem value="department">Department</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                label="Employee ID"
                sortKey="id"
                currentSort={sortConfig}
                onSort={(key: string) => handleSort(key as "id" | "fname" | "lname" | "department")}
                className="w-1/4"
              />
              <SortableTableHead
                label="Name"
                sortKey="fname"
                currentSort={sortConfig}
                onSort={(key: string) => handleSort(key as "id" | "fname" | "lname" | "department")}
                className="w-1/4"
              />
              <SortableTableHead
                label="Department"
                sortKey="department"
                currentSort={sortConfig}
                onSort={(key: string) => handleSort(key as "id" | "fname" | "lname" | "department")}
                className="w-1/4"
              />
              <TableHead className="w-1/4">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <PayrollRecordsSkeleton type="employees" />
            ) : paginatedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  No employees found matching the filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedEmployees.map((emp) => {
                const deptName =
                  departments.find((d) => d.department_id === emp.user_department)
                    ?.department_name ?? "N/A";

                return (
                  <TableRow key={emp.user_id} className="border-b">
                    <TableCell>{emp.user_id}</TableCell>
                    <TableCell>
                      {`${emp.user_fname} ${emp.user_mname ?? ""} ${emp.user_lname}`}
                    </TableCell>
                    <TableCell>{deptName}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setHistoryModalOpen(true);
                        }}
                      >
                        View Payslip History
                      </Button>
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => handleViewBenefitsHistory(emp)}
                      >
                        View Benefits History
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PayslipHistoryModal 
        isOpen={historyModalOpen} 
        onClose={() => {
          setHistoryModalOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        companyName={companyName}
      />

      <BenefitHistoryModal
        isOpen={benefitModalOpen}
        onClose={() => {
          setBenefitModalOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
      />

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div>
          Rows per page:{" "}
          <select
            className="border px-2 py-1 rounded bg-white dark:bg-gray-800"
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
          >
            Prev
          </Button>

          {getPageButtons().map((page, idx) =>
            page === "..." ? (
              <span key={idx} className="px-2 py-1">
                ...
              </span>
            ) : (
              <Button
                key={idx}
                size="sm"
                variant={currentPage === page ? "default" : "outline"}
                onClick={() => setCurrentPage(Number(page))}
                className={
                  currentPage === page
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "border-primary text-primary hover:bg-primary/5"
                }
              >
                {page}
              </Button>
            ),
          )}

          <Button
            size="sm"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
