"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Plus, 
  Edit, 
  RefreshCw, 

  Calendar, 
  Layers, 
  PhilippinePeso, 
  Info,
  ShieldCheck,
  TrendingUp,
  Activity, 
  Award, 
  Wallet,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import * as wageApi from "../providers/wageApi";
import type { SalarySchedule, SalarySchedulePayload } from "../types";

export function SalaryGradeManagement() {
  const [schedules, setSchedules] = useState<SalarySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [formData, setFormData] = useState<SalarySchedulePayload>({
    effectivity_date: new Date().toISOString().split("T")[0],
    salary_grade: 1,
    step: 1,
    monthly_rate: 0,
  });
  const [rateDisplay, setRateDisplay] = useState("");

  // Warning Prompt state
  const [warningPromptOpen, setWarningPromptOpen] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<SalarySchedule | null>(null);


  useEffect(() => {
    loadSchedules();
  }, [refreshKey]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const data = await wageApi.fetchSalarySchedules();
      setSchedules(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load salary schedules.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  const filteredSchedules = useMemo(() => {
    if (!searchTerm) return schedules;
    const s = searchTerm.toLowerCase();
    return schedules.filter(
      (sch) =>
        sch.salary_grade.toString().includes(s) ||
        sch.effectivity_date.includes(s) ||
        sch.monthly_rate.toString().includes(s)
    );
  }, [schedules, searchTerm]);

  // Pagination logic
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredSchedules.length / rowsPerPage) || 1;
  const paginatedSchedules = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredSchedules.slice(start, start + rowsPerPage);
  }, [filteredSchedules, currentPage, rowsPerPage]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      effectivity_date: new Date().toISOString().split("T")[0],
      salary_grade: 1,
      step: 1,
      monthly_rate: 0,
    });
    setRateDisplay("");
    setModalOpen(true);
  };

  const handleOpenEdit = (sch: SalarySchedule) => {
    // Check if user has previously dismissed the warning
    const isDismissed = localStorage.getItem("sg_edit_warning_dismissed") === "true";
    
    if (isDismissed) {
      executeOpenEdit(sch);
    } else {
      setPendingEdit(sch);
      setWarningPromptOpen(true);
    }
  };

  const executeOpenEdit = (sch: SalarySchedule) => {
    setEditingId(sch.schedule_id);
    setFormData({
      effectivity_date: sch.effectivity_date,
      salary_grade: sch.salary_grade,
      step: sch.step,
      monthly_rate: Number(sch.monthly_rate),
    });
    // Initialize formatted value
    const parts = Number(sch.monthly_rate).toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setRateDisplay(parts.join("."));
    setModalOpen(true);
  };

  const handleConfirmWarning = () => {
    if (dontAskAgain) {
      localStorage.setItem("sg_edit_warning_dismissed", "true");
    }
    if (pendingEdit) {
      executeOpenEdit(pendingEdit);
    }
    setWarningPromptOpen(false);
  };

  const handleResetWarnings = () => {
    localStorage.removeItem("sg_edit_warning_dismissed");
    setDontAskAgain(false);
    toast.success("Notice settings reset. Update warnings will now reappear.");
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await wageApi.patchSalarySchedule(editingId, formData);
        toast.success("Schedule updated successfully.");
      } else {
        await wageApi.createSalarySchedule(formData);
        toast.success("Schedule created successfully.");
      }
      setModalOpen(false);
      handleRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save schedule.");
    }
  };

  const handleRateInput = (val: string) => {
    const rawValue = val.replace(/,/g, "");
    // Allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(rawValue)) {
      const parts = rawValue.split(".");
      // Limit decimal digits to 2
      if (parts[1] && parts[1].length > 2) return;
      
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      setRateDisplay(parts.join("."));
      setFormData({ ...formData, monthly_rate: Number(rawValue) });
    }
  };

  // Metrics calculation
  const stats = useMemo(() => ({
    total: filteredSchedules.length,
    activeGrades: new Set(filteredSchedules.map(s => s.salary_grade)).size,
    latestMonthly: Math.max(...schedules.map(s => Number(s.monthly_rate)), 0),
    avgMonthly: schedules.length > 0
      ? schedules.reduce((acc, s) => acc + Number(s.monthly_rate), 0) / schedules.length
      : 0
  }), [schedules, filteredSchedules]);

  const getStatus = (date: string) => {
    const effDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return effDate <= today ? "Active" : "Upcoming";
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Stats Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/20">
          <div className="h-10 w-10 bg-primary/5 dark:bg-primary/10 text-primary rounded-lg flex items-center justify-center">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Total Records</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/20">
          <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 rounded-lg flex items-center justify-center">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Active Grades</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.activeGrades}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/10/50">
          <div className="h-10 w-10 bg-amber-50 dark:bg-amber-900/10 text-amber-600 rounded-lg flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Ceiling Rate</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stats.latestMonthly.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/10/50">
          <div className="h-10 w-10 bg-primary/5 dark:bg-primary/10 text-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Avg. Monthly</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {stats.avgMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      <Separator className="my-2" />

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        {/* Left Side: Search */}
        <div className="flex-1 w-full md:max-w-md space-y-1">
          <label className="text-xs font-medium text-gray-500">Search schedule</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by grade, date, or rate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 shadow-sm"
            />
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="space-y-1 w-full md:w-auto">
            <label className="text-xs font-medium text-gray-500">Quick Actions</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10 px-3 gap-2 text-gray-500 border-gray-200 hover:text-primary shadow-none bg-transparent"
                onClick={handleResetWarnings}
                title="Reset Notice Preferences"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 px-3 gap-2 text-gray-600 border-gray-300 shadow-sm"
                onClick={handleRefresh}
                title="Refresh Records"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden lg:inline">Refresh</span>
              </Button>
              <Button 
                onClick={handleOpenAdd} 
                className="h-10 px-4 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Schedule
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow>
              <TableHead className="text-gray-600 font-semibold py-3 px-4 text-xs">Effectivity Date</TableHead>
              <TableHead className="text-gray-600 font-semibold py-3 px-4 text-xs text-center">Status</TableHead>
              <TableHead className="text-gray-600 font-semibold py-3 px-4 text-xs text-center">Salary Grade</TableHead>
              <TableHead className="text-gray-600 font-semibold py-3 px-4 text-xs text-center">Step Level</TableHead>
              <TableHead className="text-gray-600 font-semibold py-3 px-4 text-xs">Monthly Rate</TableHead>
              <TableHead className="text-gray-600 font-semibold py-3 px-4 text-xs">Annual Gross</TableHead>
              <TableHead className="text-right text-gray-600 font-semibold py-3 px-4 text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                      <span className="text-sm font-semibold tracking-wide uppercase">Fetching Records</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredSchedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 font-medium text-center text-gray-400">
                    No active salary schedules found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSchedules.map((sch) => (
                  <TableRow key={sch.schedule_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <TableCell className="px-4 py-3 font-medium text-gray-500 text-sm whitespace-nowrap">
                      {sch.effectivity_date}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {getStatus(sch.effectivity_date) === "Active" ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-bold border border-emerald-100 dark:border-emerald-900/50">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 bg-primary/5 dark:bg-primary/10 text-primary rounded-full text-[10px] font-bold border border-primary/20 dark:border-primary/30">
                          Upcoming
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold border border-gray-200 dark:border-gray-700/50 shadow-sm">
                        SG {sch.salary_grade}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center text-gray-600 dark:text-gray-300 text-sm">Step {sch.step}</TableCell>
                    <TableCell className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 text-sm tabular-nums">
                      {Number(sch.monthly_rate).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-sm tabular-nums">
                      {(Number(sch.monthly_rate) * 12).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-primary border-primary/20 hover:bg-primary/5 hover:text-primary rounded-md"
                          onClick={() => handleOpenEdit(sch)}
                          title="Edit Schedule"
                        >
                          <Edit size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-50 dark:border-gray-900 mt-2">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Showing{" "}
            {filteredSchedules.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to{" "}
            {Math.min(currentPage * rowsPerPage, filteredSchedules.length)} of{" "}
            {filteredSchedules.length} entries
          </div>
          
          <div className="hidden sm:flex items-center gap-2 border-l pl-4">
            <span className="text-[10px] font-bold uppercase text-gray-400">Rows:</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(v) => {
                setRowsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-[70px] text-xs font-semibold bg-transparent border-none shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[70px]">
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-8 px-3 text-gray-600 border-gray-200 hover:bg-gray-50"
          >
            Prev
          </Button>
          <div className="flex items-center gap-1 mx-2">
            <span className="text-xs text-gray-400">Page</span>
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{currentPage}</span>
            <span className="text-xs text-gray-400">of</span>
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-8 px-3 text-gray-600 border-gray-200 hover:bg-gray-50"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden border-none shadow-3xl rounded-3xl bg-white dark:bg-gray-950 max-h-[85vh] flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            
            {/* COMPACT HEADER */}
            <div className="px-6 pt-6 pb-3 shrink-0 border-b border-gray-50 dark:border-gray-900">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/10 ring-4 ring-primary/5">
                    <ShieldCheck size={20} className="text-white fill-blue-400/20" />
                  </div>
                  <div className="space-y-0.5">
                    <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                      {editingId ? "Update Schedule" : "Add New Schedule"}
                    </DialogTitle>
                    <div className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                      <div className="h-1 w-1 bg-primary rounded-full animate-pulse"></div>
                      Compensation Management Unit
                    </div>
                  </div>
                </div>
                <DialogDescription className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                  Define standardized monthly rates for specific grades and steps. This data synchronizes across all automated systems.
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-160px)] custom-scrollbar">
              
              {/* EFFECTIVITY */}
              <div className="space-y-2">
                <Label htmlFor="effectivity" className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.12em] ml-1 flex items-center gap-2">
                  <Calendar size={12} className="text-gray-400" />
                  Effective Start Date
                </Label>
                <div className="relative group">
                  <Input
                    id="effectivity"
                    type="date"
                    value={formData.effectivity_date}
                    onChange={(e) =>
                      setFormData({ ...formData, effectivity_date: e.target.value })
                    }
                    className="h-10 bg-gray-50/50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800 rounded-xl focus:ring-[6px] focus:ring-primary/5 focus:border-primary/50 transition-all pl-10 font-semibold text-sm tracking-tight"
                    required
                  />
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 group-focus-within:text-primary transition-colors" />
                </div>
              </div>

              {/* GRADE & STEP GRID */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grade" className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.12em] ml-1 flex items-center gap-2">
                    <Layers size={11} className="text-gray-400" />
                    Salary Grade
                  </Label>
                  <Select
                    value={String(formData.salary_grade)}
                    onValueChange={(v) =>
                      setFormData({ ...formData, salary_grade: Number(v) })
                    }
                  >
                    <SelectTrigger className="h-10 bg-gray-50/50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800 rounded-xl focus:ring-4 focus:ring-primary/5 font-semibold transition-all">
                      <SelectValue placeholder="SG" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 dark:border-gray-800">
                      {Array.from({ length: 33 }, (_, i) => i + 1).map((g) => (
                        <SelectItem key={g} value={String(g)} className="font-bold text-xs py-2.5">
                          SG {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="step" className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.12em] ml-1 flex items-center gap-2">
                    <TrendingUp size={11} className="text-gray-400" />
                    Step Level
                  </Label>
                  <Select
                    value={String(formData.step)}
                    onValueChange={(v) =>
                      setFormData({ ...formData, step: Number(v) })
                    }
                  >
                    <SelectTrigger className="h-10 bg-gray-50/50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800 rounded-xl focus:ring-4 focus:ring-primary/5 font-semibold transition-all">
                      <SelectValue placeholder="Step" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 dark:border-gray-800">
                      {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                        <SelectItem key={s} value={String(s)} className="font-semibold text-xs py-2.5">
                          Step {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* MONTHLY RATE */}
              <div className="space-y-2">
                <Label htmlFor="rate" className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.12em] ml-1 flex items-center gap-2">
                  <PhilippinePeso size={11} className="text-gray-400" />
                  Monthly Basic Salary
                </Label>
                <div className="relative group">
                  <Input
                    id="rate"
                    type="text"
                    placeholder="e.g. 21,500.00"
                    value={rateDisplay}
                    onChange={(e) => handleRateInput(e.target.value)}
                    className="h-12 bg-gray-50/50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800 rounded-xl focus:ring-[6px] focus:ring-primary/5 focus:border-primary/50 transition-all pl-11 font-mono text-lg font-bold text-gray-900 dark:text-gray-100 placeholder:font-sans placeholder:text-xs placeholder:font-semibold placeholder:text-gray-400"
                    required
                  />
                  <PhilippinePeso className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 group-focus-within:text-primary transition-colors stroke-[2]" />
                </div>
              </div>

              {/* COMPACT INFO BOX */}
              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/10 p-3.5 rounded-xl flex gap-3 relative overflow-hidden group/info">
                <div className="shrink-0 h-8 w-8 bg-white dark:bg-gray-900 rounded-lg border border-primary/10 dark:border-primary/20 flex items-center justify-center shadow-sm">
                  <Info size={14} className="text-primary" />
                </div>
                <div className="space-y-1 relative z-10">
                  <h5 className="text-[10px] font-bold uppercase text-primary tracking-wide">Sync Assurance</h5>
                  <p className="text-[10px] leading-relaxed text-gray-600 dark:text-gray-400 font-semibold italic opacity-80 decoration-primary/20 underline underline-offset-4 line-clamp-2">
                    Ensure rates comply with organizational standards before submission. System auto-verifies baseline logic.
                  </p>
                </div>
              </div>
            </div>

            {/* STICKY FOOTER */}
            <DialogFooter className="p-6 border-t border-gray-50 dark:border-gray-900 bg-gray-50/20 flex flex-col-reverse sm:flex-row gap-2 shrink-0">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setModalOpen(false)} 
                className="w-full sm:w-auto h-10 px-4 rounded-xl text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:bg-white dark:hover:bg-gray-900 hover:text-red-500 transition-all"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="w-full sm:flex-1 h-10 bg-gray-900 dark:bg-primary hover:bg-black dark:hover:bg-primary/90 text-white font-bold text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-primary/10 active:scale-[0.97] transition-all"
              >
                {editingId ? "Finalize Update" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* --- WARNING PROMPT DIALOG --- */}
      <Dialog open={warningPromptOpen} onOpenChange={setWarningPromptOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-white dark:bg-gray-950">
          <div className="p-8 space-y-7">
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="h-20 w-20 bg-amber-100/50 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center shadow-inner shadow-white/20 ring-8 ring-amber-500/10 transition-transform hover:scale-105 duration-500">
                <AlertTriangle size={40} className="text-amber-600 drop-shadow-sm" />
              </div>
              <DialogHeader className="space-y-3">
                <DialogTitle className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight text-center">
                  Data Persistence Notice
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-center font-medium max-w-[280px] mx-auto">
                  Only update the schedule to fix <span className="text-amber-700 dark:text-amber-500 font-bold underline decoration-amber-500/30 underline-offset-4">informational errors</span>.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/10 space-y-4 shadow-sm">
              <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed text-center">
                If this is a <span className="text-primary font-extrabold underline decoration-primary/20 underline-offset-4">rate adjustment</span>, please create a new schedule to preserve history.
              </p>
              
              <div className="flex items-center justify-center space-x-3 pt-3 border-t border-amber-100/50 dark:border-amber-500/10">
                <Checkbox 
                  id="dontAsk" 
                  checked={dontAskAgain} 
                  onCheckedChange={(checked) => setDontAskAgain(checked as boolean)}
                  className="rounded-md border-amber-300 dark:border-amber-700 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 h-4.5 w-4.5" 
                />
                <label 
                  htmlFor="dontAsk" 
                  className="text-[10px] font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest cursor-pointer select-none"
                >
                  Don&apos;t show this again
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button 
                onClick={handleConfirmWarning}
                className="w-full h-12 bg-gray-900 dark:bg-amber-600 hover:bg-black dark:hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-amber-950/20 transition-all active:scale-[0.98]"
              >
                Proceed to Update
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setWarningPromptOpen(false)}
                className="w-full h-12 rounded-2xl text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
              >
                Go Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
