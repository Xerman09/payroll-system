"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCcw, Truck } from 'lucide-react';
import { toast } from "sonner";

import { fetchVehicleTypes, patchVehicleType } from "../providers/compensation-settingsApi";
import { LogisticsVehicleType } from "../types";
import { Checkbox } from "@/components/ui/checkbox";

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

export default function VehicleTypeTab() {
  const [vehicleTypes, setVehicleTypes] = useState<LogisticsVehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadVehicleTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVehicleTypes();
      setVehicleTypes(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load vehicle types.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicleTypes();
  }, [loadVehicleTypes]);

  const handleTogglePayroll = async (id: number, currentStatus: boolean | number) => {
    setUpdatingId(id);
    const newStatus = !currentStatus;
    try {
      await patchVehicleType(id, { is_payroll: newStatus });
      toast.success(`Vehicle type payroll status updated.`);
      // Optimistic update
      setVehicleTypes(prev => prev.map(vt => vt.id === id ? { ...vt, is_payroll: newStatus } : vt));
    } catch (error) {
      console.error(error);
      toast.error("Failed to update payroll status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredVTs = vehicleTypes.filter(vt => 
    (vt.type_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    vt.id.toString().includes(searchTerm)
  );

  return (
    <div className="w-full space-y-4">
      {/* --- Filter / Action Section --- */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        {/* Search Field */}
        <div className="flex-1 w-full md:max-w-md space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Search vehicle classification
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search Type ID or Name..." 
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
              Quick Actions
            </label>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="h-10 px-3 gap-2 text-gray-600 border-gray-300"
                onClick={loadVehicleTypes}
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Refresh</span>
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
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Vehicle Type ID</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Classification</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4 text-center">Is Payroll</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={2} className="h-12 animate-pulse bg-slate-50/50 dark:bg-gray-800/50" />
                </TableRow>
              ))
            ) : filteredVTs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="h-32 text-center text-slate-500">
                  No vehicle types found.
                </TableCell>
              </TableRow>
            ) : (
              filteredVTs.map((vt) => (
                <TableRow key={vt.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <TableCell className="px-6 font-medium text-slate-900 dark:text-slate-100">{vt.id}</TableCell>
                  <TableCell className="px-6 text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-xs tracking-tight">{vt.type_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-center">
                    <div className="flex justify-center">
                      <Checkbox 
                        checked={!!vt.is_payroll} 
                        onCheckedChange={() => handleTogglePayroll(vt.id, !!vt.is_payroll)}
                        disabled={updatingId === vt.id}
                        className="h-5 w-5"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
