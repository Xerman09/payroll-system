"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => Promise<void> | void;
};

export default function PasswordDialog({
  open,
  onOpenChange,
  onSubmit,
}: Props) {
  const [password, setPassword] = useState("");

  // 🟢 Clear password every time modal opens
  useEffect(() => {
    if (open) {
      setPassword("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-6 rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-center">Enter Password</DialogTitle>
          <p className="text-sm text-gray-500 text-center mt-1">
            To access wage management please confirm your login password.
          </p>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(password);
          }}
          className="flex gap-2 mt-4"
        >
          <Input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button type="submit">Enter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
