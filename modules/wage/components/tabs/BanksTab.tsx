"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, PiggyBank, Trash2 } from "lucide-react";

import type { Employee, BankName, UserBank } from "../../../employees/types";
import * as employeeApi from "../../../employees/providers/employeeApi";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  selectedEmployee: Employee | null;
};

export function BanksTab({ selectedEmployee }: Props) {
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [bankNames, setBankNames] = useState<BankName[]>([]);
  const [userBanks, setUserBanks] = useState<UserBank[]>([]);
  
  const [newBankId, setNewBankId] = useState("");
  const [newBankAcct, setNewBankAcct] = useState("");

  const loadBankNames = useCallback(async () => {
    try {
      const bNames = await employeeApi.fetchBankNames();
      setBankNames(bNames);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load bank names.");
    }
  }, []);

  const loadUserBanks = useCallback(async () => {
    if (!selectedEmployee?.user_id) return;
    setLoadingBanks(true);
    try {
      const uBanks = await employeeApi.fetchUserBanks(selectedEmployee.user_id);
      setUserBanks(uBanks);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load user banks.");
    } finally {
      setLoadingBanks(false);
    }
  }, [selectedEmployee]);

  useEffect(() => {
    loadBankNames();
  }, [loadBankNames]);

  useEffect(() => {
    if (selectedEmployee?.user_id) {
      loadUserBanks();
    } else {
      setUserBanks([]);
    }
  }, [selectedEmployee, loadUserBanks]);

  const handleAddBank = async () => {
    if (!selectedEmployee?.user_id) return;
    if (!newBankId || !newBankAcct) return;

    setSaving(true);
    try {
      await employeeApi.createUserBank({
        user_id: selectedEmployee.user_id,
        bank_id: Number(newBankId),
        account_number_hash: newBankAcct,
        is_active: userBanks.length === 0 ? 1 : 0 // first bank is active by default
      });
      toast.success("Bank account added.");
      setNewBankId("");
      setNewBankAcct("");
      await loadUserBanks();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add bank account.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetBankActive = async (bank: UserBank) => {
    if (!bank.id || !selectedEmployee?.user_id) return;
    setSaving(true);
    try {
      const currentlyActive = userBanks.filter(b => b.is_active === 1 || b.is_active === true);
      // set others to inactive
      for (const activeBank of currentlyActive) {
        if (activeBank.id && activeBank.id !== bank.id) {
          await employeeApi.updateUserBank(activeBank.id, { is_active: 0 });
        }
      }
      // set new one to active
      await employeeApi.updateUserBank(bank.id, { is_active: 1 });
      toast.success("Active bank updated.");
      await loadUserBanks();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update active bank.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBank = async (id: number) => {
    setSaving(true);
    try {
      await employeeApi.deleteUserBank(id);
      toast.success("Bank account deleted.");
      await loadUserBanks();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete bank account.");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedEmployee?.user_id) {
    return (
      <div className="text-center p-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
        Please save the employee first to add bank accounts.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Bank Setup
        </div>
        <div className="text-xs text-slate-500">
          Manage the bank accounts where this employee receives their payroll.
        </div>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg border flex flex-col md:flex-row items-end gap-4">
        <div className="space-y-2 flex-1 w-full">
          <Label>Bank Name</Label>
          <select 
            value={newBankId} 
            onChange={e => setNewBankId(e.target.value)} 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select Bank</option>
            {bankNames.map(b => (
              <option key={b.id} value={b.id}>{b.bank_name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 flex-1 w-full">
          <Label>Account Number</Label>
          <Input 
            value={newBankAcct} 
            onChange={e => setNewBankAcct(e.target.value)} 
            placeholder="Enter account number..." 
          />
        </div>
        <Button 
          type="button" 
          onClick={handleAddBank} 
          disabled={!newBankId || !newBankAcct || saving} 
          className="w-full md:w-auto"
        >
          Add Bank
        </Button>
      </div>

      {loadingBanks ? (
        <div className="flex justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : userBanks.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">
          No bank accounts added yet.
        </div>
      ) : (
        <div className="border rounded-md divide-y overflow-hidden shadow-sm">
          {userBanks.map(ub => (
            <div key={ub.id} className="flex items-center justify-between p-4 bg-white dark:bg-transparent">
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-slate-400" />
                  {ub.bank?.bank_name || `Bank ID: ${ub.bank_id}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1 ml-6">{ub.account_number_hash}</p>
              </div>
              <div className="flex items-center gap-4">
                {ub.is_active === 1 || ub.is_active === true ? (
                  <span className="text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800">
                    Active
                  </span>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleSetBankActive(ub)} 
                    disabled={saving}
                    className="h-8 text-xs"
                  >
                    Set Active
                  </Button>
                )}
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="text-red-500 hover:text-red-600 hover:bg-red-50" 
                  onClick={() => ub.id && handleDeleteBank(ub.id)} 
                  disabled={saving || ub.is_active === 1 || ub.is_active === true}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
