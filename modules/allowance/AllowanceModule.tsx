"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AllowanceTable from "./components/AllowanceTable";
import AddAllowanceDialog from "./components/AddAllowanceDialog";

import type { Allowance } from "./types";

const BASE_API = "http://100.126.246.124:8060";

export default function AllowanceModule() {
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<Allowance | null>(null);

  const fetchAllowances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_API}/items/employee_allowance`);
      const json = await res.json();
      // expected shape: { data: [ ... ] }
      setAllowances(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error("fetch allowances error", err);
      alert("Failed to fetch allowances");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllowances();
  }, [fetchAllowances]);

  const handleOpenAdd = () => {
    setEditing(null);
    setOpenAdd(true);
  };
  const handleOpenEdit = (row: Allowance) => {
    setEditing(row);
    setOpenAdd(true);
  };

  const handleSaved = async () => {
    // refresh list after create/update
    await fetchAllowances();
    setOpenAdd(false);
  };

  const handleDeleted = async () => {
    await fetchAllowances();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Allowance List</CardTitle>
            <div className="flex gap-2">
              <Button onClick={handleOpenAdd}>+ Add Allowance</Button>
            </div>
          </CardHeader>
          <CardContent>
            <AllowanceTable
              loading={loading}
              data={allowances}
              onEdit={handleOpenEdit}
              onDeleteComplete={handleDeleted}
            />
          </CardContent>
        </Card>
      </div>

      <AddAllowanceDialog
        open={openAdd}
        onOpenChange={setOpenAdd}
        onSaved={handleSaved}
        initialData={editing ?? undefined}
      />
    </DashboardLayout>
  );
}
