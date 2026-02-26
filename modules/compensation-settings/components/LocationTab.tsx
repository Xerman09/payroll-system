"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCcw } from 'lucide-react';
import { toast } from "sonner";

import { 
  fetchLocations, 
  createLocation, 
  patchLocation, 
  deleteLocation,
  fetchAreas
} from "../providers/compensation-settingsApi";
import { LogisticsLocation, LogisticsArea } from "../types";
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

export default function LocationTab() {
  const [locations, setLocations] = useState<LogisticsLocation[]>([]);
  const [areas, setAreas] = useState<LogisticsArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LogisticsLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [locationId, setLocationId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [distance, setDistance] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, areaRes] = await Promise.all([
        fetchLocations(),
        fetchAreas()
      ]);
      setLocations(locRes.data || []);
      setAreas(areaRes.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load locations or areas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenModal = (location?: LogisticsLocation) => {
    if (location) {
      setEditingLocation(location);
      setLocationId(location.location_id.toString());
      setAreaId(location.area_id.toString());
      setLocationName(location.location);
      setDistance(location.distance?.toString() || "");
    } else {
      setEditingLocation(null);
      const nextId = generateNextBinaryId(locations.map(l => l.location_id));
      setLocationId(nextId.toString());
      setAreaId("");
      setLocationName("");
      setDistance("");
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId || !areaId || !locationName) return toast.error("Please fill in required fields.");

    setSubmitting(true);
    try {
      const payload = {
        location_id: Number(locationId),
        area_id: Number(areaId),
        location: locationName,
        distance: distance ? Number(distance) : null,
      };

      if (editingLocation) {
        await patchLocation(editingLocation.id, payload);
        toast.success("Location updated successfully.");
      } else {
        await createLocation(payload);
        toast.success("Location created successfully.");
      }
      setModalOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save location.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this location?")) return;
    try {
      await deleteLocation(id);
      toast.success("Location deleted successfully.");
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete location.");
    }
  };

  const filteredLocations = locations.filter(l => 
    l.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.location_id.toString().includes(searchTerm)
  );

  const getAreaName = (id: number) => {
    return areas.find(a => a.area_id === id)?.area_name || `Area ${id}`;
  };

  return (
    <div className="w-full space-y-4">
      {/* --- Filter / Action Section --- */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        {/* Search Field */}
        <div className="flex-1 w-full md:max-w-md space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Search location
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search Location ID or Name..." 
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
                className="h-10 px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4" />
                Add Location
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
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Location ID</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Area</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Location Name</TableHead>
              <TableHead className="font-semibold text-gray-600 px-6 py-4">Distance (km)</TableHead>
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
            ) : filteredLocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                  No locations found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLocations.map((loc) => (
                <TableRow key={loc.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <TableCell className="px-6 font-medium text-slate-900 dark:text-slate-100">{loc.location_id}</TableCell>
                  <TableCell className="px-6 text-slate-700 dark:text-slate-300">
                    <span className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                      {getAreaName(loc.area_id)}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 text-slate-700 dark:text-slate-300">{loc.location}</TableCell>
                  <TableCell className="px-6 text-slate-600 dark:text-slate-400">
                    {loc.distance ? `${loc.distance} km` : "—"}
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
                        <DropdownMenuItem onClick={() => handleOpenModal(loc)} className="gap-2 cursor-pointer">
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(loc.id)} className="gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950">
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
            <DialogTitle>{editingLocation ? "Edit Location" : "Add New Location"}</DialogTitle>
            <DialogDescription>
              Enter the details for the delivery/pickup location.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="locationId" className="text-right">Location ID *</Label>
              <Input 
                id="locationId" 
                type="number" 
                className="col-span-3 bg-slate-50 dark:bg-gray-800" 
                value={locationId} 
                onChange={(e) => setLocationId(e.target.value)} 
                readOnly 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="areaId" className="text-right">Area *</Label>
              <div className="col-span-3">
                <Select value={areaId} onValueChange={setAreaId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map(area => (
                      <SelectItem key={area.area_id} value={area.area_id.toString()}>
                        {area.area_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="locationName" className="text-right">Location Name *</Label>
              <Input 
                id="locationName" 
                className="col-span-3" 
                value={locationName} 
                onChange={(e) => setLocationName(e.target.value)} 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="distance" className="text-right">Distance (km)</Label>
              <Input 
                id="distance" 
                type="number" 
                className="col-span-3" 
                value={distance} 
                onChange={(e) => setDistance(e.target.value)} 
              />
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
