"use client";
import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { ClipboardCheck } from "lucide-react";
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

import type { AttendanceLog } from "./types";
import * as attendanceApi from "./providers/attendanceApi";
import PendingLogsTable from "./components/PendingLogsTable";
import ApprovalModal from "./components/ApprovalModal";

export function AttendanceApprovalModule() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [logToReject, setLogToReject] = useState<AttendanceLog | null>(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);

    attendanceApi.fetchPendingLogs()
      .then((data) => {
        if (cancel) return;
        setLogs(data);
      })
      .catch(() => {
        if (!cancel) toast.error("Failed to load pending attendance logs");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });

    return () => { cancel = true; };
  }, [refreshKey]);

  const handleApproveClick = (log: AttendanceLog) => {
    setSelectedLog(log);
    setApprovalModalOpen(true);
  };

  const handleRejectClick = (log: AttendanceLog) => {
    setLogToReject(log);
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!logToReject) return;
    setRejecting(true);
    try {
      await attendanceApi.submitApproval(logToReject.log_id, {
        employee_id: logToReject.user_id,
        date_schedule: logToReject.log_date,
        approved_by: 1, // fallback
        work_minutes: 0,
        late_minutes: 0,
        undertime_minutes: 0,
        overtime_minutes: 0,
        remarks: "Rejected by HR",
        status: "rejected"
      });
      toast.success("Attendance log rejected");
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to reject log");
    } finally {
      setRejecting(false);
      setRejectDialogOpen(false);
      setLogToReject(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full pt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ClipboardCheck className="h-7 w-7 text-primary" />
              Attendance Approval
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review and approve pending daily attendance logs for employees.
            </p>
          </div>
        </div>
        
        <Separator className="bg-gray-200 dark:bg-gray-800" />

        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium">
              Pending Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PendingLogsTable
              loading={loading}
              logs={logs}
              onApproveClick={handleApproveClick}
              onRejectClick={handleRejectClick}
            />
          </CardContent>
        </Card>
      </div>

      <ApprovalModal
        open={approvalModalOpen}
        onOpenChange={setApprovalModalOpen}
        log={selectedLog}
        onSaved={() => setRefreshKey(k => k + 1)}
      />

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Attendance Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject the attendance log for {logToReject?.user?.user_fname} {logToReject?.user?.user_lname} on {logToReject?.log_date}?
              This action will mark the log as rejected and no hours will be credited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmReject();
              }}
              disabled={rejecting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {rejecting ? "Rejecting..." : "Reject Log"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
