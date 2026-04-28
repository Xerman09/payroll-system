"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCcw, User } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { 
  fetchStaffs, 
  createStaff, 
  patchStaff, 
  deleteStaff,
  fetchVehicleTypes
} from "../providers/compensation-settingsApi";
import { LogisticsStaff, LogisticsVehicleType } from "../types";
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
import { Badge } from "@/components/ui/badge";

export default function StaffTab() {
  const [staffList, setStaffList] = useState<LogisticsStaff[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<LogisticsVehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<LogisticsStaff | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [staffId, setStaffId] = useState("");
  const [role, setRole] = useState<'Driver' | 'Helper'>('Driver');
  const [employmentType, setEmploymentType] = useState<string>("");
  const [vehicleTypeId, setVehicleTypeId] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, vtRes] = await Promise.all([
        fetchStaffs(),
        fetchVehicleTypes()
      ]);
      setStaffList(staffRes.data || []);
      setVehicleTypes(vtRes.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load staff or vehicle types.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenModal = (staff?: LogisticsStaff) => {
    if (staff) {
      setEditingStaff(staff);
      setStaffId(staff.staff_id.toString());
      setRole(staff.role);
      setEmploymentType(staff.employment_type || "");
      setVehicleTypeId(staff.vehicle_type_id?.toString() || "");
    } else {
      setEditingStaff(null);
      const nextId = generateNextBinaryId(staffList.map(s => s.staff_id));
      setStaffId(nextId.toString());
      setRole('Driver');
      setEmploymentType("");
      setVehicleTypeId("");
    }
    setModalOpen(true);
  };

  // Reset vehicle assignment if employment type changes and current assignment is no longer valid
  useEffect(() => {
    if (role === 'Helper') {
      const selectedVT = vehicleTypes.find(v => v.id.toString() === vehicleTypeId);
      if (selectedVT) {
        let isInvalid = false;
        const name = selectedVT.type_name.toUpperCase();
        const isLarge = name.includes('10 WHEELER') || name.includes('TRAILER');
        
        if (employmentType === 'REGULAR(<10W)') {
          isInvalid = isLarge;
        } else if (employmentType === 'REGULAR(10W/T)') {
          isInvalid = !isLarge;
        }
        if (isInvalid) setVehicleTypeId("none");
      }
    }
  }, [employmentType, role, vehicleTypeId, vehicleTypes]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !role) return toast.error("Please fill in required fields.");

    setSubmitting(true);
    try {
      const isRegularHelper = role === 'Helper' && (employmentType === 'REGULAR(<10W)' || employmentType === 'REGULAR(10W/T)');
      const canHaveVehicle = role === 'Driver' || isRegularHelper;

      const payload = {
        staff_id: Number(staffId),
        role: role,
        employment_type: role === 'Helper' ? (employmentType as LogisticsStaff["employment_type"] || null) : null,
        vehicle_type_id: (canHaveVehicle && vehicleTypeId && vehicleTypeId !== "none") ? Number(vehicleTypeId) : null,
      };

      if (editingStaff) {
        await patchStaff(editingStaff.id, payload);
        toast.success("Staff updated successfully.");
      } else {
        await createStaff(payload);
        toast.success("Staff created successfully.");
      }
      setModalOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save staff.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this staff?")) return;
    try {
      await deleteStaff(id);
      toast.success("Staff deleted successfully.");
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete staff.");
    }
  };

  const filteredStaff = staffList.filter(s => {
    const idMatch = s.staff_id.toString().toLowerCase().includes(searchTerm.toLowerCase());
    
    // Dynamic role label matching
    let roleLabel: string = s.role;
    if (s.role === 'Helper') {
      if (s.employment_type === 'REGULAR(<10W)') roleLabel = 'Helper < 10W';
      else if (s.employment_type === 'REGULAR(10W/T)') roleLabel = 'Helper 10W/T';
      else if (['EXTRA', 'PROBATIONARY'].includes(s.employment_type || '')) roleLabel = 'Helper';
      else roleLabel = 'Logistics Crew';
    }
    const roleMatch = roleLabel.toLowerCase().includes(searchTerm.toLowerCase());
    const empMatch = (s.employment_type || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    return idMatch || roleMatch || empMatch;
  });

  const getVehicleTypeName = (id: number) => {
    return vehicleTypes.find(vt => vt.id === id)?.type_name || `VT ${id}`;
  };

  return (
    <div className="w-full space-y-4">
      {/* --- Filter / Action Section --- */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        {/* Search Field */}
        <div className="flex-1 w-full md:max-w-md space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Search staff
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search Staff ID, Role or Employment..." 
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
                onClick={loadData}
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Refresh</span>
              </Button>
              <Button 
                className="h-10 px-4 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4" />
                Add Staff
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
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Staff ID</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Role</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Employment Type</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Assigned Vehicle</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="h-12 animate-pulse bg-slate-50/50 dark:bg-gray-800/50" />
                </TableRow>
              ))
            ) : filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                  No staff members found.
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((staff) => (
                <TableRow key={staff.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <TableCell className="px-6 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    {staff.staff_id}
                  </TableCell>
                  <TableCell className="px-6 text-slate-700 dark:text-slate-300">
                    <Badge 
                      variant={staff.role === 'Driver' ? 'default' : 'secondary'} 
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider",
                        staff.role === 'Helper' && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      {staff.role === 'Helper' && staff.employment_type === 'REGULAR(<10W)' && "Helper < 10W"}
                      {staff.role === 'Helper' && staff.employment_type === 'REGULAR(10W/T)' && "Helper 10W/T"}
                      {staff.role === 'Helper' && ['EXTRA', 'PROBATIONARY'].includes(staff.employment_type || '') && "Helper"}
                      {staff.role === 'Helper' && !['REGULAR(<10W)', 'REGULAR(10W/T)', 'EXTRA', 'PROBATIONARY'].includes(staff.employment_type || '') && "Logistics Crew"}
                      {staff.role === 'Driver' && "Driver"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 text-slate-700 dark:text-slate-300">
                    {staff.employment_type ? (
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {staff.employment_type}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="px-6 text-slate-600 dark:text-slate-400">
                    {staff.vehicle_type_id ? (
                      <span className="px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                        {getVehicleTypeName(staff.vehicle_type_id)}
                      </span>
                    ) : "—"}
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
                        <DropdownMenuItem onClick={() => handleOpenModal(staff)} className="gap-2 cursor-pointer">
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(staff.id)} className="gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950">
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
            <DialogTitle>{editingStaff ? "Edit Staff" : "Add New Staff"}</DialogTitle>
            <DialogDescription>
              Enter the details for the personnel category.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="staffId" className="text-right">Staff ID *</Label>
              <Input 
                id="staffId" 
                type="number" 
                className="col-span-3 bg-slate-50 dark:bg-gray-800" 
                value={staffId} 
                onChange={(e) => setStaffId(e.target.value)} 
                readOnly 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role *</Label>
              <div className="col-span-3">
                <Select value={role} onValueChange={(val: "Driver" | "Helper") => setRole(val)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Driver">Driver</SelectItem>
                    <SelectItem value="Helper">Helper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {role === 'Helper' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="employmentType" className="text-right whitespace-nowrap">Employment *</Label>
                <div className="col-span-3">
                  <Select value={employmentType} onValueChange={setEmploymentType} required={role === 'Helper'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXTRA">EXTRA</SelectItem>
                      <SelectItem value="PROBATIONARY">PROBATIONARY</SelectItem>
                      <SelectItem value="REGULAR(<10W)">REGULAR(&lt;10W)</SelectItem>
                      <SelectItem value="REGULAR(10W/T)">REGULAR(10W/T)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {(role === 'Driver' || (role === 'Helper' && (employmentType === 'REGULAR(<10W)' || employmentType === 'REGULAR(10W/T)'))) && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vehicleTypeId" className="text-right">Vehicle Type</Label>
                <div className="col-span-3">
                  <Select value={vehicleTypeId} onValueChange={setVehicleTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign a vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Unassigned</SelectItem>
                      {vehicleTypes
                        .filter(vt => !!vt.is_payroll)
                        .filter(vt => {
                          if (role !== 'Helper') return true;
                          const name = vt.type_name.toUpperCase();
                          const isLarge = name.includes('10 WHEELER') || name.includes('TRAILER');
                          
                          if (employmentType === 'REGULAR(<10W)') return !isLarge;
                          if (employmentType === 'REGULAR(10W/T)') return isLarge;
                          return true;
                        })
                        .map(vt => (
                          <SelectItem key={vt.id} value={vt.id.toString()}>
                            {vt.type_name}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-primary hover:bg-primary/90">
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
