// @modules/wage/components/SalaryGradeRegistration.tsx
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  GraduationCap,
  Layers,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Hash,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import * as wageApi from "../providers/wageApi";
import type { SalaryGrade, SalaryGradePayload } from "../types";

/**
 * Standard 33 Philippine government and corporate salary grade names
 */
const STANDARD_SALARY_GRADES = Array.from(
  { length: 33 },
  (_, i) => `Salary Grade ${i + 1}`
);

function safeFormatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return String(d);
    return format(parsed, "MMM dd, yyyy");
  } catch {
    return String(d);
  }
}

export function SalaryGradeRegistration() {
  const [grades, setGrades] = useState<SalaryGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "standard" | "custom">("all");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<SalaryGrade | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [selectedDropdownValue, setSelectedDropdownValue] = useState<string>("");
  const [customNameInput, setCustomNameInput] = useState<string>("");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<SalaryGrade | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadGrades = async () => {
    setLoading(true);
    try {
      const data = await wageApi.fetchSalaryGrades();
      setGrades(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[SalaryGradeRegistration] Failed to load grades:", err);
      toast.error("Failed to load salary grades.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrades();
  }, []);

  // Set of already registered names (normalized lowercase)
  const registeredNameSet = useMemo(() => {
    return new Set(
      grades
        .filter((g) => g && typeof g.name === "string")
        .map((g) => g.name.trim().toLowerCase())
    );
  }, [grades]);

  // Standard grade coverage count
  const standardRegisteredCount = useMemo(() => {
    return STANDARD_SALARY_GRADES.filter((name) =>
      registeredNameSet.has(name.toLowerCase())
    ).length;
  }, [registeredNameSet]);

  // Next recommended standard grade to register
  const nextAvailableGrade = useMemo(() => {
    return (
      STANDARD_SALARY_GRADES.find(
        (name) => !registeredNameSet.has(name.toLowerCase())
      ) ?? null
    );
  }, [registeredNameSet]);

  // Filtered & searched grades
  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      if (!g) return false;
      const gName = (g.name || "").trim();
      const term = (searchTerm || "").trim().toLowerCase();
      const matchesSearch =
        !term ||
        gName.toLowerCase().includes(term) ||
        String(g.id || "").includes(term);

      if (!matchesSearch) return false;

      const isStandard = STANDARD_SALARY_GRADES.some(
        (sg) => sg.toLowerCase() === gName.toLowerCase()
      );

      if (filterType === "standard") return isStandard;
      if (filterType === "custom") return !isStandard;
      return true;
    });
  }, [grades, searchTerm, filterType]);

  // Paginated list
  const totalPages = Math.ceil(filteredGrades.length / rowsPerPage) || 1;
  const paginatedGrades = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredGrades.slice(start, start + rowsPerPage);
  }, [filteredGrades, currentPage, rowsPerPage]);

  const handleOpenRegisterModal = (prefillName?: string) => {
    setEditingGrade(null);
    const target = prefillName || nextAvailableGrade || STANDARD_SALARY_GRADES[0];

    if (STANDARD_SALARY_GRADES.includes(target)) {
      setSelectedDropdownValue(target);
      setIsCustomMode(false);
      setCustomNameInput("");
    } else {
      setSelectedDropdownValue("__custom__");
      setIsCustomMode(true);
      setCustomNameInput(target || "");
    }
    setModalOpen(true);
  };

  const handleOpenEditModal = (grade: SalaryGrade) => {
    setEditingGrade(grade);
    const gradeName = (grade?.name || "").trim();
    const isStd = STANDARD_SALARY_GRADES.includes(gradeName);
    if (isStd) {
      setSelectedDropdownValue(gradeName);
      setIsCustomMode(false);
      setCustomNameInput("");
    } else {
      setSelectedDropdownValue("__custom__");
      setIsCustomMode(true);
      setCustomNameInput(gradeName);
    }
    setModalOpen(true);
  };

  const currentGradeName = (
    isCustomMode ? customNameInput : selectedDropdownValue
  )?.trim() || "";

  const isDuplicate = useMemo(() => {
    if (!currentGradeName) return false;
    const lower = currentGradeName.toLowerCase();
    if (editingGrade && (editingGrade.name || "").trim().toLowerCase() === lower) {
      return false; // Not a duplicate if unchanged in edit mode
    }
    return registeredNameSet.has(lower);
  }, [currentGradeName, editingGrade, registeredNameSet]);

  const handleDropdownChange = (val: string) => {
    if (val === "__custom__") {
      setIsCustomMode(true);
      setSelectedDropdownValue("__custom__");
    } else {
      setIsCustomMode(false);
      setSelectedDropdownValue(val);
      setCustomNameInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGradeName) {
      toast.error("Please select or enter a salary grade name.");
      return;
    }
    if (isDuplicate) {
      toast.error(`"${currentGradeName}" is already registered.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: SalaryGradePayload = {
        name: currentGradeName,
      };

      if (editingGrade) {
        await wageApi.patchSalaryGrade(editingGrade.id, payload);
        toast.success(`Salary grade updated to "${currentGradeName}".`);
      } else {
        await wageApi.createSalaryGrade(payload);
        toast.success(`"${currentGradeName}" successfully registered.`);
      }

      setModalOpen(false);
      await loadGrades();
    } catch (err: any) {
      console.error("[SalaryGradeRegistration] Submit error:", err);
      toast.error(err?.message || "Failed to save salary grade.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await wageApi.deleteSalaryGrade(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" has been deleted.`);
      setDeleteTarget(null);
      await loadGrades();
    } catch (err: any) {
      console.error("[SalaryGradeRegistration] Delete error:", err);
      toast.error(err?.message || "Failed to delete salary grade.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Context */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Total Registered */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                {grades.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Total Registered Grades
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Standard 1-33 Coverage */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                {standardRegisteredCount} <span className="text-xs font-normal text-slate-400">/ 33</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Standard SG Registered
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Next Available Grade */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {nextAvailableGrade || "All 33 Registered"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Next Suggested Grade
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Action Button */}
        <div className="flex items-center">
          <Button
            onClick={() => handleOpenRegisterModal()}
            className="w-full h-full min-h-[72px] bg-persian-blue-600 hover:bg-persian-blue-700 text-white font-medium gap-2 shadow-sm rounded-xl transition-all"
          >
            <Plus className="h-5 w-5" />
            <span>Register Salary Grade</span>
          </Button>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardContent className="p-5 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search salary grade..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9"
                />
              </div>

              {/* Filter */}
              <Select
                value={filterType}
                onValueChange={(val: any) => {
                  setFilterType(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-36">
                  <SelectValue placeholder="Filter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  <SelectItem value="standard">Standard (1-33)</SelectItem>
                  <SelectItem value="custom">Custom Names</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={loadGrades}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          <Separator />

          {/* Table */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/60">
                <TableRow>
                  <TableHead className="w-16">
                    <span className="flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" /> ID
                    </span>
                  </TableHead>
                  <TableHead>Salary Grade Name</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Registered Date
                    </span>
                  </TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
                        <span className="text-xs">Loading salary grades...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedGrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <GraduationCap className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <div className="text-sm font-medium">No salary grades registered</div>
                        <div className="text-xs text-slate-400 max-w-sm">
                          {searchTerm
                            ? `No grades matched "${searchTerm}".`
                            : "Click 'Register Salary Grade' to register standard grades."}
                        </div>
                        {!searchTerm && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenRegisterModal()}
                            className="mt-2 h-8 text-xs bg-persian-blue-600 hover:bg-persian-blue-700 text-white"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Register Grade
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedGrades.map((grade) => {
                    const gradeName = (grade.name || "").trim();
                    const isStandard = STANDARD_SALARY_GRADES.some(
                      (sg) => sg.toLowerCase() === gradeName.toLowerCase()
                    );

                    return (
                      <TableRow key={grade.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <TableCell className="font-mono text-xs text-slate-500">
                          #{grade.id}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{grade.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isStandard ? (
                            <Badge
                              variant="secondary"
                              className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 text-[11px]"
                            >
                              Standard Grade
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-slate-600 dark:text-slate-400 text-[11px]"
                            >
                              Custom
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                          {safeFormatDate(grade.created_at)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {safeFormatDate(grade.updated_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                              onClick={() => handleOpenEditModal(grade)}
                              title="Edit grade name"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-600"
                              onClick={() => setDeleteTarget(grade)}
                              title="Delete grade"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

          {/* Pagination */}
          {filteredGrades.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
              <div>
                Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                {Math.min(currentPage * rowsPerPage, filteredGrades.length)} of{" "}
                {filteredGrades.length} registered grades
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2"
                >
                  Previous
                </Button>
                <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
                  {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration & Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-persian-blue-600" />
              {editingGrade ? "Edit Salary Grade" : "Register Salary Grade"}
            </DialogTitle>
            <DialogDescription>
              {editingGrade
                ? "Update the salary grade name in the system registry."
                : "Select a salary grade from the standardized dropdown list or specify a custom name."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Dropdown Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Salary Grade Name Dropdown
              </Label>
              <Select
                value={selectedDropdownValue}
                onValueChange={handleDropdownChange}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select salary grade name..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Standard Philippine Salary Grades (1 to 33)
                  </div>
                  {STANDARD_SALARY_GRADES.map((sgName) => {
                    const isRegistered = registeredNameSet.has(sgName.toLowerCase());
                    const isCurrent =
                      editingGrade &&
                      editingGrade.name.toLowerCase() === sgName.toLowerCase();

                    return (
                      <SelectItem
                        key={sgName}
                        value={sgName}
                        disabled={isRegistered && !isCurrent}
                      >
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{sgName}</span>
                          {isRegistered && !isCurrent && (
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                              (Already Registered)
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] text-emerald-600 font-semibold">
                              (Current)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                  <Separator className="my-1" />
                  <SelectItem value="__custom__" className="text-persian-blue-600 font-medium">
                    + Custom Grade Name...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Name Input if Selected */}
            {isCustomMode && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Custom Salary Grade Name
                </Label>
                <Input
                  placeholder="e.g. Salary Grade 1-A or Executive Grade"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  maxLength={50}
                  className="h-10"
                  autoFocus
                />
              </div>
            )}

            {/* Validation / Duplicate Warning */}
            {isDuplicate && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong>Already Registered:</strong> A salary grade with the name{" "}
                  <span className="font-semibold underline">"{currentGradeName}"</span> already exists in the system.
                </div>
              </div>
            )}

            {/* Preview Chip */}
            {currentGradeName && !isDuplicate && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Selected to Register:</span>
                <Badge className="bg-persian-blue-100 text-persian-blue-800 dark:bg-persian-blue-900 dark:text-persian-blue-200 border-0 font-medium">
                  {currentGradeName}
                </Badge>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!currentGradeName || isDuplicate || isSubmitting}
                className="bg-persian-blue-600 hover:bg-persian-blue-700 text-white font-medium"
              >
                {isSubmitting
                  ? "Saving..."
                  : editingGrade
                  ? "Update Salary Grade"
                  : "Register Salary Grade"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog (No browser dialogs policy) */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Delete Salary Grade?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                "{deleteTarget?.name}"
              </strong>
              ? This grade will no longer be available in registry. Existing schedules using this grade may be impacted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Grade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
