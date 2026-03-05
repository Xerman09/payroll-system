"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

interface SmoothScrollProviderProps {
  children: React.ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const smootherRef = useRef<ScrollSmoother | null>(null);

  useEffect(() => {
    smootherRef.current = ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 1.5,        // how long (in seconds) it takes to "catch up" to native scroll pos
      effects: true,       // enable data-speed / data-lag attributes
      smoothTouch: 0.1,   // much shorter (or 0) on touch devices
    });

    return () => {
      smootherRef.current?.kill();
    };
  }, []);

  return (
    <div id="smooth-wrapper" style={{ overflow: "hidden" }}>
      <div id="smooth-content">
        {children}
      </div>
    </div>
  );
}
