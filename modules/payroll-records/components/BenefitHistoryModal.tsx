"use client";

import * as React from "react";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle,
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
  History, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Eye,
} from "lucide-react";
import { formatPHP } from "../../payroll-run/utils/compute";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { buildBenefitHistoryPdf } from "../utils/benefitHistoryPdf";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";

type BenefitHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    user_id: number;
    user_fname: string;
    user_mname: string | null;
    user_lname: string;
  } | null;
};

type BenefitRecord = {
  month: string;
  amount: number;
  type: string;
  payrollId: string;
  postedDate: string;
  isLoan: boolean;
};

export default function BenefitHistoryModal({
  isOpen,
  onClose,
  employee,
}: BenefitHistoryModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [records, setRecords] = React.useState<BenefitRecord[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedMonth, setSelectedMonth] = React.useState<string>("all");
  const [reportType, setReportType] = React.useState<"contributions" | "loans">("contributions");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [pdfBlob, setPdfBlob] = React.useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [companyName, setCompanyName] = React.useState<string>("");

  const fetchHistory = React.useCallback(async () => {
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
      
      const rawData = Array.isArray(json?.data) ? json.data : [];
      
      const unpivoted: BenefitRecord[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawData.forEach((row: any) => {
        const monthYear = new Date(row.cutoff_end).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const payrollId = row.payroll_run_id?.payroll_ref_no || "N/A";
        const postedDate = row.payroll_run_id?.posted_at ? new Date(row.payroll_run_id.posted_at).toLocaleDateString() : "N/A";

        const benefitFields = [
          { key: 'benefit_sss', label: 'SSS Contribution', isLoan: false },
          { key: 'benefit_philhealth', label: 'PhilHealth Contribution', isLoan: false },
          { key: 'benefit_pagibig', label: 'Pag-IBIG Contribution', isLoan: false },
          { key: 'benefit_loan_sss', label: 'SSS Loan', isLoan: true },
          { key: 'benefit_loan_pagibig', label: 'Pag-IBIG Loan', isLoan: true },
        ];

        benefitFields.forEach(field => {
          const val = Number(row[field.key] || 0);
          if (val > 0) {
            unpivoted.push({
              month: monthYear,
              amount: val,
              type: field.label,
              payrollId: payrollId,
              postedDate: postedDate,
              isLoan: field.isLoan
            });
          }
        });
      });

      if (json.meta?.companyName) {
        setCompanyName(json.meta.companyName);
      }
      setRecords(unpivoted);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [employee]);

  React.useEffect(() => {
    if (isOpen && employee?.user_id) {
      setSearchTerm("");
      setSelectedMonth("all");
      setReportType("contributions");
      fetchHistory();
    } else {
      setRecords([]);
    }
  }, [isOpen, employee, fetchHistory]);

  const uniqueMonths = React.useMemo(() => {
    const months = Array.from(new Set(records.map(r => r.month)));
    return months.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [records]);

  const filteredData = React.useMemo(() => {
    return records.filter((r) => {
      const matchesSearch = 
        r.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.payrollId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMonth = selectedMonth === "all" || r.month === selectedMonth;
      const matchesType = (reportType === "loans" && r.isLoan) || (reportType === "contributions" && !r.isLoan);
      return matchesSearch && matchesMonth && matchesType;
    });
  }, [records, searchTerm, selectedMonth, reportType]);

  const columns = React.useMemo<ColumnDef<BenefitRecord>[]>(() => [
    {
      accessorKey: "month",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 font-bold uppercase text-xs">
          Month
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-medium text-base text-foreground">{row.getValue("month")}</div>,
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <div className="text-right">
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-transparent p-0 font-bold uppercase text-xs ml-auto">
            Amount
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        return (
          <div className="text-right font-mono text-lg text-primary dark:text-primary/70 font-bold">
            {formatPHP(amount)}
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        const isLoan = row.original.isLoan;
        return (
          <span className={cn(
            "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
            isLoan 
              ? "bg-amber-100/50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" 
              : "bg-primary/5 text-primary border-primary/10 dark:bg-primary/15 dark:text-primary/70 dark:border-primary/30"
          )}>
            {type}
          </span>
        );
      },
    },
    {
      accessorKey: "payrollId",
      header: "Payroll ID",
      cell: ({ row }) => <div className="text-muted-foreground text-sm font-mono">{row.getValue("payrollId")}</div>,
    },
    {
      accessorKey: "postedDate",
      header: "Posted Date",
      cell: ({ row }) => <div className="text-muted-foreground text-sm">{row.getValue("postedDate")}</div>,
    },
  ], []);

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

  const handlePDFAction = async (download = false) => {
    if (selectedMonth === "all") {
      toast.error("Please select a specific month to generate the report.");
      return;
    }
    
    if (filteredData.length === 0) {
      toast.error("No data found for the selected filters.");
      return;
    }

    setIsGenerating(true);
    try {
      const firstRecord = filteredData[0];
      const doc = await buildBenefitHistoryPdf({
        companyName: companyName || "",
        reportType: reportType,
        employee: {
          id: employee?.user_id || "N/A",
          name: `${employee?.user_fname} ${employee?.user_lname}`,
        },
        payrollId: firstRecord.payrollId,
        monthAndYear: selectedMonth,
        postedDate: firstRecord.postedDate,
        records: filteredData.map((r, i) => ({
          index: i + 1,
          name: r.type,
          amount: r.amount
        }))
      });

      if (download) {
        doc.save(`Benefit_${reportType}_${selectedMonth}_${employee?.user_lname}.pdf`);
      } else {
        const blob = doc.output("blob");
        setPdfBlob(blob);
        setPreviewOpen(true);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[75vw] sm:max-w-none h-[80vh] flex flex-col p-0 overflow-hidden bg-background border-none shadow-2xl">
          {/* Premium Header with Gradient */}
          <div className="relative p-8 pb-6 bg-gradient-to-br from-blue-50/50 via-background to-background dark:from-blue-950/20 dark:via-background dark:to-background border-b shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <History className="h-6 w-6" />
                  </div>
                  Benefit History
                </DialogTitle>
                <p className="text-muted-foreground ml-11 text-sm font-medium">
                  Viewing records for <span className="text-foreground">{employee?.user_fname} {employee?.user_lname}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                  <Button 
                    variant={reportType === "contributions" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 rounded-md text-xs font-bold"
                    onClick={() => setReportType("contributions")}
                  >
                    Contributions
                  </Button>
                  <Button 
                    variant={reportType === "loans" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 rounded-md text-xs font-bold"
                    onClick={() => setReportType("loans")}
                  >
                    Loans
                  </Button>
                </div>

                <div className="h-8 w-px bg-border mx-1" />

                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    placeholder="Filter results..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 bg-background/50 border-muted-foreground/10 focus-visible:ring-blue-500 rounded-lg"
                  />
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-10 w-48 bg-background/50 border-muted-foreground/10 focus:ring-primary rounded-lg">
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all">Every Month</SelectItem>
                    {uniqueMonths.map(month => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="h-8 w-px bg-border mx-1" />
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    className="h-10 px-4 rounded-lg shadow-sm border-muted-foreground/10 hover:bg-primary/5 hover:text-primary transition-all gap-2 font-semibold"
                    onClick={() => handlePDFAction(false)}
                    disabled={isGenerating || selectedMonth === "all"}
                  >
                    <Eye className="h-4 w-4" />
                    Preview and Download
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Table Content with Animations */}
          <div className="flex-1 overflow-auto p-8 pt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse" />
                  <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
                </div>
                <p className="font-medium animate-pulse">Retriving financial records...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5 transition-colors group hover:bg-muted/10">
                <div className="p-4 rounded-full bg-muted group-hover:bg-muted/20 transition-all mb-4">
                  <Search className="h-8 w-8 opacity-20" />
                </div>
                <p className="font-medium">{searchTerm ? "No results match your filter criteria." : `No ${reportType} records found.`}</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="mt-2 text-primary"
                  onClick={() => { setSearchTerm(""); setSelectedMonth("all"); }}
                >
                  Clear all filters
                </Button>
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
                    Showing <span className="text-foreground">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="text-foreground">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredData.length)}</span> of <span className="text-foreground font-bold">{filteredData.length}</span> records
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground mr-1">Rows per page</p>
                      <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                      >
                        <SelectTrigger className="h-8 w-[70px] bg-background">
                          <SelectValue placeholder={table.getState().pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex h-8 w-12 items-center justify-center text-sm font-bold bg-muted rounded-md border">
                        {table.getState().pagination.pageIndex + 1}
                      </div>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PdfPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={reportType === "contributions" ? "Benefit Contributions Preview" : "Benefit Loans Preview"}
        pdfBlob={pdfBlob}
        fileName={`Benefit_${reportType}_${selectedMonth}_${employee?.user_lname}.pdf`}
      />
    </>
  );
}
