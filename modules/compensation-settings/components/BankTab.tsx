"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCcw, Landmark, Plus, Trash2, Edit } from 'lucide-react';
import { toast } from "sonner";

import { fetchBanks, createBank, patchBank, deleteBank } from "../providers/compensation-settingsApi";
import { BankName } from "../../employees/types";

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function BankTab() {
  const [banks, setBanks] = useState<BankName[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBank, setEditingBank] = useState<BankName | null>(null);
  const [bankNameInput, setBankNameInput] = useState("");

  const loadBanks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBanks();
      setBanks(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load banks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  const handleOpenModal = (bank?: BankName) => {
    if (bank) {
      setEditingBank(bank);
      setBankNameInput(bank.bank_name);
    } else {
      setEditingBank(null);
      setBankNameInput("");
    }
    setIsModalOpen(true);
  };

  const handleSaveBank = async () => {
    if (!bankNameInput.trim()) {
      toast.error("Bank name is required.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingBank) {
        await patchBank(editingBank.id, { bank_name: bankNameInput });
        toast.success("Bank updated successfully.");
      } else {
        await createBank({ bank_name: bankNameInput });
        toast.success("Bank created successfully.");
      }
      setIsModalOpen(false);
      loadBanks();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save bank.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBank = async (id: number) => {
    // Note: the rule says no browser dialogs, so if we needed confirmation we'd use a shadcn AlertDialog.
    // We will just do direct delete for simplicity, or we could add an AlertDialog if requested.
    try {
      setIsSaving(true);
      await deleteBank(id);
      toast.success("Bank deleted successfully.");
      loadBanks();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete bank.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredBanks = banks.filter(b => 
    (b.bank_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.id.toString().includes(searchTerm)
  );

  return (
    <div className="w-full space-y-4">
      {/* --- Filter / Action Section --- */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        {/* Search Field */}
        <div className="flex-1 w-full md:max-w-md space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Search banks
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search Bank ID or Name..." 
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Actions
            </label>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="h-10 px-3 gap-2 text-gray-600 border-gray-300"
                onClick={loadBanks}
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Refresh</span>
              </Button>
              <Button 
                className="h-10 px-3 gap-2"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">Add Bank</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      {/* --- Table Section --- */}
      <div className="border rounded-md overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800">
            <TableRow>
              <TableHead className="font-semibold text-gray-600 px-6 py-4 w-24">Bank ID</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Bank Name</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4 w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={3} className="h-12 animate-pulse bg-slate-50/50 dark:bg-gray-800/50" />
                </TableRow>
              ))
            ) : filteredBanks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center text-slate-500">
                  No banks found.
                </TableCell>
              </TableRow>
            ) : (
              filteredBanks.map((bank) => (
                <TableRow key={bank.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <TableCell className="px-6 font-medium text-slate-900 dark:text-slate-100">{bank.id}</TableCell>
                  <TableCell className="px-6 text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-sm tracking-tight">{bank.bank_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenModal(bank)}>
                        <Edit className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" onClick={() => handleDeleteBank(bank.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBank ? "Edit Bank" : "Add New Bank"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input 
                value={bankNameInput}
                onChange={(e) => setBankNameInput(e.target.value)}
                placeholder="e.g. BDO, BPI, UnionBank..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveBank();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBank} disabled={isSaving || !bankNameInput.trim()}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
