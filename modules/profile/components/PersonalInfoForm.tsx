"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, User, MapPin, IdCard, Heart } from "lucide-react";
import { updateUserProfile } from "../providers/profileApi";
import { toast } from "sonner";

interface PersonalInfoFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  onRefresh: () => void;
}

export function PersonalInfoForm({ user, onRefresh }: PersonalInfoFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    user_fname: user?.user_fname || "",
    user_mname: user?.user_mname || "",
    user_lname: user?.user_lname || "",
    suffix_name: user?.suffix_name || "",
    user_email: user?.user_email || "",
    user_contact: user?.user_contact || "",
    user_province: user?.user_province || "",
    user_city: user?.user_city || "",
    user_brgy: user?.user_brgy || "",
    gender: user?.gender || "",
    civil_status: user?.civil_status || "",
    nationality: user?.nationality || "",
    citizenship: user?.citizenship || "",
    place_of_birth: user?.place_of_birth || "",
    blood_type: user?.blood_type || "",
    religion: user?.religion || "",
    spouse_name: user?.spouse_name || "",
    user_sss: user?.user_sss || "",
    user_philhealth: user?.user_philhealth || "",
    user_tin: user?.user_tin || "",
    user_pagibig: user?.user_pagibig || "",
    emergency_contact_name: user?.emergency_contact_name || "",
    emergency_contact_number: user?.emergency_contact_number || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateUserProfile(user.user_id, formData);
      toast.success("Personal information updated successfully!");
      onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update information.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <User size={18} />
          <h3 className="font-bold uppercase tracking-wider text-sm">Basic Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user_fname">First Name</Label>
            <Input id="user_fname" value={formData.user_fname} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_mname">Middle Name</Label>
            <Input id="user_mname" value={formData.user_mname} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_lname">Last Name</Label>
            <Input id="user_lname" value={formData.user_lname} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suffix_name">Suffix</Label>
            <Input id="suffix_name" placeholder="Jr, III, etc." value={formData.suffix_name} onChange={handleChange} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user_email">Email Address</Label>
            <Input id="user_email" type="email" value={formData.user_email} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_contact">Contact Number</Label>
            <Input id="user_contact" value={formData.user_contact} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={formData.gender} onValueChange={(v) => handleSelectChange("gender", v)}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="civil_status">Civil Status</Label>
            <Select value={formData.civil_status} onValueChange={(v) => handleSelectChange("civil_status", v)}>
              <SelectTrigger id="civil_status">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Single">Single</SelectItem>
                <SelectItem value="Married">Married</SelectItem>
                <SelectItem value="Widowed">Widowed</SelectItem>
                <SelectItem value="Separated">Separated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nationality">Nationality</Label>
            <Input id="nationality" value={formData.nationality} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizenship">Citizenship</Label>
            <Input id="citizenship" value={formData.citizenship} onChange={handleChange} />
          </div>
        </div>
      </section>

      <Separator />

      {/* Address Information */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <MapPin size={18} />
          <h3 className="font-bold uppercase tracking-wider text-sm">Address Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user_brgy">Barangay</Label>
            <Input id="user_brgy" value={formData.user_brgy} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_city">City/Municipality</Label>
            <Input id="user_city" value={formData.user_city} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_province">Province</Label>
            <Input id="user_province" value={formData.user_province} onChange={handleChange} required />
          </div>
        </div>
      </section>

      <Separator />

      {/* Government IDs */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <IdCard size={18} />
          <h3 className="font-bold uppercase tracking-wider text-sm">Government Identifiers</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user_sss">SSS No.</Label>
            <Input id="user_sss" placeholder="00-0000000-0" value={formData.user_sss} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_philhealth">PhilHealth No.</Label>
            <Input id="user_philhealth" placeholder="00-000000000-0" value={formData.user_philhealth} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_tin">TIN No.</Label>
            <Input id="user_tin" placeholder="000-000-000-000" value={formData.user_tin} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_pagibig">Pag-IBIG No.</Label>
            <Input id="user_pagibig" placeholder="0000-0000-0000" value={formData.user_pagibig} onChange={handleChange} />
          </div>
        </div>
      </section>

      <Separator />

      {/* Emergency Contact */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <Heart size={18} />
          <h3 className="font-bold uppercase tracking-wider text-sm">Emergency Contact</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emergency_contact_name">Contact Person</Label>
            <Input id="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergency_contact_number">Contact Number</Label>
            <Input id="emergency_contact_number" value={formData.emergency_contact_number} onChange={handleChange} />
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-4">
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 rounded-lg shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm font-bold uppercase tracking-widest gap-2"
        >
          {loading ? "Saving Changes..." : <><Save size={18} /> Save Information</>}
        </Button>
      </div>
    </form>
  );
}
