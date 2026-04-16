"use client";

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import getCroppedImg from "../utils/cropImageUtil";
import { RotateCw, ZoomIn } from "lucide-react";

interface ImageCropModalProps {
  image: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: Blob) => void;
}

export function ImageCropModal({ image, isOpen, onClose, onCropComplete }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onRotationChange = (rotation: number) => {
    setRotation(rotation);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onCropCompleteInternal = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      if (!image || !croppedAreaPixels) return;
      
      const croppedImage = await getCroppedImg(
        image,
        croppedAreaPixels,
        rotation
      );
      
      if (croppedImage) {
        onCropComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!image) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white dark:bg-gray-900 border-none shadow-2xl rounded-xl">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
            Position and Size
          </DialogTitle>
        </DialogHeader>

        <div className="relative h-[400px] w-full bg-gray-100 dark:bg-gray-800 mt-4">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteInternal}
            onZoomChange={onZoomChange}
            onRotationChange={onRotationChange}
          />
        </div>

        <div className="p-5 pt-4 space-y-4">
          {/* Zoom Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-500">
              <span className="flex items-center gap-1.5"><ZoomIn size={14} /> Zoom</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="flex-1 rounded-lg border-gray-200 dark:border-gray-700 font-bold uppercase tracking-widest text-[10px] h-10 gap-2"
            >
              <RotateCw size={14} /> Rotate 90°
            </Button>
            
            <div className="flex items-center gap-2 flex-1">
               <Button 
                variant="ghost" 
                onClick={onClose}
                className="flex-1 rounded-lg font-bold uppercase tracking-widest text-[10px] h-10"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-primary/20"
              >
                Save Profile
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
