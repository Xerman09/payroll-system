"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ShieldCheck, Lock, Check, X, AlertCircle } from "lucide-react";
import { updatePassword, verifyCurrentPassword } from "../providers/profileApi";
import { toast } from "sonner";

interface SecuritySettingsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
}

export function SecuritySettings({ user }: SecuritySettingsProps) {
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordValidation = useMemo(() => {
    return {
      length: newPassword.length >= 15 && newPassword.length <= 64,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      digit: /\d/.test(newPassword),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?`~]/.test(newPassword),
    };
  }, [newPassword]);

  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      toast.error("New password does not meet security requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // 1. Verify current password
      const isVerified = await verifyCurrentPassword(user.user_email, currentPassword);
      if (!isVerified) {
        toast.error("Incorrect current password.");
        setLoading(false);
        return;
      }

      // 2. Update password
      await updatePassword(user.user_id, newPassword);
      toast.success("Password updated successfully!");
      
      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const Requirement = ({ label, met }: { label: string; met: boolean }) => (
    <div className={`flex items-center gap-2 text-xs font-semibold ${met ? "text-emerald-500" : "text-gray-400"}`}>
      {met ? <Check size={14} className="stroke-[3]" /> : <X size={14} className="stroke-[3]" />}
      <span>{label}</span>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6">
      <div className="flex items-center gap-2 text-amber-600">
        <Lock size={18} />
        <h3 className="font-bold uppercase tracking-wider text-sm">Update Password</h3>
      </div>

      <div className="space-y-4">
        {/* Current Password */}
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <div className="relative">
            <Input 
              id="currentPassword" 
              type={showCurrent ? "text" : "password"} 
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required 
              className="pr-10"
            />
            <button 
              type="button" 
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Separator />

        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <Input 
              id="newPassword" 
              type={showNew ? "text" : "password"} 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required 
              className="pr-10"
            />
            <button 
              type="button" 
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Input 
              id="confirmPassword" 
              type={showConfirm ? "text" : "password"} 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required 
              className="pr-10"
            />
            <button 
              type="button" 
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Validation Checklist */}
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-2 border border-gray-100 dark:border-gray-700">
        <h4 className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-2 flex items-center gap-1.5">
          <ShieldCheck size={12} />
          Security Requirements
        </h4>
        <div className="grid grid-cols-1 gap-1.5">
          <Requirement label="15-64 Characters long" met={passwordValidation.length} />
          <Requirement label="At least one uppercase letter" met={passwordValidation.uppercase} />
          <Requirement label="At least one lowercase letter" met={passwordValidation.lowercase} />
          <Requirement label="At least one digit" met={passwordValidation.digit} />
          <Requirement label="At least one special character" met={passwordValidation.special} />
        </div>
      </div>

      {newPassword && confirmPassword && newPassword !== confirmPassword && (
        <div className="flex items-center gap-2 text-red-500 text-xs font-semibold animate-pulse">
            <AlertCircle size={14} />
            <span>Passwords do not match</span>
        </div>
      )}

      <Button 
        type="submit" 
        disabled={loading || !isPasswordValid || newPassword !== confirmPassword}
        className="w-full bg-gray-900 dark:bg-amber-600 hover:bg-black dark:hover:bg-amber-700 text-white font-bold h-12 rounded-lg shadow-xl active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-[10px]"
      >
        {loading ? "Verifying & Updating..." : "Update Password"}
      </Button>
    </form>
  );
}

function Separator() {
    return <div className="h-px bg-gray-100 dark:bg-gray-800 w-full my-4" />;
}
