"use client";

import * as React from "react";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Loader2, 
  Eye, 
  FileDown, 
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown
} from "lucide-react";
import { formatPHP } from "../../payroll-run/utils/compute";
import { buildPayslipsPdf } from "../../payroll-run/utils/payslipPdf";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PayslipHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    user_id: number;
    user_fname: string;
    user_mname: string | null;
    user_lname: string;
  } | null;
};

export default function PayslipHistoryModal({
  isOpen,
  onClose,
  employee,
}: PayslipHistoryModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [records, setRecords] = React.useState<any[]>([]);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);

  React.useEffect(() => {
    if (isOpen && employee?.user_id) {
      setSearchTerm("");
      fetchHistory();
    } else {
      setRecords([]);
    }
  }, [isOpen, employee]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchHistory = async () => {
    if (!employee?.user_id) return;
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("resource", "payroll_run_employee");
      sp.set("fields", "*,payroll_run_id.payroll_ref_no,payroll_run_id.posted_at");
      sp.set("filter[user_id][_eq]", String(employee.user_id));
      sp.set("sort", "-cutoff_end");
      sp.set("limit", "1000");
      
      const res = await fetch(`/api/payroll-run?${sp.toString()}`);
      const json = await res.json();
      
      if (!res.ok) throw new Error(json?.error || "Failed to fetch history");
      
      setRecords(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = React.useMemo(() => {
    if (!searchTerm.trim()) return records;
    const s = searchTerm.toLowerCase();
    return records.filter((r) => {
      const label = String(r.cutoff_label || "").toLowerCase();
      const start = String(r.cutoff_start || "").toLowerCase();
      const end = String(r.cutoff_end || "").toLowerCase();
      const ref = String(r.payroll_run_id?.payroll_ref_no || r.payroll_ref_no || "").toLowerCase();
      return label.includes(s) || start.includes(s) || end.includes(s) || ref.includes(s);
    });
  }, [records, searchTerm]);

  const handlePreview = async (record: any) => {
    setIsGenerating(true);
    try {
      const payrollRefNo = record.payroll_run_id?.payroll_ref_no || record.payroll_ref_no;
      const postedAt = record.payroll_run_id?.posted_at || record.posted_at;
      const payrollPeriodLabel = record.cutoff_label || `${record.cutoff_start} to ${record.cutoff_end}`;
      
      const doc = await buildPayslipsPdf({
        rows: [record],
        payrollPeriodLabel,
        pageSize: "LEGAL",
        payrollRefNo,
        postedAt,
      });

      const blob = doc.output("blob");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate preview");
    } finally {
      setIsGenerating(false);
    }
  };

  const columns = React.useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: "cutoff_period",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 font-bold uppercase text-xs">
          Cutoff Period
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="font-medium text-base text-foreground">
            {r.cutoff_label || (
              <span className="text-sm text-muted-foreground">
                {r.cutoff_start} to {r.cutoff_end}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "cutoff_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("cutoff_type") as string;
        return (
          <span className={cn(
            "px-2.5 py-1 rounded-full text-xs font-semibold border",
            type === "FIRST" 
              ? "bg-slate-100/50 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800"
              : "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800"
          )}>
            {type === "FIRST" ? "First Period" : "Second Period"}
          </span>
        );
      },
    },
    {
      accessorKey: "net_pay",
      header: ({ column }) => (
        <div className="text-right">
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 font-bold uppercase text-xs ml-auto">
            Net Pay
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const amount = Number(row.getValue("net_pay") || 0);
        return (
          <div className="text-right font-mono text-lg text-blue-600 dark:text-blue-400 font-bold">
            {formatPHP(amount)}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-center font-bold uppercase text-xs">Action</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <Button
            variant="outline"
            className="gap-2 h-9 px-4 text-sm font-semibold shadow-sm rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
            onClick={() => handlePreview(row.original)}
            disabled={isGenerating}
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        </div>
      ),
    },
  ], [isGenerating]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 7,
      },
    },
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[75vw] sm:max-w-none h-[80vh] flex flex-col p-0 overflow-hidden bg-background border-none shadow-2xl">
          {/* Premium Header with Gradient */}
          <div className="relative p-8 pb-6 bg-gradient-to-br from-indigo-50/50 via-background to-background dark:from-indigo-950/20 dark:via-background dark:to-background border-b shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                  <div className="p-2 rounded-lg bg-indigo-500/10">
                    <History className="h-6 w-6" />
                  </div>
                  Payslip History
                </DialogTitle>
                <p className="text-muted-foreground ml-11 text-sm font-medium">
                  Viewing electronic payslips for <span className="text-foreground">{employee?.user_fname} {employee?.user_lname}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    placeholder="Search by period, date, or reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 bg-background/50 border-muted-foreground/10 focus-visible:ring-indigo-500 rounded-lg shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table Content with Animations */}
          <div className="flex-1 overflow-auto p-8 pt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl bg-indigo-500/20 animate-pulse" />
                  <Loader2 className="h-10 w-10 animate-spin text-indigo-500 relative" />
                </div>
                <p className="font-medium animate-pulse">Retriving payroll summary...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5 transition-all group hover:bg-muted/10">
                <div className="p-4 rounded-full bg-muted group-hover:scale-110 transition-transform mb-4">
                  <Eye className="h-8 w-8 opacity-20" />
                </div>
                <p className="font-medium">{searchTerm ? "No results found matching your search." : "No payslip history recorded."}</p>
                {searchTerm && (
                  <Button 
                    variant="link" 
                    className="mt-1 text-indigo-500"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear search query
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col h-full">
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} className="px-6 h-12">
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {table.getRowModel().rows.map((row, index) => (
                          <motion.tr
                            key={row.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="group hover:bg-muted/30 h-14 border-b last:border-0"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id} className="px-6">
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {/* Advanced Pagination UI */}
                <div className="flex items-center justify-between px-6 py-4 bg-muted/10 border-t">
                  <div className="text-sm text-muted-foreground font-medium">
                    Showing <span className="text-foreground">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="text-foreground">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredData.length)}</span> of <span className="text-foreground font-bold">{filteredData.length}</span> payslips
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Rows per page</p>
                      <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                      >
                        <SelectTrigger className="h-8 w-[70px] bg-background">
                          <SelectValue placeholder={table.getState().pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[5, 10, 20, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex h-8 w-10 items-center justify-center text-sm font-bold bg-background rounded-lg border shadow-sm">
                        {table.getState().pagination.pageIndex + 1}
                      </div>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>

      <Dialog 
        open={previewOpen} 
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open && previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="w-full max-w-[95vw] sm:max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="pl-8 pr-12 py-6 border-b bg-background">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold">Payslip Preview</DialogTitle>
                <div className="text-sm text-muted-foreground font-medium">
                  Reviewing electronic statement for the selected period.
                </div>
              </div>
              <div className="flex items-center gap-3">
                {previewUrl && (
                  <Button variant="default" size="default" asChild className="rounded-lg shadow-lg bg-indigo-600 hover:bg-indigo-700">
                    <a href={previewUrl} download={`Payslip-${employee?.user_fname}-${employee?.user_lname}.pdf`}>
                      <FileDown className="mr-2 h-4 w-4" />
                      Download PDF
                    </a>
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setPreviewOpen(false)} className="rounded-lg">
                  Close Preview
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-muted/40 w-full h-full relative p-4">
            <div className="w-full h-full rounded-xl overflow-hidden border shadow-inner bg-background">
              {previewUrl ? (
                <iframe
                  title="Payslip PDF Preview"
                  src={`${previewUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                  Generating document preview...
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
