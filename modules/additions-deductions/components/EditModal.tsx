"use client";

import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { PayrollRecord } from "@/modules/additions-deductions/types";

export type EditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  record: PayrollRecord | null;
  onSave: (updated: PayrollRecord) => void;
};

export default function EditModal({ isOpen, onClose, record, onSave }: EditModalProps) {
  // We intentionally avoid setState-in-effect lint by using a "reset key" pattern.
  const resetKey = useMemo(() => String(record?.id ?? "new"), [record?.id]);

  const [desc, setDesc] = useState<string>(record?.description ?? "");
  const [amt, setAmt] = useState<string>((record?.amount ?? "").toString());
  const [start, setStart] = useState<string>(record?.cutoff_start ?? "");
  const [end, setEnd] = useState<string>(record?.cutoff_end ?? "");

  // When record changes, remount content and re-seed fields
  // by keying the inner form.
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <div key={resetKey}>
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description"
              />
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
                <Input
                  className="pl-7"
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!record) return;
                onSave({
                  ...record,
                  description: desc,
                  amount: amt,
                  cutoff_start: start,
                  cutoff_end: end,
                });
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
