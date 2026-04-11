import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { Employee, RetroPayFromApi, SortConfig } from "../types";
import { useState } from "react";
import { RetroTableSkeleton } from "./RetroTableSkeleton";

interface RetroTableProps {
  data: RetroPayFromApi[];
  loading: boolean;
  refreshing: boolean;
  employees: Employee[];
  pagination: {
    currentPage: number;
    totalPages: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rows: number) => void;
    getPageButtons: () => (number | string)[];
  };
  sorting: {
    sortConfig: SortConfig;
    onSort: (key: string) => void;
  };
  onEdit: (retro: RetroPayFromApi) => void;
  onDelete: (retro: RetroPayFromApi) => void;
}

export default function RetroTable({
  data,
  loading,
  employees,
  pagination,
  sorting,
  onEdit,
  onDelete,
}: RetroTableProps) {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [retroToDelete, setRetroToDelete] = useState<RetroPayFromApi | null>(
    null
  );

  const formatEmployeeName = (maybeUser: number | Employee | undefined) => {
    if (!maybeUser && maybeUser !== 0) return "Unknown";
    if (typeof maybeUser === "number") {
      const emp = employees.find((e) => e.user_id === maybeUser);
      if (!emp) return `ID ${maybeUser}`;
      return `${emp.user_fname} ${emp.user_mname ? emp.user_mname + " " : ""}${
        emp.user_lname
      }`;
    } else {
      return `${maybeUser.user_fname} ${
        maybeUser.user_mname ? maybeUser.user_mname + " " : ""
      }${maybeUser.user_lname}`;
    }
  };

  const formatCurrency = (val?: string) => {
    const num = parseFloat(val || "0");
    return Number.isNaN(num)
      ? "₱0.00"
      : `₱${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  };

  const { onSort } = sorting;

  const confirmDelete = (retro: RetroPayFromApi) => {
    setDeleteId(retro.retro_id);
    setRetroToDelete(retro);
  };

  const executeDelete = () => {
    if (retroToDelete) {
      onDelete(retroToDelete);
      setDeleteId(null);
      setRetroToDelete(null);
    }
  };

  return (
    <div className="w-full">
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow>
              <TableHead className="w-[60px] font-semibold text-gray-700">
                No.
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center gap-2 font-semibold text-gray-700">
                  Name
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => onSort("amount")}
              >
                <div className="flex items-center gap-2 font-semibold text-gray-700">
                  Amount
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Description
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => onSort("cutoff_start")}
              >
                <div className="flex items-center gap-2 font-semibold text-gray-700">
                  Cut Off
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <RetroTableSkeleton />
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              data.map((retro, idx) => (
                <TableRow key={retro.retro_id} className="hover:bg-gray-50/50">
                  <TableCell className="font-medium text-gray-600">
                    {(pagination.currentPage - 1) * pagination.rowsPerPage +
                      idx +
                      1}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {formatEmployeeName(retro.user_id)}
                  </TableCell>
                  <TableCell className="font-medium text-gray-700">
                    {formatCurrency(retro.amount)}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {retro.description || "-"}
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {formatDate(retro.cutoff_start)} -{" "}
                    {formatDate(retro.cutoff_end)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                        onClick={() => onEdit(retro)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => confirmDelete(retro)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer - Left Text / Right Buttons */}
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Showing {(pagination.currentPage - 1) * pagination.rowsPerPage + 1} to{" "}
          {Math.min(
            pagination.currentPage * pagination.rowsPerPage,
            pagination.totalPages * pagination.rowsPerPage
          )}{" "}
          of {pagination.totalPages * pagination.rowsPerPage} entries
          {/* Note: Ideally we want totalRecords count from API, here approximated via pages for UI */}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
          >
            Prev
          </Button>
          <div className="text-sm font-medium px-2">
            Page {pagination.currentPage} / {pagination.totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Alert Dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this retro pay record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={executeDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
