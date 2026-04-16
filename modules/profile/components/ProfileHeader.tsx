"use client";

import React, { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { uploadProfileImage, updateUserProfile } from "../providers/profileApi";
import { toast } from "sonner";
import { ImageCropModal } from "./ImageCropModal";

interface ProfileHeaderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  onRefresh: () => void;
}

const NEXT_PUBLIC_DIRECTUS_URL = process.env.NEXT_PUBLIC_DIRECTUS_URL || "";

export function ProfileHeader({ user, onRefresh }: ProfileHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [tempImageSource, setTempImageSource] = useState<string | null>(null);

  // Construct image URL from Directus file ID
  const imageUrl = user?.user_image 
    ? (user.user_image.startsWith('http') ? user.user_image : `${NEXT_PUBLIC_DIRECTUS_URL}/assets/${user.user_image}`)
    : "/profile.jpg";

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSource(reader.result as string);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsCropping(false);
    setUploading(true);
    
    try {
      // Directus prefers a File object for multipart uploads
      const file = new File([croppedBlob], "profile_avatar.png", { type: "image/png" });
      
      const fileData = await uploadProfileImage(file);
      await updateUserProfile(user.user_id, { user_image: fileData.id });
      
      // Update local storage to reflect change in navbar immediately
      const localUser = JSON.parse(localStorage.getItem("user") || "{}");
      localUser.user_image = `${NEXT_PUBLIC_DIRECTUS_URL}/assets/${fileData.id}`;
      localStorage.setItem("user", JSON.stringify(localUser));

      toast.success("Profile picture updated successfully!");
      onRefresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload image.");
    } finally {
      setUploading(false);
      setTempImageSource(null);
    }
  };

  return (
    <div className="relative mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="relative">
          <Avatar className="h-28 w-28 border-4 border-white dark:border-gray-800 shadow-xl ring-1 ring-gray-200 dark:ring-gray-700">
            <AvatarImage src={imageUrl} className="object-cover" />
            <AvatarFallback className="text-3xl font-bold bg-primary/5 dark:bg-primary/10 text-primary">
              {user?.user_fname?.[0]}{user?.user_lname?.[0]}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-1 left-1 h-6 w-6 rounded-full bg-green-500 ring-4 ring-white dark:ring-gray-900 shadow-lg shadow-green-500/40 z-10"></span>
        </div>
          
          <button 
            onClick={handleImageClick}
            disabled={uploading}
            className="absolute bottom-1 right-1 h-9 w-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />
        </div>

        <div className="text-center md:text-left space-y-0.5">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {user?.user_fname} {user?.user_mname ? `${user.user_mname} ` : ""}{user?.user_lname} {user?.suffix_name || ""}
          </h2>
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
            <span className="px-3 py-1 bg-primary/5 dark:bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-full border border-primary/20 dark:border-primary/30">
              {user?.role || "USER"}
            </span>
            <span className="text-gray-400 dark:text-gray-500">•</span>
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {user?.user_position}
            </span>
            <span className="text-gray-400 dark:text-gray-500">•</span>
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {user?.user_department?.department_name || "No Department"}
            </span>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">
            Member since {user?.user_dateOfHire ? new Date(user.user_dateOfHire).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "N/A"}
          </p>
      </div>
      
      <ImageCropModal 
        image={tempImageSource}
        isOpen={isCropping}
        onClose={() => {
          setIsCropping(false);
          setTempImageSource(null);
        }}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
