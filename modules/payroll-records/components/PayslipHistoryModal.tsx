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
import { Loader2, Eye, FileDown, History } from "lucide-react";
import { formatPHP } from "../../payroll-run/utils/compute";
import { buildPayslipsPdf } from "../../payroll-run/utils/payslipPdf";

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
      sp.set("limit", "100");
      
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

  const filteredRecords = React.useMemo(() => {
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Payslip History - {employee?.user_fname} {employee?.user_lname}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by cutoff label, date, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Loading records...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                {searchTerm ? "No matching records found." : "No payroll records found for this employee."}
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cutoff Period</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.cutoff_label || (
                            <span className="text-xs text-muted-foreground">
                              {r.cutoff_start} to {r.cutoff_end}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.cutoff_type === "FIRST" ? "First" : "Second"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPHP(Number(r.net_pay || 0))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => handlePreview(r)}
                            disabled={isGenerating}
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
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
        <DialogContent className="w-full max-w-[95vw] sm:max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="pl-6 pr-12 py-4 border-b bg-background">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-lg">Payslip Preview</DialogTitle>
                <div className="text-xs text-muted-foreground">
                  Review the payslip for the selected cutoff.
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <Button variant="default" size="sm" asChild>
                    <a href={previewUrl} download={`Payslip-${employee?.user_fname}-${employee?.user_lname}.pdf`}>
                      <FileDown className="mr-2 h-4 w-4" />
                      Download PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-muted/20 w-full h-full relative">
            {previewUrl ? (
              <iframe
                title="Payslip PDF Preview"
                src={`${previewUrl}#toolbar=0&view=FitH`}
                className="w-full h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No preview available.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
