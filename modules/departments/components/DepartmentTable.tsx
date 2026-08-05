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
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { Department, UserLookup } from "../types";

interface DepartmentTableProps {
  loading: boolean;
  departments: Department[];
  allDepartments: Department[];
  allUsers: UserLookup[];
  totalItems: number;
  page: number;
  pageSize: number;
  sortField: keyof Department;
  sortOrder: "asc" | "desc";
  onPageChange: (page: number) => void;
  onSort: (field: keyof Department) => void;
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
}

export default function DepartmentTable({
  loading,
  departments,
  allDepartments,
  allUsers,
  totalItems,
  page,
  pageSize,
  sortField,
  sortOrder,
  onPageChange,
  onSort,
  onEdit,
  onDelete,
}: DepartmentTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const SortIcon = ({ field }: { field: keyof Department }) => (
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
                Department Name <SortIcon field="department_name" />
              </TableHead>
              <TableHead>Parent Division</TableHead>
              <TableHead>Department Head</TableHead>
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
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                  No departments found.
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept, index) => {
                const parent = allDepartments.find((d) => d.department_id === dept.parent_division);
                
                let headName = dept.department_head;
                const headId = dept.department_head_id || (/^\d+$/.test(dept.department_head || "") ? Number(dept.department_head) : null);
                
                if (headId) {
                  const user = allUsers.find(u => u.user_id === headId);
                  if (user) {
                    headName = `${user.user_fname} ${user.user_lname}`;
                  }
                }

                return (
                  <TableRow key={dept.department_id}>
                    <TableCell className="font-medium text-gray-600">
                      {(page - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {dept.department_name}
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-1">{dept.department_description || "No description"}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {parent ? parent.department_name : "None (Root)"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {headName || "Unassigned"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 shrink-0 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                          onClick={() => onEdit(dept)}
                          title="Edit Department"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 shrink-0 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          onClick={() => onDelete(dept)}
                          title="Delete Department"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
