"use client";

import { Button } from "@/components/ui/button";

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
      className={`
        w-full py-1.5 text-xs font-medium transition-all
        ${status === "success" ? "bg-green-600" : ""}
        ${status === "error" ? "bg-red-600" : ""}
      `}
      disabled={saving}
    >
      {saving ? (
        <div className="flex items-center space-x-1 justify-center">
          <span className="animate-spin border-2 border-t-transparent border-current rounded-full w-3 h-3" />
          <span>Saving...</span>
        </div>
      ) : status === "success" ? (
        "Saved!"
      ) : (
        "Save Settings"
      )}
    </Button>
  );
}
