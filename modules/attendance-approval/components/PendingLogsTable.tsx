import React from "react";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { AttendanceLog } from "../types";

interface PendingLogsTableProps {
  loading: boolean;
  logs: AttendanceLog[];
  onApproveClick: (log: AttendanceLog) => void;
  onRejectClick: (log: AttendanceLog) => void;
}

export default function PendingLogsTable({
  loading,
  logs,
  onApproveClick,
  onRejectClick,
}: PendingLogsTableProps) {
  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    try {
      return format(parseISO(isoString), "hh:mm a");
    } catch {
      return isoString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      <Table>
        <TableHeader className="bg-gray-50 dark:bg-gray-900">
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time In</TableHead>
            <TableHead>Time Out</TableHead>
            <TableHead>System Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                No pending attendance logs found.
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log, index) => {
              const empName = log.user 
                ? `${log.user.user_fname} ${log.user.user_lname}` 
                : `User ID: ${log.user_id}`;
              const deptName = log.department 
                ? log.department.department_name 
                : `Dept ID: ${log.department_id}`;

              return (
                <TableRow key={log.log_id}>
                  <TableCell className="font-medium text-gray-600">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                    {empName}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {deptName}
                  </TableCell>
                  <TableCell>
                    {formatDate(log.log_date)}
                  </TableCell>
                  <TableCell>
                    {formatTime(log.time_in)}
                  </TableCell>
                  <TableCell>
                    {formatTime(log.time_out)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {log.status || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => onApproveClick(log)}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Review & Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onRejectClick(log)}
                      >
                        <XCircle className="h-4 w-4" />
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
  );
}
