"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCcw } from 'lucide-react';
import { toast } from "sonner";

import { 
  fetchAreas, 
  createArea, 
  patchArea, 
  deleteArea 
} from "../providers/compensation-settingsApi";
import { LogisticsArea } from "../types";
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

export default function AreaTab() {
  const [areas, setAreas] = useState<LogisticsArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<LogisticsArea | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [areaId, setAreaId] = useState("");
  const [areaName, setAreaName] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [modeType, setModeType] = useState<LogisticsArea['mode_type']>(null);

  const loadAreas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAreas();
      setAreas(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load areas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  const handleOpenModal = (area?: LogisticsArea) => {
    if (area) {
      setEditingArea(area);
      setAreaId(area.area_id.toString());
      setAreaName(area.area_name);
      setMaxDays(area.max_days?.toString() || "");
      setModeType(area.mode_type || null);
    } else {
      setEditingArea(null);
      const nextId = generateNextBinaryId(areas.map(a => a.area_id));
      setAreaId(nextId.toString());
      setAreaName("");
      setMaxDays("");
      setModeType(null);
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaId || !areaName) return toast.error("Please fill in required fields.");

    setSubmitting(true);
    try {
      const payload = {
        area_id: Number(areaId),
        area_name: areaName,
        max_days: maxDays ? Number(maxDays) : null,
        mode_type: modeType || null,
      };

      if (editingArea) {
        await patchArea(editingArea.id, payload);
        toast.success("Area updated successfully.");
      } else {
        await createArea(payload);
        toast.success("Area created successfully.");
      }
      setModalOpen(false);
      loadAreas();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save area.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this area?")) return;
    try {
      await deleteArea(id);
      toast.success("Area deleted successfully.");
      loadAreas();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete area.");
    }
  };

  const filteredAreas = areas.filter(a => 
    a.area_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.area_id.toString().includes(searchTerm)
  );

  return (
    <div className="w-full space-y-4">
      {/* --- Filter / Action Section --- */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        {/* Search Field */}
        <div className="flex-1 w-full md:max-w-md space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Search area
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search Area ID or Name..." 
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
                onClick={loadAreas}
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Refresh</span>
              </Button>
              <Button 
                className="h-10 px-4 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4" />
                Add Area
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
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Area ID</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Area Name</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Mode</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Max Days</TableHead>
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
            ) : filteredAreas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                  No areas found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAreas.map((area) => (
                <TableRow key={area.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <TableCell className="px-6 font-medium text-slate-900 dark:text-slate-100">{area.area_id}</TableCell>
                  <TableCell className="px-6 text-slate-700 dark:text-slate-300">{area.area_name}</TableCell>
                  <TableCell className="px-6">
                    {area.mode_type ? (
                      <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                        {area.mode_type}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="px-6 text-slate-600 dark:text-slate-400">{area.max_days || "—"}</TableCell>
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
                        <DropdownMenuItem onClick={() => handleOpenModal(area)} className="gap-2 cursor-pointer">
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(area.id)} className="gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950">
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
            <DialogTitle>{editingArea ? "Edit Area" : "Add New Area"}</DialogTitle>
            <DialogDescription>
              Enter the details for the geographical area.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="areaId" className="text-right">Area ID *</Label>
              <Input 
                id="areaId" 
                type="number" 
                className="col-span-3 bg-slate-50 dark:bg-gray-800" 
                value={areaId} 
                onChange={(e) => setAreaId(e.target.value)} 
                readOnly 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="areaName" className="text-right">Area Name *</Label>
              <Input 
                id="areaName" 
                className="col-span-3" 
                value={areaName} 
                onChange={(e) => setAreaName(e.target.value)} 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="modeType" className="text-right">Mode</Label>
              <div className="col-span-3">
                <Select value={modeType || "none"} onValueChange={(val) => setModeType(val === "none" ? null : val as LogisticsArea['mode_type'])}>
                  <SelectTrigger id="modeType">
                    <SelectValue placeholder="Select mode type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="DELIVERY">DELIVERY</SelectItem>
                    <SelectItem value="PICKUP ONLY">PICKUP ONLY</SelectItem>
                    <SelectItem value="PICKUP W/ MP DELIVERY">PICKUP W/ MP DELIVERY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="maxDays" className="text-right">Max Days</Label>
              <Input 
                id="maxDays" 
                type="number" 
                className="col-span-3" 
                value={maxDays} 
                onChange={(e) => setMaxDays(e.target.value)} 
              />
            </div>
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
