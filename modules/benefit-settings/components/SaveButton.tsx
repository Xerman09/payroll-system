"use client";

import { Button } from "@/components/ui/button";
import { Save, Loader2, Check } from "lucide-react";

export default function SaveButton({
  status,
  saving,
  onClick,
}: {
  status: "idle" | "success" | "error";
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={saving || status === "success"}
      size="default" // Use standard size
      className={`
        min-w-[140px] font-medium transition-all duration-300 shadow-sm
        ${status === "success" ? "bg-green-600 hover:bg-green-700" : ""}
        ${status === "error" ? "bg-destructive hover:bg-destructive/90" : ""}
      `}
    >
      {saving ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : status === "success" ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Saved!
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </>
      )}
    </Button>
  );
}
