"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCcw, MapPin, Navigation, Globe, Building2, ListOrdered, X, LayoutTemplate, LibraryBig, Eraser, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toast } from "sonner";

import {
  fetchLocations,
  createLocation,
  patchLocation,
  deleteLocation,
  fetchAreas
} from "../providers/compensation-settingsApi";
import { LogisticsLocation, LogisticsArea, PSGCProvince, PSGCCityMunicipality, PSGCRegion } from "../types";
import { getRegions, getProvincesInRegion, getCitiesInProvince, getCitiesInRegion } from "../utils/psgcApi";

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

interface StagedLocation {
  regionName: string;
  provinceName: string;
  cityName: string;
  distance: string;
  batchId?: string; // To track bulk items
}

const normalizeStr = (name?: string | null) =>
  (name || "").trim().toUpperCase()
    .replace(/^CITY OF\s+/i, "")
    .replace(/^MUNICIPALITY OF\s+/i, "")
    .replace(/\s+CITY$/i, "");

const isDuplicateLocation = (
  city: string,
  province: string,
  region: string,
  staged: StagedLocation[],
  existing: LogisticsLocation[],
  debug = false
) => {
  const targetCity = normalizeStr(city);
  const targetProvince = normalizeStr(province);
  const targetRegion = normalizeStr(region);

  if (debug) {
    console.group(`[DUP CHECK] city="${city}" province="${province}" region="${region}"`);
    console.log(`  → normalized: city="${targetCity}" province="${targetProvince}" region="${targetRegion}"`);
    console.log(`  → existing snapshot size: ${existing.length}`);
  }

  const isStaged = staged.some(sl =>
    normalizeStr(sl.cityName) === targetCity &&
    normalizeStr(sl.provinceName) === targetProvince
  );

  const matchingExisting = existing.filter(el => {
    const elCity = normalizeStr(el.city || el.location?.split(", ")[0]);
    const elProvince = normalizeStr(el.province || el.location?.split(", ")[1]);
    const elRegion = normalizeStr(el.region);

    const nameMatch = elCity === targetCity;
    const provinceMatch = elProvince === targetProvince;
    const regionMatch = targetRegion && elRegion === targetRegion;

    if (debug && nameMatch) {
      console.log(`  [CITY NAME HIT] db.city="${el.city}" → elCity="${elCity}" | elProvince="${elProvince}" | elRegion="${elRegion}"`);
      console.log(`    provinceMatch=${provinceMatch} regionMatch=${!!(regionMatch)} elProvince==''=${elProvince === ""}`);
    }

    return nameMatch && (provinceMatch || (elProvince === "" && regionMatch));
  });

  const isSaved = matchingExisting.length > 0;

  if (debug) {
    console.log(`  → isStaged=${isStaged} isSaved=${isSaved}`);
    if (isSaved) console.log(`  → BLOCKED by existing record:`, matchingExisting[0]);
    else console.log(`  → PASSED validation gate (not found in snapshot)`);
    console.groupEnd();
  }

  return isStaged || isSaved;
};

export default function LocationTab() {
  const [locations, setLocations] = useState<LogisticsLocation[]>([]);
  const [areas, setAreas] = useState<LogisticsArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LogisticsLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // PSGC states
  const [regions, setRegions] = useState<PSGCRegion[]>([]);
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);
  const [cities, setCities] = useState<PSGCCityMunicipality[]>([]);
  const [loadingPSGC, setLoadingPSGC] = useState(false);

  // Form states
  const [areaId, setAreaId] = useState("");
  const [distance, setDistance] = useState("");
  const [selectedRegionCode, setSelectedRegionCode] = useState("");
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedCityName, setSelectedCityName] = useState("");

  // Multi-add state
  const [stagedLocations, setStagedLocations] = useState<StagedLocation[]>([]);

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
      const err = error as Error;
      console.error(err);
      toast.error(err.message || "Failed to load locations or areas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this location archive?")) return;

    try {
      await deleteLocation(id);
      toast.success("Location archived successfully.");
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete location.");
    }
  };

  const loadRegions = useCallback(async () => {
    setLoadingPSGC(true);
    try {
      const data = await getRegions();
      setRegions(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      const err = error as Error;
      console.error(err);
      toast.error(err.message || "Failed to load regions.");
    } finally {
      setLoadingPSGC(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadRegions();
  }, [loadData, loadRegions]);

  // Cascading Logic: Load Provinces when Region changes
  useEffect(() => {
    if (!selectedRegionCode) {
      setProvinces([]);
      return;
    }

    const fetchProvinces = async () => {
      setLoadingPSGC(true);
      try {
        const data = await getProvincesInRegion(selectedRegionCode);
        setProvinces(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        const err = error as Error;
        console.error(err);
        toast.error(err.message || "Failed to load provinces.");
      } finally {
        setLoadingPSGC(false);
      }
    };
    fetchProvinces();
  }, [selectedRegionCode]);

  // Cascading Logic: Load Cities when Province changes
  useEffect(() => {
    if (!selectedProvinceCode) {
      setCities([]);
      return;
    }

    const fetchCities = async () => {
      setLoadingPSGC(true);
      try {
        const data = await getCitiesInProvince(selectedProvinceCode);
        setCities(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        const err = error as Error;
        console.error(err);
        toast.error(err.message || "Failed to load cities.");
      } finally {
        setLoadingPSGC(false);
      }
    };
    fetchCities();
  }, [selectedProvinceCode]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleRegionChange = (code: string) => {
    setSelectedRegionCode(code);
    setSelectedProvinceCode("");
    setSelectedCityName("");
  };

  const handleProvinceChange = (code: string) => {
    setSelectedProvinceCode(code);
    setSelectedCityName("");
  };

  const handleOpenModal = useCallback((location?: LogisticsLocation) => {
    setStagedLocations([]);
    if (location) {
      setEditingLocation(location);
      setAreaId(location.area_id.toString());
      setDistance(location.distance?.toString() || "");

      // We set region code first, which triggers province fetch via useEffect
      const reg = regions.find(r => r.name.toUpperCase() === location.region.toUpperCase());
      if (reg) {
        setSelectedRegionCode(reg.code);
      }

      // Initialize cascading values
      const locStr = location.location || "";
      const parts = locStr.includes(", ") ? locStr.split(", ") : [locStr];

      if (parts.length >= 2) {
        // We'll let the useEffects handle selecting the province and city codes
        // by matching the names from the parts
      }
      setSelectedCityName(parts[0] || "");
    } else {
      setEditingLocation(null);
      setAreaId("");
      setDistance("");
      setSelectedRegionCode("");
      setSelectedProvinceCode("");
      setSelectedCityName("");
    }
    setModalOpen(true);
  }, [regions]);

  // Handle Edit-Mode Pre-selection for Provinces
  useEffect(() => {
    if (editingLocation && provinces.length > 0 && !selectedProvinceCode) {
      const locStr = editingLocation.location || "";
      const parts = locStr.includes(", ") ? locStr.split(", ") : [];
      if (parts.length >= 2) {
        const prov = provinces.find(p => p.name.toUpperCase() === parts[1].toUpperCase());
        if (prov) {
          setSelectedProvinceCode(prov.code);
        }
      }
    }
  }, [provinces, editingLocation, selectedProvinceCode]);

  // Handle Edit-Mode Pre-selection for Cities
  useEffect(() => {
    if (editingLocation && cities.length > 0 && !selectedCityName) {
      const locStr = editingLocation.location || "";
      const parts = locStr.includes(", ") ? locStr.split(", ") : [locStr];
      const cityName = parts[0] || editingLocation.location || "";
      const city = cities.find(c => c.name.toUpperCase() === cityName.toUpperCase());
      if (city) {
        setSelectedCityName(city.name);
      }
    }
  }, [cities, editingLocation, selectedCityName]);

  const handleBulkAddInProvince = async () => {
    if (!selectedProvinceCode || !areaId) return toast.error("Please select both Area and Province.");

    const province = provinces.find(p => p.code === selectedProvinceCode);
    const region = regions.find(r => r.code === selectedRegionCode);
    if (!province || !region) return;

    // Check against both staged items and ALL ALREADY SAVED items (Global Uniqueness)
    const existingLocations = locations;

    setLoadingPSGC(true);
    try {
      const cityList = await getCitiesInProvince(selectedProvinceCode);

      // Local uniqueness filter for PSGC API results
      const uniqueCities = Array.from(new Set(cityList.map(c => c.name)))
        .map(name => cityList.find(c => c.name === name)!);

      const newItems: StagedLocation[] = uniqueCities
        .filter(c => !isDuplicateLocation(c.name, province.name, region.name, stagedLocations, existingLocations))
        .map(c => ({
          regionName: region.name,
          provinceName: province.name,
          cityName: c.name,
          distance: ""
        }));

      if (newItems.length === 0) {
        toast.info("No new unique locations found in this province for this area.");
      } else {
        setStagedLocations(prev => [...prev, ...newItems]);
        toast.success(`Staged ${newItems.length} new locations from ${province.name}.`);
      }
    } catch (error) {
      const err = error as Error;
      console.error(err);
      toast.error(err.message || "Failed to bulk add cities.");
    } finally {
      setLoadingPSGC(false);
    }
  };

  const handleBulkAddInRegion = async () => {
    if (!selectedRegionCode || !areaId) return toast.error("Please select both Area and Region.");

    const region = regions.find(r => r.code === selectedRegionCode);
    if (!region) return;

    // Global check: a location can usually only belong to one area
    const existingLocations = locations;

    setLoadingPSGC(true);
    try {
      const [cityList, provList] = await Promise.all([
        getCitiesInRegion(selectedRegionCode),
        getProvincesInRegion(selectedRegionCode)
      ]);

      // Local uniqueness filter for PSGC API results (City Name + Province Context)
      const seen = new Set();
      const uniqueCities = cityList.filter(c => {
        const provName = provList.find(p => p.code === (c.provinceCode || c.districtCode))?.name || "Independent";
        const key = `${c.name}|${provName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const newItems: StagedLocation[] = uniqueCities
        .filter(c => {
          const provinceName = provList.find(p => p.code === (c.provinceCode || c.districtCode))?.name || "Independent";
          return !isDuplicateLocation(c.name, provinceName, region.name, stagedLocations, existingLocations);
        })
        .map(c => {
          const provinceName = provList.find(p => p.code === (c.provinceCode || c.districtCode))?.name || "Independent";
          return {
            regionName: region.name,
            provinceName,
            cityName: c.name,
            distance: ""
          };
        });

      if (newItems.length === 0) {
        toast.info("No new unique locations found in this region for this area.");
      } else {
        setStagedLocations(prev => [...prev, ...newItems]);
        toast.success(`Staged ${newItems.length} locations across ${region.name}.`);
      }
    } catch (error) {
      const err = error as Error;
      console.error(err);
      toast.error(err.message || "Failed to bulk add region locations.");
    } finally {
      setLoadingPSGC(false);
    }
  };

  const handleAddToStage = () => {
    if (!selectedCityName) return toast.error("Please select a city first.");
    if (!areaId) return toast.error("Please select a Logistics Area.");

    const region = regions.find(r => r.code === selectedRegionCode);
    const province = provinces.find(p => p.code === selectedProvinceCode);
    const provinceName = province?.name || "Independent";

    // Duplicate check: Verify if already staged or already exists globally in the database
    if (isDuplicateLocation(selectedCityName, provinceName, region?.name || "", stagedLocations, locations)) {
      return toast.warning("This location is already mapped to a logistics area.");
    }

    setStagedLocations(prev => [...prev, {
      regionName: region?.name || "",
      provinceName: provinceName,
      cityName: selectedCityName,
      distance: distance
    }]);

    setSelectedCityName("");
    setDistance("");
  };

  const handleRemoveFromStage = (index: number) => {
    setStagedLocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const regionName = regions.find(r => r.code === selectedRegionCode)?.name || "";
    const entriesToSave = editingLocation
      ? [{ regionName: regionName || editingLocation.region, cityName: selectedCityName, provinceName: provinces.find(p => p.code === selectedProvinceCode)?.name || "", distance }]
      : stagedLocations;

    if (entriesToSave.length === 0 && !selectedCityName) {
      return toast.error("No locations to save.");
    }

    const finalEntries = entriesToSave.length > 0 ? entriesToSave : [{
      regionName,
      cityName: selectedCityName,
      provinceName: provinces.find(p => p.code === selectedProvinceCode)?.name || "",
      distance
    }];

    if (!areaId) return toast.error("Please select an area.");

    setSubmitting(true);
    try {
      if (editingLocation) {
        const entry = finalEntries[0];
        await patchLocation(editingLocation.id, {
          area_id: Number(areaId),
          region: entry.regionName,
          province: entry.provinceName,
          city: entry.cityName,
          distance: entry.distance ? Number(entry.distance) : null,
        });
        toast.success("Location updated successfully.");
      } else {
        let successCount = 0;
        let failCount = 0;
        let duplicateCount = 0;

        // Step 1: Fetch fresh snapshot to run composite duplicate check (city+province)
        console.log("[SAVE] Fetching fresh location snapshot...");
        let freshLocations = locations;
        try {
          const freshRes = await fetchLocations();
          freshLocations = freshRes.data || locations;
          console.log(`[SAVE] Fresh snapshot: ${freshLocations.length} records (local had ${locations.length})`);
        } catch (e) {
          console.warn("[SAVE] Fresh snapshot failed, using local state:", e);
        }

        // Step 2: Logical composite duplicate check — (city + province) uniqueness
        const validEntries: StagedLocation[] = [];
        const skippedEntries: string[] = [];
        for (const entry of finalEntries) {
          if (isDuplicateLocation(entry.cityName, entry.provinceName, entry.regionName || "", [], freshLocations, true)) {
            duplicateCount++;
            skippedEntries.push(`${entry.cityName} (${entry.provinceName})`);
          } else {
            validEntries.push(entry);
          }
        }
        console.log(`[SAVE] Validation → valid=${validEntries.length} skipped=${duplicateCount}`, skippedEntries);

        if (validEntries.length === 0) {
          setSubmitting(false);
          toast.error(`All ${duplicateCount} staged locations already exist.`);
          return;
        }
        if (skippedEntries.length > 0) {
          toast.warning(`Skipped ${skippedEntries.length} duplicate${skippedEntries.length > 1 ? "s" : ""}: ${skippedEntries.slice(0, 4).join(", ")}${skippedEntries.length > 4 ? ` +${skippedEntries.length - 4} more` : ""}`);
        }

        // Step 3: Fetch true max location_id from DB — UNIQUE KEY uq_location_id(location_id)
        // Correct Directus sort syntax: sort=-location_id (no brackets)
        let currentMaxId = freshLocations.length > 0
          ? Math.max(...freshLocations.map(l => Number(l.location_id) || 0))
          : 0;
        try {
          const maxRes = await fetch(`/api/compensation-settings?resource=location&fields=location_id&sort=-location_id&limit=1`);
          if (maxRes.ok) {
            const maxData = await maxRes.json();
            const top = maxData.data?.[0];
            if (top?.location_id) {
              currentMaxId = Number(top.location_id);
              console.log(`[SAVE] DB max location_id: ${currentMaxId}`);
            }
          }
        } catch (e) {
          console.warn("[SAVE] Max ID fetch failed, using snapshot max:", currentMaxId, e);
        }

        // Step 4: Sequential insert
        for (let i = 0; i < validEntries.length; i++) {
          const entry = validEntries[i];
          const assignedId = currentMaxId + 1 + i;
          console.log(`[SAVE] POST entry[${i}]: location_id=${assignedId} city="${entry.cityName}" province="${entry.provinceName}"`);
          try {
            await createLocation({
              location_id: assignedId,
              area_id: Number(areaId),
              region: entry.regionName.trim(),
              province: entry.provinceName.trim(),
              city: entry.cityName.trim(),
              distance: entry.distance ? Number(entry.distance) : null,
            });
            successCount++;
          } catch (error) {
            const err = error as Error;
            console.error(`[SAVE] Failed entry[${i}] location_id=${assignedId}:`, err.message);
            failCount++;
          }
        }

        if (successCount > 0) {
          toast.success(`Successfully created ${successCount} location${successCount > 1 ? "s" : ""}.`);
        }
        if (failCount > 0) {
          toast.error(`${failCount} entries failed. Check console for details.`);
        }
      }
      setModalOpen(false);
      loadData();
      setStagedLocations([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save locations.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLocations = locations.filter(l =>
    (l.location?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (l.location_id?.toString() || "").includes(searchTerm) ||
    (l.region?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (l.province?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (l.city?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  // Pagination Logic
  const totalItems = filteredLocations.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedLocations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLocations.slice(start, start + itemsPerPage);
  }, [filteredLocations, currentPage, itemsPerPage]);

  // Reset to page 1 on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getAreaName = (id: number) => {
    return areas.find(a => a.area_id === id)?.area_name || `Area ${id}`;
  };

  return (
    <div className="w-full space-y-6">
      {/* --- Filter / Action Section --- */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex-1 w-full md:max-w-md space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">
            Search Registry
          </label>
          <div className="relative group">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search Location ID, City or Area..."
              className="pl-10 h-11 bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 rounded-lg focus-visible:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              className="h-11 px-4 gap-2 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95"
              onClick={loadData}
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              className="h-11 px-5 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-95"
              onClick={() => handleOpenModal()}
            >
              <Plus className="h-4 w-4" />
              Add Locations
            </Button>
          </div>
        </div>
      </div>

      {/* --- Table Section --- */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <TableRow>
                <TableHead className="font-bold text-[11px] uppercase tracking-widest text-gray-500 px-6 py-4">ID</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-widest text-gray-500 px-6 py-4">Area Attachment</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-widest text-gray-500 px-6 py-4">Region</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-widest text-gray-500 px-6 py-4">Geographic Scope</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-widest text-gray-500 px-6 py-4">Logistics Radius</TableHead>
                <TableHead className="font-bold text-[11px] uppercase tracking-widest text-gray-500 px-6 py-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="h-16 animate-pulse bg-gray-50/30 dark:bg-gray-800/30" />
                  </TableRow>
                ))
              ) : filteredLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-gray-400 space-y-2">
                    <Globe className="h-10 w-10 mx-auto opacity-20" />
                    <p className="text-sm font-medium">No logistics locations mapped yet.</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLocations.map((loc) => (
                  <TableRow key={loc.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800">
                    <TableCell className="px-6 font-mono text-xs text-gray-500">#{loc.location_id}</TableCell>
                    <TableCell className="px-6">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-tighter">
                          {getAreaName(loc.area_id)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <LayoutTemplate className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-tight">
                          {loc.region || 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                            {loc.city || loc.location?.split(', ')[0] || 'Unknown Location'}
                          </span>
                          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tight opacity-70">
                            {loc.province || loc.location?.split(', ')[1] || 'Global / Unassigned'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                      {loc.distance ? (
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <Navigation className="h-3 w-3 text-primary opacity-60" />
                          <span className="text-sm font-medium">{loc.distance} <small className="text-[10px] opacity-60">KM</small></span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl border-gray-200 dark:border-gray-700 shadow-xl">
                          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 py-1">Management</DropdownMenuLabel>
                          <Separator className="my-1 opacity-50" />
                          <DropdownMenuItem onClick={() => handleOpenModal(loc)} className="gap-2.5 cursor-pointer rounded-lg px-2 py-2 text-sm font-medium">
                            <Pencil className="h-3.5 w-3.5 text-blue-500" /> Edit Configuration
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(loc.id)} className="gap-2.5 cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/30">
                            <Trash2 className="h-3.5 w-3.5" /> Remove Archive
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

        {/* --- Pagination Footer --- */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Rows per page</span>
              <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                <SelectTrigger className="h-8 w-[70px] text-xs border-gray-200 dark:border-gray-700">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map(size => (
                    <SelectItem key={size} value={size.toString()} className="text-xs">{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs font-medium text-gray-400 border-l border-gray-100 dark:border-gray-800 pl-4">
              Showing <span className="text-gray-900 dark:text-gray-100">{totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="text-gray-900 dark:text-gray-100">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-gray-900 dark:text-gray-100">{totalItems}</span> entries
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-700 disabled:opacity-30"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-700 disabled:opacity-30"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 mx-1">
              <span className="text-xs font-bold text-gray-400">Page</span>
              <span className="text-xs font-bold text-primary">{currentPage}</span>
              <span className="text-xs font-bold text-gray-400 text-[10px]">of {totalPages || 1}</span>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-700 disabled:opacity-30"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-700 disabled:opacity-30"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* --- Modal Section --- */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-5xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl flex flex-col md:flex-row min-h-[400px] h-[85vh] max-h-[700px]">
          {/* Left Side: Configuration Form */}
          <div className="flex-[1.3] flex flex-col min-w-0 bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800">
            {/* Panel Header */}
            <div className="p-6 pb-4 border-b border-gray-50 dark:border-gray-900 flex items-center gap-3 bg-white dark:bg-gray-950">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  {editingLocation ? "Configure Location" : "Map New Locations"}
                </DialogTitle>
                <DialogDescription className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Logistics Geographic Parameters
                </DialogDescription>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
              {/* Area Attachment */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between mb-0.5">
                  <Label htmlFor="areaId" className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-0.5">
                    Logistics Area Attachment *
                  </Label>
                </div>
                <Select value={areaId} onValueChange={setAreaId} required>
                  <SelectTrigger id="areaId" className="bg-gray-50/50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 h-11 transition-all focus:ring-primary/20">
                    <SelectValue placeholder="Select Target Area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map(area => (
                      <SelectItem key={area.area_id} value={area.area_id.toString()} className="rounded-lg my-0.5">
                        <div className="flex items-center w-full gap-4 pr-6">
                          <span className="font-semibold shrink-0">{area.area_name}</span>
                          <span className="flex-1 text-right text-[10px] font-black uppercase tracking-widest text-gray-400/60 transition-colors group-hover:text-primary">
                            {area.mode_type || 'STANDARD'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator className="opacity-40" />

              {/* PSGC Hierarchy */}
              <div className="space-y-5 bg-gray-50/30 dark:bg-gray-900/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
                {/* Region Selection */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-3.5 w-3.5 text-primary" />
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Island Group / Region *</Label>
                    </div>
                    {!editingLocation && selectedRegionCode && !selectedProvinceCode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 gap-1.5 rounded-full"
                        onClick={handleBulkAddInRegion}
                        disabled={loadingPSGC}
                      >
                        <LibraryBig className="h-3 w-3" />
                        Select All
                      </Button>
                    )}
                  </div>
                  <Select value={selectedRegionCode} onValueChange={handleRegionChange} disabled={loadingPSGC}>
                    <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm">
                      <SelectValue placeholder={loadingPSGC ? "Fetching regions..." : "Select Region"} />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map(r => (
                        <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Province */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-primary" />
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Province</Label>
                      </div>
                      {!editingLocation && selectedRegionCode && !selectedProvinceCode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[9px] font-black text-amber-600 hover:bg-amber-100/50 gap-1 rounded-full uppercase"
                          onClick={handleBulkAddInProvince}
                          disabled={loadingPSGC}
                        >
                          SELECT ALL PROVINCE
                        </Button>
                      )}
                    </div>
                    <Select value={selectedProvinceCode} onValueChange={handleProvinceChange} disabled={!selectedRegionCode || loadingPSGC}>
                      <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm">
                        <SelectValue placeholder="Province" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map(p => (
                          <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* City */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">City / Mun *</Label>
                      </div>
                      {!editingLocation && selectedProvinceCode && !selectedCityName && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[9px] font-black text-amber-600 hover:bg-amber-100/50 gap-1 rounded-full uppercase"
                          onClick={handleBulkAddInProvince}
                          disabled={loadingPSGC}
                        >
                          SELECT ALL CITIES
                        </Button>
                      )}
                    </div>
                    <Select value={selectedCityName} onValueChange={setSelectedCityName} disabled={!selectedProvinceCode || loadingPSGC}>
                      <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm">
                        <SelectValue placeholder="City" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map(c => (
                          <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Distance */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    <Label htmlFor="distance" className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Distance (KM)</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="distance"
                      type="number"
                      className="h-11 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm focus-visible:ring-primary/20 pr-10"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                    />
                    <span className="absolute right-3 top-3.5 text-[9px] font-black text-gray-300">KM</span>
                  </div>
                </div>

                {!editingLocation && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 gap-2 bg-primary/5 hover:bg-primary/10 text-primary border-primary/10 font-bold rounded-xl active:scale-95 transition-all mt-2"
                    onClick={handleAddToStage}
                  >
                    <Plus className="h-4 w-4" />
                    Stage Location
                  </Button>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 py-4 bg-gray-50/50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 shrink-0">
              <Button variant="ghost" onClick={() => setModalOpen(false)} className="h-10 px-6 font-bold text-gray-500 hover:bg-gray-200/50">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={submitting || (editingLocation ? !selectedCityName : stagedLocations.length === 0 && !selectedCityName)}
                className="h-10 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                {submitting ? (
                  <RefreshCcw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingLocation ? "Apply Changes" : `Commit ${stagedLocations.length > 0 ? stagedLocations.length : 1} Locations`}
              </Button>
            </div>
          </div>

          {/* Right Side: Staged Entries List */}
          {!editingLocation && (
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50 dark:bg-gray-900/30">
              <div className="p-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/40 dark:bg-gray-950/20">
                <div className="flex items-center gap-2.5">
                  <ListOrdered className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Staged Entries</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none rounded-full h-5 text-[10px] font-black px-2">
                    {stagedLocations.length}
                  </Badge>
                </div>
                {stagedLocations.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5"
                    onClick={() => setStagedLocations([])}
                  >
                    <Eraser className="h-3 w-3" />
                    Clear All
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                {stagedLocations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-300 dark:text-gray-700 py-20">
                    <MapPin className="h-12 w-12 opacity-20 mb-4" />
                    <p className="text-[10px] uppercase font-bold tracking-widest">
                      Ready to batch map<br />Add locations to start
                    </p>
                  </div>
                ) : (
                  stagedLocations.map((item, idx) => (
                    <div key={idx} className="group flex items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:ring-1 hover:ring-primary/20">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate pr-2">
                          {item.cityName}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter truncate">
                          {item.provinceName} • {item.regionName}
                        </span>
                        {item.distance && Number(item.distance) > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-primary">
                            <Navigation className="h-2 w-2 opacity-70" />
                            <span className="text-[9px] font-black">{item.distance} KM</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFromStage(idx)}
                        className="h-7 w-7 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

