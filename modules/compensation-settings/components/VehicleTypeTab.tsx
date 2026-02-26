"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCcw, Truck } from 'lucide-react';
import { toast } from "sonner";

import { 
  fetchVehicleTypes, 
  createVehicleType, 
  patchVehicleType, 
  deleteVehicleType 
} from "../providers/compensation-settingsApi";
import { LogisticsVehicleType } from "../types";
import { generateNextBinaryId } from "../utils/idGenerator";

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
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function VehicleTypeTab() {
  const [vehicleTypes, setVehicleTypes] = useState<LogisticsVehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVT, setEditingVT] = useState<LogisticsVehicleType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [vehicleTypeId, setVehicleTypeId] = useState("");
  const [vehicleType, setVehicleType] = useState<'BELOW 10 WHEELER' | '10 WHEELER' | 'TRAILER' | 'N/A'>('N/A');

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

  const handleOpenModal = (vt?: LogisticsVehicleType) => {
    if (vt) {
      setEditingVT(vt);
      setVehicleTypeId(vt.vehicle_type_id.toString());
      setVehicleType(vt.vehicle_type);
    } else {
      setEditingVT(null);
      const nextId = generateNextBinaryId(vehicleTypes.map(v => v.vehicle_type_id));
      setVehicleTypeId(nextId.toString());
      setVehicleType('N/A');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleTypeId || !vehicleType) return toast.error("Please fill in required fields.");

    setSubmitting(true);
    try {
      const payload = {
        vehicle_type_id: Number(vehicleTypeId),
        vehicle_type: vehicleType,
      };

      if (editingVT) {
        await patchVehicleType(editingVT.id, payload);
        toast.success("Vehicle type updated successfully.");
      } else {
        await createVehicleType(payload);
        toast.success("Vehicle type created successfully.");
      }
      setModalOpen(false);
      loadVehicleTypes();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save vehicle type.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this vehicle type?")) return;
    try {
      await deleteVehicleType(id);
      toast.success("Vehicle type deleted successfully.");
      loadVehicleTypes();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete vehicle type.");
    }
  };

  const filteredVTs = vehicleTypes.filter(vt => 
    vt.vehicle_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vt.vehicle_type_id.toString().includes(searchTerm)
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
              <Button 
                className="h-10 px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4" />
                Add Type
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
              <TableHead className="font-semibold text-gray-600 px-6 py-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={3} className="h-12 animate-pulse bg-slate-50/50 dark:bg-gray-800/50" />
                </TableRow>
              ))
            ) : filteredVTs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center text-slate-500">
                  No vehicle types found.
                </TableCell>
              </TableRow>
            ) : (
              filteredVTs.map((vt) => (
                <TableRow key={vt.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <TableCell className="px-6 font-medium text-slate-900 dark:text-slate-100">{vt.vehicle_type_id}</TableCell>
                  <TableCell className="px-6 text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-xs tracking-tight">{vt.vehicle_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 border-none">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <Separator className="my-1" />
                        <DropdownMenuItem onClick={() => handleOpenModal(vt)} className="gap-2 cursor-pointer">
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(vt.id)} className="gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950">
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVT ? "Edit Vehicle Type" : "Add New Vehicle Type"}</DialogTitle>
            <DialogDescription>
              Enter the details for the logistics vehicle classification.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="vtId" className="text-right">Type ID *</Label>
              <Input 
                id="vtId" 
                type="number" 
                className="col-span-3 bg-slate-50 dark:bg-gray-800" 
                value={vehicleTypeId} 
                onChange={(e) => setVehicleTypeId(e.target.value)} 
                readOnly 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="vtType" className="text-right">Classification *</Label>
              <div className="col-span-3">
                <Select value={vehicleType} onValueChange={(val: any) => setVehicleType(val)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BELOW 10 WHEELER">BELOW 10 WHEELER</SelectItem>
                    <SelectItem value="10 WHEELER">10 WHEELER</SelectItem>
                    <SelectItem value="TRAILER">TRAILER</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
