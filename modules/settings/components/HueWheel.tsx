"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface HueWheelProps {
  hue: number;
  onChange: (hue: number) => void;
  hex?: string;
  onHexChange?: (hex: string) => void;
  className?: string;
}

// Convert Hex to Hue (0-360)
function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return Math.round(h * 360);
}

// Convert Hue (0-360) to vibrant Hex for the native picker
function hueToHex(hue: number): string {
  const h = hue / 360;
  const s = 1;
  const l = 0.5;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  const toHex = (x: number) => x.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function HueWheel({ hue, onChange, hex, onHexChange, className }: HueWheelProps) {
  const [hexValue, setHexValue] = useState(hex || hueToHex(hue));

  // Sync internal state if external hex/hue changes
  useEffect(() => {
    const nextHex = hex || hueToHex(hue);
    if (nextHex !== hexValue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHexValue(nextHex);
    }
  }, [hue, hex, hexValue]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    setHexValue(newHex);
    onChange(hexToHue(newHex));
    if (onHexChange) {
      onHexChange(newHex);
    }
  };

  return (
    <div className={cn("relative flex flex-col items-center justify-center select-none gap-6", className)}>
      <div className="relative group cursor-pointer inline-flex items-center justify-center">
        {/* Hidden but interactive native color input */}
        <input
          type="color"
          value={hexValue}
          onChange={handleColorChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          title="Choose your theme color"
        />
        
        {/* Visual wrapper for the picker */}
        <div 
          className="w-32 h-32 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.1)] border-4 border-white dark:border-gray-800 transition-transform group-hover:scale-105 active:scale-95 flex items-center justify-center"
          style={{ backgroundColor: hexValue }}
        >
           <div className="w-16 h-16 rounded-full border-4 border-white/30 shadow-inner flex items-center justify-center backdrop-blur-sm">
             <span className="text-white font-bold opacity-80 mix-blend-overlay">M</span>
           </div>
        </div>
      </div>
      
      {/* Hue Value Display */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Native Picker
        </span>
        <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 dark:text-gray-500">
          Hue Base: {hue}&deg;
        </span>
      </div>
    </div>
  );
}
