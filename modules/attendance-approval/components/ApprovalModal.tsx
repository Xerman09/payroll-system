import React, { useEffect, useState } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";

import type { AttendanceLog, DepartmentSchedule, AttendanceApproval, OvertimeRequest } from "../types";
import * as attendanceApi from "../providers/attendanceApi";
import { getLoggedUser } from "@/lib/auth";

interface ApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AttendanceLog | null;
  onSaved: () => void;
}

function computeNightDiffMinutes(
  tIn: Date,
  tOut: Date,
  startTimeStr: string = "22:00",
  endTimeStr: string = "06:00"
): number {
  if (tIn >= tOut) return 0;

  const [sH, sM] = (startTimeStr || "22:00").split(":").map(Number);
  const [eH, eM] = (endTimeStr || "06:00").split(":").map(Number);

  let totalMinutes = 0;
  const baseDate = new Date(tIn);
  baseDate.setHours(0, 0, 0, 0);

  for (let offset = -1; offset <= 2; offset++) {
    const curDate = new Date(baseDate);
    curDate.setDate(curDate.getDate() + offset);

    const wStart = new Date(curDate);
    wStart.setHours(sH, sM, 0, 0);

    const wEnd = new Date(curDate);
    if (sH > eH || (sH === eH && sM >= eM)) {
      wEnd.setDate(wEnd.getDate() + 1);
      wEnd.setHours(eH, eM, 0, 0);
    } else {
      wEnd.setHours(eH, eM, 0, 0);
    }

    const oStart = Math.max(tIn.getTime(), wStart.getTime());
    const oEnd = Math.min(tOut.getTime(), wEnd.getTime());

    if (oEnd > oStart) {
      totalMinutes += Math.round((oEnd - oStart) / 60000);
    }
  }

  return totalMinutes;
}

export default function ApprovalModal({
  open,
  onOpenChange,
  log,
  onSaved,
}: ApprovalModalProps) {
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<DepartmentSchedule | null>(null);
  const [otRequest, setOtRequest] = useState<OvertimeRequest | null>(null);
  const [limitConfig, setLimitConfig] = useState<{ startTime: string; endTime: string; maxWorkingHours: number }>({
    startTime: "22:00",
    endTime: "06:00",
    maxWorkingHours: 0,
  });
  
  const [workMins, setWorkMins] = useState(0);
  const [lateMins, setLateMins] = useState(0);
  const [undertimeMins, setUndertimeMins] = useState(0);
  const [overtimeMins, setOvertimeMins] = useState(0);
  const [nightDiffMins, setNightDiffMins] = useState(0);
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (open && log) {
      setRemarks("");

      // Fetch night diff settings and schedule in parallel
      Promise.all([
        attendanceApi.fetchDepartmentSchedule(log.department_id),
        attendanceApi.fetchNightDiffSettings(),
      ]).then(([sched, cfg]) => {
        setSchedule(sched);
        setLimitConfig(cfg);
        
        let totalWorked = 0;
        let late = 0;
        let ut = 0;
        let ot = 0;
        let nd = 0;
        
        if (log.time_in && log.time_out) {
          const tIn = parseISO(log.time_in);
          const tOut = parseISO(log.time_out);
          totalWorked = Math.max(0, differenceInMinutes(tOut, tIn));

          // Nocturnal window calculation
          nd = computeNightDiffMinutes(tIn, tOut, cfg.startTime, cfg.endTime);
          
          if (sched) {
            const schedStart = parseISO(`${log.log_date}T${sched.work_start}`);
            const schedEnd = parseISO(`${log.log_date}T${sched.work_end}`);
            
            if (tIn > schedStart) {
              late = differenceInMinutes(tIn, schedStart);
            }
            if (tOut < schedEnd) {
              ut = differenceInMinutes(schedEnd, tOut);
            }
            if (tOut > schedEnd) {
              ot = differenceInMinutes(tOut, schedEnd);
            }
          }
        }
        
        setWorkMins(totalWorked);
        setLateMins(late);
        setUndertimeMins(ut);
        setNightDiffMins(nd);

        // Fetch OT request
        attendanceApi.fetchOvertimeRequest(log.user_id, log.log_date).then(otReq => {
          setOtRequest(otReq);
          if (otReq && otReq.status?.toLowerCase() === "approved") {
            setOvertimeMins(otReq.duration_minutes || ot);
          } else {
            setOvertimeMins(0);
          }
        });
      }).catch(() => {
        toast.error("Could not load schedule or settings for department");
      });
    }
  }, [open, log]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!log) return;
    
    setSaving(true);
    try {
      const user = getLoggedUser();
      const approverId = user?.user_id ? Number(user.user_id) : 1;

      const payload: Partial<AttendanceApproval> = {
        employee_id: log.user_id,
        date_schedule: log.log_date,
        approved_by: approverId,
        work_minutes: workMins,
        late_minutes: lateMins,
        undertime_minutes: undertimeMins,
        overtime_minutes: overtimeMins,
        night_diff_minutes: nightDiffMins,
        remarks: remarks || null,
        status: "approved",
      };

      await attendanceApi.submitApproval(log.log_id, payload);
      toast.success("Attendance log approved");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve log");
    } finally {
      setSaving(false);
    }
  };

  if (!log) return null;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "--:--";
    try {
      return format(parseISO(isoString), "hh:mm a");
    } catch {
      return isoString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Approve Attendance</DialogTitle>
          <DialogDescription>
            {log.user?.user_fname} {log.user?.user_lname} • {format(parseISO(log.log_date), "MMMM dd, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg my-4 text-sm">
          <div>
            <span className="text-gray-500 block">Time In</span>
            <strong className="text-gray-900 dark:text-white">{formatTime(log.time_in)}</strong>
          </div>
          <div>
            <span className="text-gray-500 block">Time Out</span>
            <strong className="text-gray-900 dark:text-white">{formatTime(log.time_out)}</strong>
          </div>
          <div>
            <span className="text-gray-500 block">Lunch</span>
            <span className="text-gray-900 dark:text-gray-300">{formatTime(log.lunch_start)} - {formatTime(log.lunch_end)}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Break</span>
            <span className="text-gray-900 dark:text-gray-300">{formatTime(log.break_start)} - {formatTime(log.break_end)}</span>
          </div>
        </div>

        {otRequest && (
          <div className={`p-3 rounded border text-sm mb-4 flex gap-2 items-start ${
            otRequest.status?.toLowerCase() === 'approved' 
              ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800' 
              : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800'
          }`}>
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong>Overtime Request Found ({otRequest.status})</strong>
              <div className="mt-1">
                Requested: {formatTime(otRequest.ot_from)} to {formatTime(otRequest.ot_to)} ({otRequest.duration_minutes} mins)
              </div>
              <div className="text-xs mt-0.5 opacity-80">Reason: {otRequest.purpose}</div>
            </div>
          </div>
        )}

        {schedule && (
          <div className="text-xs text-gray-500 mb-4 flex flex-wrap items-center justify-between gap-2">
            <span>Schedule Reference: {schedule.work_start} to {schedule.work_end}</span>
            <div className="flex items-center gap-2">
              {limitConfig.maxWorkingHours > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Max Limit: {limitConfig.maxWorkingHours}h
                </span>
              )}
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                Night Window: {limitConfig.startTime} – {limitConfig.endTime}
              </span>
            </div>
          </div>
        )}

        {limitConfig.maxWorkingHours > 0 && (workMins + overtimeMins) > (limitConfig.maxWorkingHours * 60) && (
          <div className="p-2.5 rounded-lg border text-xs bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Total hours ({((workMins + overtimeMins) / 60).toFixed(1)} hrs) exceed the daily limit of <b>{limitConfig.maxWorkingHours} hrs</b> ({limitConfig.maxWorkingHours * 60} mins). Excess time will be capped during payroll calculation.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Work (Mins)</Label>
              <Input type="number" value={workMins} onChange={e => setWorkMins(Number(e.target.value))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Late (Mins)</Label>
              <Input type="number" value={lateMins} onChange={e => setLateMins(Number(e.target.value))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">UT (Mins)</Label>
              <Input type="number" value={undertimeMins} onChange={e => setUndertimeMins(Number(e.target.value))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">OT (Mins)</Label>
              <Input type="number" value={overtimeMins} onChange={e => setOvertimeMins(Number(e.target.value))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">ND (Mins)</Label>
              <Input 
                type="number" 
                value={nightDiffMins} 
                onChange={e => setNightDiffMins(Number(e.target.value))} 
                title={`Calculated within ${limitConfig.startTime} - ${limitConfig.endTime}`}
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Remarks (Optional)</Label>
            <Textarea 
              value={remarks} 
              onChange={e => setRemarks(e.target.value)} 
              placeholder="Any adjustments made or notes..."
              rows={2} 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
              {saving ? "Saving..." : "Confirm & Approve"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
