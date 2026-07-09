"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { formatPeso } from "../../helpers";

interface CoopSavingsDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
}

interface DeductionDetail {
  id: number;
  cutoff_label: string;
  cutoff_start: string;
  cutoff_end: string;
  amount: number;
}

export function CoopSavingsDetailsModal({
  isOpen,
  onClose,
  userId,
  userName,
}: CoopSavingsDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<DeductionDetail[]>([]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        query.set("filter[user_id][_eq]", String(userId));
        query.set("filter[coop_savings][_gt]", "0");
        query.set("sort", "-cutoff_end"); // most recent first
        query.set("limit", "-1");

        const res = await fetch(`/api/coop?collection=payroll_run_employee&${query.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch details");

        const json = await res.json();
        const data = Array.isArray(json.data) ? json.data : [];

        setDetails(
          data.map((row: any) => ({
            id: row.id,
            cutoff_label: row.cutoff_label || "-",
            cutoff_start: row.cutoff_start,
            cutoff_end: row.cutoff_end,
            amount: Number(row.coop_savings) || 0,
          }))
        );
      } catch (err) {
        console.error("Failed to load savings details", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, userId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] w-[90vw] max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl font-semibold">
            Savings Deduction Details <span className="text-muted-foreground font-normal">| {userName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : details.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 dark:bg-gray-800/20 rounded-lg border border-dashed">
              <p className="text-gray-500 font-medium">No historical deductions found</p>
              <p className="text-sm text-gray-400 mt-1">This user hasn't made any savings contributions yet.</p>
            </div>
          ) : (
            <div className="rounded-md border shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[30%] font-semibold text-gray-700 dark:text-gray-300">Cutoff Range</TableHead>
                    <TableHead className="w-[45%] font-semibold text-gray-700 dark:text-gray-300">Cutoff Label</TableHead>
                    <TableHead className="w-[25%] text-right font-semibold text-gray-700 dark:text-gray-300 pr-6">Amount Deducted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((row) => {
                    const formatDate = (dateStr: string) => {
                      try {
                        const date = new Date(dateStr);
                        return new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(date);
                      } catch {
                        return dateStr;
                      }
                    };

                    return (
                      <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {formatDate(row.cutoff_start)} <span className="text-muted-foreground font-normal mx-1">to</span> {formatDate(row.cutoff_end)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {row.cutoff_label}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium pr-6">
                          {formatPeso(row.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        
        {!loading && details.length > 0 && (
          <div className="border-t bg-muted/20 px-6 py-4 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">
              Total Contributions: {details.length}
            </span>
            <div className="text-lg font-bold">
              Total: <span className="text-emerald-600 dark:text-emerald-400 ml-2">{formatPeso(details.reduce((sum, row) => sum + row.amount, 0))}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
