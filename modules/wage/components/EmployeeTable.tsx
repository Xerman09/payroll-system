// @modules/wage/components/EmployeeTable.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Search, RotateCcw, RefreshCcw } from "lucide-react";
import type { Department, Employee } from "../types";

type Props = {
  employees: Employee[];
  departments: Department[];
  loading: boolean;
  selectedDept: number | null;
  setSelectedDept: (dept: number | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSort: (key: "user_id" | "user_fname" | "user_lname") => void;
  onOpenPassword: (emp: Employee) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  rowsPerPage: number;
  totalEmployees: number;
  onRefresh: () => void;
  onReset: () => void;
};

export default function EmployeeTable({
  employees,
  departments,
  loading,
  selectedDept,
  setSelectedDept,
  searchTerm,
  setSearchTerm,
  handleSort,
  onOpenPassword,
  currentPage,
  setCurrentPage,
  rowsPerPage,
  totalEmployees,
  onRefresh,
  onReset,
}: Props) {
  const totalPages = Math.ceil(totalEmployees / rowsPerPage) || 1;

  return (
    <div className="w-full space-y-4">
      {/* --- Filter / Toolbar Section --- */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between mt-4">
        {/* Left Side: Search (Grows to fill) */}
        <div className="flex-1 w-full md:max-w-md space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Search employee
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Type name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Right Side: Filters & Actions (Compact) */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Department Filter - Fixed Width */}
          <div className="space-y-1 w-full md:w-[200px]">
            <label className="text-xs font-medium text-gray-500">
              Department
            </label>
            <Select
              value={selectedDept !== null ? selectedDept.toString() : "all"}
              onValueChange={(val) =>
                setSelectedDept(val === "all" ? null : Number(val))
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem
                    key={dept.department_id}
                    value={dept.department_id.toString()}
                  >
                    {dept.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort By - Fixed Width */}
          <div className="space-y-1 w-full md:w-[160px]">
            <label className="text-xs font-medium text-gray-500">Sort By</label>
            <Select
              onValueChange={(val: "user_id" | "user_fname" | "user_lname") => handleSort(val)}
              defaultValue="user_id"
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user_id">Employee ID</SelectItem>
                <SelectItem value="user_fname">First Name</SelectItem>
                <SelectItem value="user_lname">Last Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick Actions - Auto Width */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Quick Actions
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10 px-3 gap-2 text-gray-600 border-gray-300"
                onClick={onReset}
                title="Reset Filters"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden lg:inline">Reset</span>
              </Button>
              <Button
                className="h-10 px-4 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={onRefresh}
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Visual Separator --- */}
      <Separator className="my-4" />

      {/* --- Table Section --- */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow>
              <TableHead className="w-[100px] text-gray-600 font-semibold">
                No.
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Name
              </TableHead>
              <TableHead className="text-gray-600 font-semibold">
                Department
              </TableHead>
              <TableHead className="text-right text-gray-600 font-semibold pr-6">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse inline-block" />
                  </TableCell>
                </TableRow>
              ))
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-gray-500"
                >
                  No employees found.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const deptName =
                  departments.find(
                    (d) => d.department_id === emp.user_department
                  )?.department_name ?? "N/A";
                return (
                  <TableRow
                    key={emp.user_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell className="font-medium text-gray-500">
                      {emp.user_id}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                      {emp.user_fname} {emp.user_lname}
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-300">
                      {deptName}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary/30 hover:bg-primary/5 hover:text-primary"
                        onClick={() => onOpenPassword(emp)}
                      >
                        View Wage Info
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- Pagination Section --- */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
        <div className="text-sm text-gray-500">
          Showing{" "}
          {employees.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to{" "}
          {Math.min(currentPage * rowsPerPage, totalEmployees)} of{" "}
          {totalEmployees} entries
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-8 px-3 text-gray-600"
          >
            Prev
          </Button>
          <div className="text-sm font-medium px-2">
            Page {currentPage} / {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-8 px-3 text-gray-600"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
