"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfBlob: Blob | null;
  fileName: string;
}

export function PdfPreviewModal({ isOpen, onClose, title, pdfBlob, fileName }: PdfPreviewModalProps) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pdfBlob) {
      const blobUrl = URL.createObjectURL(pdfBlob);
      setUrl(blobUrl);
      return () => URL.revokeObjectURL(blobUrl);
    }
    setUrl(null);
  }, [pdfBlob]);

  const onDownload = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!w-[90vw] !max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden !rounded-2xl border-none shadow-2xl">
        <DialogHeader className="px-8 py-5 border-b bg-white flex flex-row items-center justify-between shrink-0">
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">{title}</DialogTitle>
            <p className="text-sm text-slate-500 font-medium">Reviewing electronic statement for the selected period.</p>
          </div>
          <div className="flex items-center gap-3 pr-8">
             <Button onClick={onDownload} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-10 px-6 font-semibold shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95">
                <FileDown className="h-4 w-4" />
                Download PDF
             </Button>
             <Button 
                variant="ghost" 
                onClick={onClose}
                className="h-10 px-4 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
             >
                Close Preview
             </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-slate-500/10 p-4 md:p-10 overflow-hidden flex items-center justify-center relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
          {url ? (
            <iframe 
              src={url} 
              className="w-full h-full border-none shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white rounded-lg z-10"
              title="PDF Preview"
            />
          ) : (
             <div className="flex flex-col items-center gap-3 animate-pulse">
                <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-slate-500 font-bold italic tracking-widest uppercase text-xs">Preparing Preview...</div>
             </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
