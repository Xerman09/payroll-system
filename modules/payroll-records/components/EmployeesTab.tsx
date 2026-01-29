"use client";

import * as React from "react";
import type { Department, Employee } from "../types";

import { toast } from "sonner";
import jsPDF from "jspdf";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Separator } from "@/components/ui/separator";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";

import { Loader2, Eye, FileDown } from "lucide-react";
import SortableTableHead from "./SortableTableHead";

/**
 * BFF base route (App Router):
 * app/dashboard/api/payroll-records/route.ts  -> /dashboard/api/payroll-records
 */
const API_BASE = "/dashboard/api/payroll-records";

/** ---- Types coming from payrollrunitem / payrollrunemployee_item (via BFF) ---- */
type PayslipCutoffOption = {
  cutoff_start: string; // YYYY-MM-DD
  cutoff_end: string; // YYYY-MM-DD
  payroll_run_id?: number | string | null;
  payout_date?: string | null;
};

type PayrollRunEmployeeItemRow = {
  item_key?: string | null;
  category?: string | null;
  code?: string | null;
  description?: string | null;
  item_type?: "EARNING" | "DEDUCTION" | string | null;
  amount?: number | string | null;
};

/** ---- Helpers ---- */
function toNumberSafe(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatAmountOnly(v: any): string {
  const n = Math.abs(toNumberSafe(v));
  try {
    return n.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

function peso(v: any): string {
  // ✅ single peso sign + abs (no +/-)
  return `₱ ${formatAmountOnly(v)}`;
}

function cutoffLabel(c: { cutoff_start: string; cutoff_end: string }) {
  return `${c.cutoff_start} → ${c.cutoff_end}`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const detail =
      json?.error ||
      json?.body?.error ||
      (typeof text === "string" ? text.slice(0, 300) : "No body");
    throw new Error(`API ${res.status} ${res.statusText}: ${detail}`);
  }

  return json as T;
}

/** ---- Minimal payslip PDF builder (client-side) ----
 * Uses payroll_run_employee_item rows.
 * You can later swap this with your existing payslipPdf.ts if you want identical layout.
 */
function buildPayslipPdf(args: {
  companyName: string;
  employeeName: string;
  employeeId: number;
  departmentName: string;
  cutoffStart: string;
  cutoffEnd: string;
  items: PayrollRunEmployeeItemRow[];
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 36;
  const headerH = 72;

  // Theme (subtle accent)
  const ACCENT = { r: 16, g: 54, b: 98 };
  const GRID = { r: 214, g: 223, b: 235 };
  const MUTED = { r: 90, g: 98, b: 112 };

  // Header band
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(0, 0, pageW, headerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(args.companyName, pageW / 2, 28, { align: "center" });

  doc.setFontSize(11);
  doc.text("PAYSLIP", pageW / 2, 50, { align: "center" });

  // Meta
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  let y = headerH + 18;

  doc.text(`Employee: ${args.employeeName}`, margin, y);
  doc.text(`ID: ${args.employeeId}`, pageW - margin, y, { align: "right" });
  y += 14;

  doc.text(`Department: ${args.departmentName}`, margin, y);
  doc.text(
    `Cutoff: ${args.cutoffStart} to ${args.cutoffEnd}`,
    pageW - margin,
    y,
    {
      align: "right",
    },
  );
  y += 14;

  doc.setDrawColor(GRID.r, GRID.g, GRID.b);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  // Split items
  const earnings = args.items.filter(
    (i) => (i.item_type ?? "").toUpperCase() === "EARNING",
  );
  const deds = args.items.filter(
    (i) => (i.item_type ?? "").toUpperCase() === "DEDUCTION",
  );

  const sumAmt = (rows: PayrollRunEmployeeItemRow[]) =>
    rows.reduce((a, r) => a + Math.abs(toNumberSafe(r.amount)), 0);

  const totalE = sumAmt(earnings);
  const totalD = sumAmt(deds);
  const net = totalE - totalD;

  // Two columns layout
  const colGap = 18;
  const colW = (pageW - margin * 2 - colGap) / 2;
  const leftX = margin;
  const rightX = margin + colW + colGap;

  const boxTitleH = 18;
  const rowH = 14;
  const maxRowsVisible = 22; // keep it neat; add page if needed later

  const drawBox = (
    title: string,
    x: number,
    yTop: number,
    rows: PayrollRunEmployeeItemRow[],
    total: number,
  ) => {
    // box header
    doc.setFillColor(236, 242, 252);
    doc.setDrawColor(GRID.r, GRID.g, GRID.b);
    doc.rect(x, yTop, colW, boxTitleH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text(title, x + 8, yTop + 12);

    // rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5); // ✅ slightly smaller amount font
    doc.setTextColor(0, 0, 0);

    let yRow = yTop + boxTitleH + 10;

    const visible = rows.slice(0, maxRowsVisible);
    for (const r of visible) {
      const label =
        (r.code && String(r.code).trim()) ||
        (r.item_key && String(r.item_key).trim()) ||
        (r.description && String(r.description).trim()) ||
        "Item";

      // label (truncate)
      const maxLabelW = colW - 90;
      let txt = label;
      while (txt.length > 0 && doc.getTextWidth(txt) > maxLabelW) {
        txt = txt.slice(0, -1);
      }
      if (txt !== label) txt = txt.trimEnd() + "…";

      doc.text(txt, x + 8, yRow);

      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      doc.text(peso(r.amount), x + colW - 8, yRow, { align: "right" });
      doc.setTextColor(0, 0, 0);

      yRow += rowH;
    }

    // total footer
    const yTotal = yTop + boxTitleH + 10 + visible.length * rowH + 6;
    doc.setDrawColor(GRID.r, GRID.g, GRID.b);
    doc.line(x, yTotal, x + colW, yTotal);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("TOTAL", x + 8, yTotal + 12);

    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text(peso(total), x + colW - 8, yTotal + 12, { align: "right" });

    return yTotal + 24;
  };

  const boxTop = y;
  const endLeft = drawBox("EARNINGS", leftX, boxTop, earnings, totalE);
  const endRight = drawBox("DEDUCTIONS", rightX, boxTop, deds, totalD);

  const afterBoxesY = Math.max(endLeft, endRight);

  // Net pay band
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(margin, afterBoxesY, pageW - margin * 2, 26, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("NET PAY", margin + 10, afterBoxesY + 17);

  doc.text(peso(net), pageW - margin - 10, afterBoxesY + 17, {
    align: "right",
  });

  // footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text("Generated by Payroll System", margin, pageH - 18);

  return doc;
}

/** ---- Payslip Modal ---- */
function PayslipModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee | null;
  departments: Department[];
}) {
  const { open, onOpenChange, employee, departments } = props;

  const [loadingCutoffs, setLoadingCutoffs] = React.useState(false);
  const [cutoffs, setCutoffs] = React.useState<PayslipCutoffOption[]>([]);
  const [selectedCutoff, setSelectedCutoff] = React.useState<string>("");

  const [generating, setGenerating] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [filename, setFilename] = React.useState<string>("");

  const departmentName = React.useMemo(() => {
    if (!employee?.user_department) return "N/A";
    return (
      departments.find((d) => d.department_id === employee.user_department)
        ?.department_name ?? "N/A"
    );
  }, [employee?.user_department, departments]);

  // cleanup blob url
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // reset when closing / switching employee
  React.useEffect(() => {
    if (!open) {
      setCutoffs([]);
      setSelectedCutoff("");
      setLoadingCutoffs(false);
      setGenerating(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setFilename("");
      return;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load cutoffs for selected employee
  React.useEffect(() => {
    const run = async () => {
      if (!open || !employee?.user_id) return;

      try {
        setLoadingCutoffs(true);

        // ✅ Backend should query payrollrunemployee_item (and/or payrollrunitem)
        // and return distinct cutoff_start/cutoff_end rows for this user_id.
        const res = await getJson<{ data: PayslipCutoffOption[] }>(
          `${API_BASE}?type=payslip-cutoffs&user_id=${employee.user_id}`,
        );

        const list = Array.isArray(res?.data) ? res.data : [];
        setCutoffs(list);

        // default select latest
        if (list.length) {
          setSelectedCutoff(`${list[0].cutoff_start}|${list[0].cutoff_end}`);
        } else {
          setSelectedCutoff("");
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Failed to load payslip cutoffs.");
        setCutoffs([]);
        setSelectedCutoff("");
      } finally {
        setLoadingCutoffs(false);
      }
    };

    run();
  }, [open, employee?.user_id]);

  const selected = React.useMemo(() => {
    const [start, end] = selectedCutoff.split("|");
    if (!start || !end) return null;
    return { start, end };
  }, [selectedCutoff]);

  const buildSafeFilename = React.useCallback(() => {
    const empId = employee?.user_id ?? "emp";
    const start = selected?.start ?? "start";
    const end = selected?.end ?? "end";
    return `payslip_${empId}_${start}_${end}.pdf`;
  }, [employee?.user_id, selected?.start, selected?.end]);

  const generatePreview = async () => {
    if (!employee?.user_id) return toast.error("Employee is missing.");
    if (!selected?.start || !selected?.end)
      return toast.error("Please select a cutoff.");

    try {
      setGenerating(true);

      // ✅ Backend should query payrollrunemployee_item for this user_id + cutoff range
      const itemsRes = await getJson<{ data: PayrollRunEmployeeItemRow[] }>(
        `${API_BASE}?type=payslip-items&user_id=${employee.user_id}&cutoff_start=${selected.start}&cutoff_end=${selected.end}`,
      );

      const items = Array.isArray(itemsRes?.data) ? itemsRes.data : [];
      if (!items.length) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setFilename("");
        return toast.error("No payslip items found for the selected cutoff.");
      }

      const fullName =
        `${employee.user_fname} ${employee.user_mname ?? ""} ${employee.user_lname}`
          .replace(/\s+/g, " ")
          .trim();

      const doc = buildPayslipPdf({
        companyName: "MEN2 MARKETING CORPORATION",
        employeeName: fullName,
        employeeId: employee.user_id,
        departmentName,
        cutoffStart: selected.start,
        cutoffEnd: selected.end,
        items,
      });

      // preview (no forced download)
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);

      setFilename(buildSafeFilename());
      setPreviewUrl(url);

      toast.success("Payslip ready for preview.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to generate payslip preview.");
    } finally {
      setGenerating(false);
    }
  };

  if (!employee) return null;

  const fullName =
    `${employee.user_fname} ${employee.user_mname ?? ""} ${employee.user_lname}`
      .replace(/\s+/g, " ")
      .trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <DialogTitle className="text-base">Payslip Preview</DialogTitle>
              <DialogDescription className="mt-1">
                {fullName} • ID {employee.user_id} • {departmentName}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generatePreview}
                disabled={loadingCutoffs || generating || !selectedCutoff}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={!previewUrl}
                asChild
              >
                <a href={previewUrl ?? "#"} download={filename || undefined}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>Select Cutoff Date</Label>
              <Select
                value={selectedCutoff}
                onValueChange={(v) => {
                  setSelectedCutoff(v);
                  // invalidate old preview when cutoff changes
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setFilename("");
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingCutoffs ? "Loading cutoffs..." : "Select cutoff..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {cutoffs.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No cutoffs found
                    </SelectItem>
                  ) : (
                    cutoffs.map((c) => (
                      <SelectItem
                        key={`${c.cutoff_start}|${c.cutoff_end}`}
                        value={`${c.cutoff_start}|${c.cutoff_end}`}
                      >
                        {cutoffLabel(c)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Selected</Label>
              <div className="h-10 px-3 flex items-center rounded-md border bg-muted/20 text-sm">
                {selected ? `${selected.start} → ${selected.end}` : "—"}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Preview */}
        <div className="h-[78vh] bg-muted/10">
          {previewUrl ? (
            <iframe
              title="Payslip PDF Preview"
              src={previewUrl}
              className="w-full h-full"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
              Select a cutoff, then click{" "}
              <span className="mx-1 font-medium text-foreground">Preview</span>{" "}
              to generate the payslip.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeesTab({
  employees,
  departments,
}: {
  employees: Employee[];
  departments: Department[];
}) {
  const [filterDept, setFilterDept] = React.useState<number | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{
    key: "id" | "fname" | "lname" | "department";
    direction: "asc" | "desc";
  }>({ key: "id", direction: "asc" });

  const handleSort = (key: "id" | "fname" | "lname" | "department") => {
    setSortConfig((prev) =>
      prev.key === key && prev.direction === "asc"
        ? { key, direction: "desc" }
        : { key, direction: "asc" },
    );
  };

  // pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  // payslip modal state
  const [payslipOpen, setPayslipOpen] = React.useState(false);
  const [selectedEmployee, setSelectedEmployee] =
    React.useState<Employee | null>(null);

  const filteredEmployees = React.useMemo(() => {
    return employees
      .filter((emp) => {
        const fullName =
          `${emp.user_fname} ${emp.user_mname ?? ""} ${emp.user_lname}`.toLowerCase();

        const matchesDept = filterDept
          ? emp.user_department === filterDept
          : true;

        const matchesSearch =
          emp.user_id.toString().includes(searchTerm.toLowerCase()) ||
          fullName.includes(searchTerm.toLowerCase());

        return matchesDept && matchesSearch;
      })
      .sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortConfig.key) {
          case "id":
            aVal = a.user_id;
            bVal = b.user_id;
            break;
          case "fname":
            aVal = a.user_fname;
            bVal = b.user_fname;
            break;
          case "lname":
            aVal = a.user_lname;
            bVal = b.user_lname;
            break;
          case "department":
            aVal =
              departments.find((d) => d.department_id === a.user_department)
                ?.department_name ?? "";
            bVal =
              departments.find((d) => d.department_id === b.user_department)
                ?.department_name ?? "";
            break;
        }
        if (typeof aVal === "string") {
          const cmp = aVal.localeCompare(bVal);
          return sortConfig.direction === "asc" ? cmp : -cmp;
        }
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
  }, [employees, departments, filterDept, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  const getPageButtons = () => {
    const buttons: (number | string)[] = [];
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    if (start > 1) {
      buttons.push(1);
      if (start > 2) buttons.push("...");
    }
    for (let i = start; i <= end; i++) buttons.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push("...");
      buttons.push(totalPages);
    }
    return buttons;
  };

  return (
    <div className="space-y-6">
      <CardHeader className="px-0">
        <CardTitle>Employee List</CardTitle>
      </CardHeader>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Department</Label>
          <Select
            value={filterDept ? String(filterDept) : ""}
            onValueChange={(v) => {
              setFilterDept(v ? Number(v) : null);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem
                  key={dept.department_id}
                  value={String(dept.department_id)}
                >
                  {dept.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Search employee</Label>
          <Input
            placeholder="Type name or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Sort by</Label>
          <Select
            value={sortConfig.key}
            onValueChange={(value: any) =>
              setSortConfig({ key: value, direction: "asc" })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="id">ID</SelectItem>
              <SelectItem value="fname">First Name</SelectItem>
              <SelectItem value="lname">Last Name</SelectItem>
              <SelectItem value="department">Department</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                label="Employee ID"
                sortKey="id"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                label="Name"
                sortKey="fname"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHead
                label="Department"
                sortKey="department"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <TableHead className="w-[180px]">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedEmployees.map((emp) => {
              const deptName =
                departments.find((d) => d.department_id === emp.user_department)
                  ?.department_name ?? "N/A";

              const fullName =
                `${emp.user_fname} ${emp.user_mname ?? ""} ${emp.user_lname}`
                  .replace(/\s+/g, " ")
                  .trim();

              return (
                <TableRow key={emp.user_id} className="border-b">
                  <TableCell>{emp.user_id}</TableCell>
                  <TableCell className="font-medium">{fullName}</TableCell>
                  <TableCell>{deptName}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setPayslipOpen(true);
                      }}
                    >
                      View Payslip
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {paginatedEmployees.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  No employees found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm">
          Rows per page:{" "}
          <select
            className="border px-2 py-1 rounded bg-white dark:bg-gray-800"
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
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
            onClick={() => setCurrentPage((p) => p - 1)}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Prev
          </Button>

          {getPageButtons().map((page, idx) =>
            page === "..." ? (
              <span key={idx} className="px-2 py-1 text-sm">
                ...
              </span>
            ) : (
              <Button
                key={idx}
                size="sm"
                variant={currentPage === page ? "default" : "outline"}
                onClick={() => setCurrentPage(Number(page))}
                className={
                  currentPage === page
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "border-blue-600 text-blue-600 hover:bg-blue-50"
                }
              >
                {page}
              </Button>
            ),
          )}

          <Button
            size="sm"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Payslip Modal */}
      <PayslipModal
        open={payslipOpen}
        onOpenChange={(v) => {
          setPayslipOpen(v);
          if (!v) setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        departments={departments}
      />
    </div>
  );
}
