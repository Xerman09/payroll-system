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
  setRowsPerPage: (rows: number) => void;
  totalPages: number;
  pageButtons: (number | string)[];
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
  setRowsPerPage,
  totalPages,
  pageButtons,
}: Props) {
  return (
    <div className="w-full rounded-lg p-4 mb-6 shadow-sm bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-4">
        <div className="w-full md:w-72">
          <Select
            value={selectedDept !== null ? selectedDept.toString() : "all"}
            onValueChange={(val: string) =>
              setSelectedDept(val === "all" ? null : Number(val))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Department (Optional)" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-700 dark:text-white">
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

        <div className="flex-1 min-w-[220px] w-full md:w-auto">
          <Input
            placeholder="Search Employee ID or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
        </div>

        <div className="flex gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
          <Button onClick={() => handleSort("user_id")}>Sort by ID</Button>
          <Button onClick={() => handleSort("user_fname")}>
            Sort by First Name
          </Button>
          <Button onClick={() => handleSort("user_lname")}>
            Sort by Last Name
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: rowsPerPage }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                  </TableCell>
                </TableRow>
              ))
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
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
                  <TableRow key={emp.user_id}>
                    <TableCell>{emp.user_id}</TableCell>
                    <TableCell>
                      {emp.user_fname} {emp.user_lname}
                    </TableCell>
                    <TableCell>{deptName}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" onClick={() => onOpenPassword(emp)}>
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

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
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

        <div className="flex gap-2 flex-wrap">
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
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          >
            Prev
          </Button>
          {pageButtons.map((page, idx) =>
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
              >
                {page}
              </Button>
            )
          )}
          <Button
            size="sm"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
          >
            Next
          </Button>
          <Button
            size="sm"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(totalPages)}
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  );
}
