import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, Pencil, Trash2, Mail, Phone, ShieldAlert, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { Employee, Department } from "../types";

interface EmployeeTableProps {
  loading: boolean;
  employees: Employee[];
  departments: Department[];
  totalEmployees: number;
  page: number;
  pageSize: number;
  sortField: keyof Employee;
  sortOrder: "asc" | "desc";
  onPageChange: (page: number) => void;
  onSort: (field: keyof Employee) => void;
  onEdit: (emp: Employee) => void;
  onDelete: (emp: Employee) => void;
  isReadOnly?: boolean;
}

export default function EmployeeTable({
  loading,
  employees,
  departments,
  totalEmployees,
  page,
  pageSize,
  sortField,
  sortOrder,
  onPageChange,
  onSort,
  onEdit,
  onDelete,
  isReadOnly = false,
}: EmployeeTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalEmployees / pageSize));

  const SortIcon = ({ field }: { field: keyof Employee }) => (
    <ArrowUpDown
      className={`ml-2 h-4 w-4 inline-block cursor-pointer ${
        sortField === field ? "text-primary opacity-100" : "text-gray-400 opacity-50"
      }`}
      onClick={() => onSort(field)}
    />
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <Pagination className="mt-4 justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
              className={page === 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-4 text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
              className={page === totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-900">
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>
                Name <SortIcon field="user_fname" />
              </TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                  No employees found.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp, index) => {
                const dept = departments.find((d) => d.department_id === emp.user_department);
                const isInactive = emp.is_deleted == 1 || emp.is_deleted === true;
                return (
                  <TableRow key={emp.user_id} className={isInactive ? "opacity-60" : ""}>
                    <TableCell className="font-medium text-gray-600">
                      {(page - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {emp.user_lname}, {emp.user_fname} {emp.user_mname?.charAt(0) || ""}
                        {Number(emp.isAdmin) === 1 && (
                          <span title="Admin">
                            <ShieldAlert className="h-3 w-3 text-red-500" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{emp.user_position || "No Position"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {dept?.department_name || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
                        {emp.user_email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3" /> {emp.user_email}
                          </div>
                        )}
                        {emp.user_contact && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {emp.user_contact}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isInactive ? (
                        <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">
                          Inactive
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-200 bg-emerald-50">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isReadOnly ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-gray-600 hover:text-primary hover:bg-primary/10 transition-colors gap-1.5 ml-auto"
                          onClick={() => onEdit(emp)}
                          title="View Employee Details"
                        >
                          <Eye className="h-4 w-4 text-gray-500" />
                          <span className="text-xs font-medium">View</span>
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 shrink-0 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            onClick={() => onEdit(emp)}
                            title="Edit Employee"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 shrink-0 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                            onClick={() => onDelete(emp)}
                            title="Delete Employee"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {renderPagination()}
    </div>
  );
}
