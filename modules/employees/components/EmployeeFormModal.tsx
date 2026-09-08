import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, MapPin, Briefcase, BadgeCheck, Loader2, PiggyBank, Trash2 } from "lucide-react";

import type { Employee, Department, EmploymentStatus, BankName, UserBank } from "../types";
import type { PSGCRegion, PSGCProvince, PSGCCityMunicipality, PSGCBarangay } from "../../compensation-settings/types";
import { getAllProvincesAndDistricts, getCitiesInProvince, getBarangaysInCity } from "../../compensation-settings/utils/psgcApi";
import * as employeeApi from "../providers/employeeApi";

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  departments: Department[];
  employmentStatuses: EmploymentStatus[];
  onSaved: () => void;
  isReadOnly?: boolean;
}

export default function EmployeeFormModal({
  open,
  onOpenChange,
  employee,
  departments,
  employmentStatuses,
  onSaved,
  isReadOnly = false,
}: EmployeeFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({});

  // PSGC State
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);
  const [cities, setCities] = useState<PSGCCityMunicipality[]>([]);
  const [barangays, setBarangays] = useState<PSGCBarangay[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedCityCode, setSelectedCityCode] = useState("");

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // Bank State
  const [bankNames, setBankNames] = useState<BankName[]>([]);
  const [userBanks, setUserBanks] = useState<UserBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [newBankId, setNewBankId] = useState("");
  const [newBankAcct, setNewBankAcct] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoadingProvinces(true);
    getAllProvincesAndDistricts()
      .then(res => {
        if (mounted) setProvinces(res);
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoadingProvinces(false);
      });
    return () => { mounted = false; };
  }, []);

  // When a new employee is selected, reset PSGC selections so they can re-select from top
  useEffect(() => {
    if (open) {
      setSelectedProvinceCode("");
      setSelectedCityCode("");
      setCities([]);
      setBarangays([]);

      if (employee) {
        setFormData(employee);
      } else {
        setFormData({
          user_fname: "",
          user_lname: "",
          user_mname: "",
          user_email: "",
          user_contact: "",
          user_position: "",
          is_employee: 1, // default true
          is_deleted: 0,
        });
      }
    }
  }, [open, employee]);

  useEffect(() => {
    const mounted = true;
    if (open) {
      setLoadingBanks(true);
      Promise.all([
        employeeApi.fetchBankNames(),
        employee?.user_id ? employeeApi.fetchUserBanks(employee.user_id) : Promise.resolve([])
      ]).then(([bn, ub]) => {
        if (mounted) {
          setBankNames(bn);
          setUserBanks(ub);
        }
      }).catch(console.error).finally(() => {
        if (mounted) setLoadingBanks(false);
      });
    }
  }, [open, employee?.user_id]);

  // Reverse lookup to populate cascading dropdowns automatically when editing
  useEffect(() => {
    if (open && formData.user_province && provinces.length > 0 && !selectedProvinceCode) {
      const pMatch = provinces.find(p => p.name === formData.user_province);
      if (pMatch) {
        setSelectedProvinceCode(pMatch.code);
        setLoadingCities(true);
        getCitiesInProvince(pMatch.code).then(cRes => {
          setCities(cRes);
          if (formData.user_city) {
            const cMatch = cRes.find(c => c.name === formData.user_city);
            if (cMatch) {
              setSelectedCityCode(cMatch.code);
              setLoadingBarangays(true);
              getBarangaysInCity(cMatch.code).then(bRes => {
                setBarangays(bRes);
              }).finally(() => setLoadingBarangays(false));
            }
          }
        }).finally(() => setLoadingCities(false));
      }
    }
  }, [open, formData.user_province, provinces, selectedProvinceCode, formData.user_city]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked ? 1 : 0 }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value === "" ? null : value }));
    }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedProvinceCode(code);
    setSelectedCityCode("");
    setCities([]);
    setBarangays([]);
    const name = e.target.options[e.target.selectedIndex].text;
    setFormData(prev => ({ ...prev, user_province: code ? name : null, user_city: null, user_brgy: null }));
    if (!code) return;

    setLoadingCities(true);
    try {
      const data = await getCitiesInProvince(code);
      setCities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCities(false);
    }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedCityCode(code);
    setBarangays([]);
    const name = e.target.options[e.target.selectedIndex].text;
    setFormData(prev => ({ ...prev, user_city: code ? name : null, user_brgy: null }));
    if (!code) return;

    setLoadingBarangays(true);
    try {
      const data = await getBarangaysInCity(code);
      setBarangays(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBarangays(false);
    }
  };

  const handleBrgyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setFormData(prev => ({ ...prev, user_brgy: code ? name : null }));
  };

  const handleAddBank = async () => {
    if (isReadOnly || !employee?.user_id || !newBankId || !newBankAcct) return;
    try {
      setSaving(true);
      const isFirst = userBanks.length === 0;
      const created = await employeeApi.createUserBank({
        user_id: employee.user_id,
        bank_id: Number(newBankId),
        account_number_hash: newBankAcct,
        is_active: isFirst ? 1 : 0
      });
      const bMatch = bankNames.find(b => b.id === Number(newBankId));
      setUserBanks(prev => [...prev, { ...created, bank: bMatch }]);
      setNewBankId("");
      setNewBankAcct("");
      toast.success("Bank account added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add bank");
    } finally {
      setSaving(false);
    }
  };

  const handleSetBankActive = async (ub: UserBank) => {
    if (isReadOnly || !ub.id || !employee?.user_id) return;
    try {
      setSaving(true);
      const others = userBanks.filter(b => b.id !== ub.id && (b.is_active === 1 || b.is_active === true));
      for (const o of others) {
        if (o.id) await employeeApi.updateUserBank(o.id, { is_active: 0 });
      }
      await employeeApi.updateUserBank(ub.id, { is_active: 1 });
      
      setUserBanks(prev => prev.map(b => ({
        ...b,
        is_active: b.id === ub.id ? 1 : 0
      })));
      toast.success("Active bank updated");
    } catch (err: any) {
      toast.error("Failed to update active bank");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBank = async (id: number) => {
    if (isReadOnly) return;
    try {
      setSaving(true);
      await employeeApi.deleteUserBank(id);
      setUserBanks(prev => prev.filter(b => b.id !== id));
      toast.success("Bank account deleted");
    } catch(err: any) {
      toast.error("Failed to delete bank");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setSaving(true);
    try {
      if (employee?.user_id) {
        await employeeApi.updateEmployee(employee.user_id, formData);
        toast.success("Employee updated successfully");
      } else {
        await employeeApi.createEmployee(formData);
        toast.success("Employee created successfully");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>
              {employee
                ? (isReadOnly ? `View Employee: ${employee.user_fname} ${employee.user_lname}` : `Edit Employee: ${employee.user_fname} ${employee.user_lname}`)
                : "Add New Employee"}
            </span>
            {isReadOnly && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                Read-Only
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="personal" className="flex gap-2">
                <User className="h-4 w-4" /> Personal
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex gap-2">
                <MapPin className="h-4 w-4" /> Contact
              </TabsTrigger>
              <TabsTrigger value="job" className="flex gap-2">
                <Briefcase className="h-4 w-4" /> Job
              </TabsTrigger>
              <TabsTrigger value="ids" className="flex gap-2">
                <BadgeCheck className="h-4 w-4" /> IDs & Extras
              </TabsTrigger>
              <TabsTrigger value="banks" className="flex gap-2">
                <PiggyBank className="h-4 w-4" /> Banks
              </TabsTrigger>
            </TabsList>

            {/* Personal Tab */}
            <TabsContent value="personal">
              <fieldset disabled={isReadOnly} className="space-y-4 border-none p-0 m-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input name="user_fname" value={formData.user_fname || ""} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Middle Name</Label>
                    <Input name="user_mname" value={formData.user_mname || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input name="user_lname" value={formData.user_lname || ""} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Suffix</Label>
                    <Input name="suffix_name" value={formData.suffix_name || ""} onChange={handleChange} placeholder="e.g. Jr., III" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nickname</Label>
                    <Input name="nickname" value={formData.nickname || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Birth Date</Label>
                    <Input type="date" name="user_bday" value={formData.user_bday?.substring(0, 10) || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <select name="gender" value={formData.gender || ""} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Civil Status</Label>
                    <select name="civil_status" value={formData.civil_status || ""} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Select</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nationality</Label>
                    <Input name="nationality" value={formData.nationality || ""} onChange={handleChange} />
                  </div>
                </div>
              </fieldset>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact">
              <fieldset disabled={isReadOnly} className="space-y-4 border-none p-0 m-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" name="user_email" value={formData.user_email || ""} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Number *</Label>
                    <Input name="user_contact" value={formData.user_contact || ""} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Province / District {loadingProvinces && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}</Label>
                    <select 
                      value={selectedProvinceCode} 
                      onChange={handleProvinceChange} 
                      disabled={loadingProvinces || isReadOnly}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {employee && formData.user_province && (
                        <option value="">{formData.user_province} (Current)</option>
                      )}
                      <option value="">Select Province / District</option>
                      {provinces.map(p => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>City / Municipality {loadingCities && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}</Label>
                    <select 
                      value={selectedCityCode} 
                      onChange={handleCityChange} 
                      disabled={!selectedProvinceCode || loadingCities || isReadOnly}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {employee && formData.user_city && !selectedProvinceCode && (
                        <option value="">{formData.user_city} (Current)</option>
                      )}
                      <option value="">Select City / Municipality</option>
                      {cities.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Barangay {loadingBarangays && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}</Label>
                    <select 
                      onChange={handleBrgyChange} 
                      disabled={!selectedCityCode || loadingBarangays || isReadOnly}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {employee && formData.user_brgy && !selectedCityCode && (
                        <option value="">{formData.user_brgy} (Current)</option>
                      )}
                      <option value="">Select Barangay</option>
                      {barangays.map(b => (
                        <option key={b.code} value={b.code}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Emergency Contact Name</Label>
                    <Input name="emergency_contact_name" value={formData.emergency_contact_name || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Emergency Contact Number</Label>
                    <Input name="emergency_contact_number" value={formData.emergency_contact_number || ""} onChange={handleChange} />
                  </div>
                </div>
              </fieldset>
            </TabsContent>

            {/* Job Tab */}
            <TabsContent value="job">
              <fieldset disabled={isReadOnly} className="space-y-4 border-none p-0 m-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <select name="user_department" value={formData.user_department || ""} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Position *</Label>
                    <Input name="user_position" value={formData.user_position || ""} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Hire</Label>
                    <Input type="date" name="user_dateOfHire" value={formData.user_dateOfHire?.substring(0, 10) || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Employment Status</Label>
                    <select name="employment_status_id" value={formData.employment_status_id || ""} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Select Status</option>
                      {employmentStatuses.map(s => <option key={s.id} value={s.id}>{s.status_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 flex items-center gap-2 mt-6">
                    <Input type="checkbox" id="is_deleted" name="is_deleted" checked={formData.is_deleted === 1 || formData.is_deleted === true} onChange={handleChange} className="w-4 h-4" />
                    <Label htmlFor="is_deleted" className="text-red-500 font-medium cursor-pointer">Mark as Inactive / Deleted</Label>
                  </div>
                </div>
              </fieldset>
            </TabsContent>

            {/* IDs Tab */}
            <TabsContent value="ids">
              <fieldset disabled={isReadOnly} className="space-y-4 border-none p-0 m-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SSS Number</Label>
                    <Input name="user_sss" value={formData.user_sss || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>PhilHealth Number</Label>
                    <Input name="user_philhealth" value={formData.user_philhealth || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pag-IBIG Number</Label>
                    <Input name="user_pagibig" value={formData.user_pagibig || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>TIN Number</Label>
                    <Input name="user_tin" value={formData.user_tin || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Biometric ID</Label>
                    <Input name="biometric_id" value={formData.biometric_id || ""} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>RF ID</Label>
                    <Input name="rf_id" value={formData.rf_id || ""} onChange={handleChange} />
                  </div>
                </div>
              </fieldset>
            </TabsContent>

            {/* Banks Tab */}
            <TabsContent value="banks" className="space-y-4">
              {!employee?.user_id ? (
                <div className="text-center p-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
                  Please save the employee first to add bank accounts.
                </div>
              ) : (
                <div className="space-y-6">
                  {!isReadOnly && (
                    <div className="bg-muted/50 p-4 rounded-lg border flex flex-col md:flex-row items-end gap-4">
                      <div className="space-y-2 flex-1 w-full">
                        <Label>Bank Name</Label>
                        <select value={newBankId} onChange={e => setNewBankId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">Select Bank</option>
                          {bankNames.map(b => (
                            <option key={b.id} value={b.id}>{b.bank_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2 flex-1 w-full">
                        <Label>Account Number</Label>
                        <Input value={newBankAcct} onChange={e => setNewBankAcct(e.target.value)} placeholder="Enter account number..." />
                      </div>
                      <Button type="button" onClick={handleAddBank} disabled={!newBankId || !newBankAcct || saving} className="w-full md:w-auto">
                        Add Bank
                      </Button>
                    </div>
                  )}

                  {loadingBanks ? (
                    <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : userBanks.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">
                      No bank accounts added yet.
                    </div>
                  ) : (
                    <div className="border rounded-md divide-y">
                      {userBanks.map(ub => (
                        <div key={ub.id} className="flex items-center justify-between p-4 bg-card">
                          <div>
                            <p className="font-medium">{ub.bank?.bank_name || `Bank ID: ${ub.bank_id}`}</p>
                            <p className="text-sm text-muted-foreground">{ub.account_number_hash}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            {ub.is_active === 1 || ub.is_active === true ? (
                              <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">Active</span>
                            ) : !isReadOnly ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => handleSetBankActive(ub)} disabled={saving}>
                                Set Active
                              </Button>
                            ) : null}
                            {!isReadOnly && (
                              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => ub.id && handleDeleteBank(ub.id)} disabled={saving || ub.is_active === 1 || ub.is_active === true}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isReadOnly ? "Close" : "Cancel"}
            </Button>
            {!isReadOnly && (
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Employee"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
