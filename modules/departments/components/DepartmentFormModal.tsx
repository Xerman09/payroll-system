import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

import type { Department, UserLookup } from "../types";
import * as departmentApi from "../providers/departmentApi";

interface DepartmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  allDepartments: Department[];
  allUsers: UserLookup[];
  onSaved: () => void;
  isReadOnly?: boolean;
}

export default function DepartmentFormModal({
  open,
  onOpenChange,
  department,
  allDepartments,
  allUsers,
  onSaved,
  isReadOnly = false,
}: DepartmentFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Department>>({});

  useEffect(() => {
    if (open) {
      if (department) {
        setFormData(department);
      } else {
        setFormData({
          department_name: "",
          parent_division: 0,
          department_description: "",
          department_head: "",
          department_head_id: null,
          tax_id: null,
          date_added: new Date().toISOString().split("T")[0],
        });
      }
    }
  }, [open, department]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value === "" ? null : value }));
  };

  const handleHeadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value ? Number(e.target.value) : null;
    let headName = null;
    if (id) {
      const u = allUsers.find(user => user.user_id === id);
      if (u) headName = `${u.user_fname} ${u.user_lname}`;
    }
    setFormData((prev) => ({
      ...prev,
      department_head_id: id,
      department_head: headName,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaving(true);
    
    // ensure numeric types
    const payload = {
      ...formData,
      parent_division: formData.parent_division ? Number(formData.parent_division) : 0,
      tax_id: formData.tax_id ? Number(formData.tax_id) : null,
    };

    try {
      if (department?.department_id) {
        await departmentApi.updateDepartment(department.department_id, payload);
        toast.success("Department updated successfully");
      } else {
        await departmentApi.createDepartment(payload);
        toast.success("Department created successfully");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save department");
    } finally {
      setSaving(false);
    }
  };

  // Prevent circular dependency in parent division
  const availableParents = allDepartments.filter(d => 
    !department || d.department_id !== department.department_id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>
              {department
                ? (isReadOnly ? `View Department: ${department.department_name}` : `Edit Department: ${department.department_name}`)
                : "Add New Department"}
            </span>
            {isReadOnly && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                Read-Only
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <fieldset disabled={isReadOnly} className="space-y-4 border-none p-0 m-0">
            <div className="space-y-2">
              <Label>Department Name *</Label>
              <Input name="department_name" value={formData.department_name || ""} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                name="department_description" 
                value={formData.department_description || ""} 
                onChange={handleChange} 
                rows={3} 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Parent Division</Label>
                <select 
                  name="parent_division" 
                  value={formData.parent_division || 0} 
                  onChange={handleChange} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={0}>None (Root level)</option>
                  {availableParents.map(d => (
                    <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Department Head</Label>
                <select 
                  name="department_head_id" 
                  value={formData.department_head_id || ""} 
                  onChange={handleHeadChange} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {allUsers.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.user_lname}, {u.user_fname} {u.user_mname?.charAt(0) || ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Tax ID</Label>
                <Input type="number" name="tax_id" value={formData.tax_id || ""} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label>Date Added</Label>
                <Input type="date" name="date_added" value={formData.date_added?.substring(0, 10) || ""} onChange={handleChange} />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isReadOnly ? "Close" : "Cancel"}
            </Button>
            {!isReadOnly && (
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Department"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
