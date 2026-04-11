"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, Eye, Loader2 } from "lucide-react";
import { exportCoopPdf, CoopPaperSize } from "../../utils/coopExportPdf";
import { listItems } from "../../providers/coopApi";
import { CutoffSetting } from "@/modules/benefit-settings/types";
import { fetchCompanyConfig } from "@/modules/benefit-settings/providers/benefitApi";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "savings" | "loans";
  data: Record<string, unknown>[];
  searchTerm: string;
  statusFilter: string;
}

export function PrintPreviewModal({
  isOpen,
  onClose,
  type,
  data,
  searchTerm,
  statusFilter,
}: PrintPreviewModalProps) {
  const [paperSize, setPaperSize] = useState<CoopPaperSize>("LETTER");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cutoffs, setCutoffs] = useState<CutoffSetting[]>([]);
  const [selectedCutoff, setSelectedCutoff] = useState<string>("all");
  const [companyName, setCompanyName] = useState<string>("MEN2 MARKETING CORPORATION");

  useEffect(() => {
    if (isOpen) {
      const fetchCutoffs = async () => {
        try {
          const [{ data: list }, config] = await Promise.all([
            listItems<CutoffSetting>("cutoff_settings", {
              limit: "100",
              sort: "-start_date",
            }),
            fetchCompanyConfig()
          ]);
          setCutoffs(list);
          if (config?.companyName) {
            setCompanyName(config.companyName);
          }
        } catch (error) {
          console.error("Failed to fetch cutoffs or config:", error);
        }
      };
      fetchCutoffs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && data.length > 0) {
      const generatePreview = async () => {
        setIsGenerating(true);
        try {
          const doc = await exportCoopPdf({
            paper: paperSize,
            type,
            data,
            searchTerm,
            statusFilter,
            cutoffId: selectedCutoff === "all" ? undefined : Number(selectedCutoff),
            cutoffs,
            companyName,
          });

          const blob = doc.output("blob");
          setPreviewUrl((prevUrl) => {
            if (prevUrl) URL.revokeObjectURL(prevUrl);
            return URL.createObjectURL(blob);
          });
        } catch (error) {
          console.error("Failed to generate PDF preview:", error);
        } finally {
          setIsGenerating(false);
        }
      };
      generatePreview();
    }
  }, [isOpen, paperSize, type, data, selectedCutoff, cutoffs, companyName, searchTerm, statusFilter]);

  useEffect(() => {
    // only cleanup on unmount
    return () => {
      setPreviewUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return null;
      });
    };
  }, []);

  const handleDownload = () => {
    if (previewUrl) {
      const link = document.createElement("a");
      link.href = previewUrl;
      link.download = `Coop_${type}_${new Date().toISOString().split("T")[0]}.pdf`;
      link.click();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-background">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-lg">
                {type === "savings" ? "Savings Report Preview" : "Loans Report Preview"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Review the generated report before downloading.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Paper Size:</span>
                <Select
                  value={paperSize}
                  onValueChange={(val) => setPaperSize(val as CoopPaperSize)}
                >
                  <SelectTrigger className="h-8 w-[100px]">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LETTER">Letter</SelectItem>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="LEGAL">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-8 border-r mx-1" />

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Cutoff:</span>
                <Select value={selectedCutoff} onValueChange={setSelectedCutoff}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Select Cutoff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    {cutoffs.map((c) => (
                      <SelectItem key={`cutoff-${c.id}`} value={String(c.id)}>
                        {`${new Date(c.start_date).toLocaleDateString()} (${c.cutoff_type})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={handleDownload}
                disabled={!previewUrl || isGenerating}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted/20 relative w-full h-full">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/50 backdrop-blur-sm z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Generating preview...</p>
            </div>
          ) : previewUrl ? (
            <iframe
              title="PDF Preview"
              src={`${previewUrl}#toolbar=0&view=FitH`}
              className="w-full h-full border-0"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-2">
                <Eye className="h-12 w-12 mx-auto opacity-20" />
                <p>No data to preview</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
