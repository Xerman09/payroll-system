"use client";

import { useEffect } from "react";

export default function DevToolsBlocker() {
  useEffect(() => {
    // Check if we should block devtools
    const shouldBlock = process.env.NEXT_PUBLIC_BLOCK_DEVTOOLS === "true";
    
    // Bypass for developers: check for ?bypass_devtools=true in URL
    const urlParams = new URLSearchParams(window.location.search);
    const isBypassed = urlParams.get("bypass_devtools") === "true";

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev || !shouldBlock || isBypassed) return;

    // 1. Disable Right Click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // 2. Disable Common Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }

      // Ctrl+Shift+I (Inspect)
      // Ctrl+Shift+J (Console)
      // Ctrl+Shift+C (Element Selector)
      // Ctrl+U (View Source)
      if (
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && e.key === "U")
      ) {
        e.preventDefault();
        return false;
      }

      // Mac equivalents (Cmd+Option+I, etc.)
      if (
        (e.metaKey && e.altKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.metaKey && e.key === "U")
      ) {
        e.preventDefault();
        return false;
      }
    };

    // 3. Debugger detection loop (makes DevTools unusable)
    const debuggerLoop = () => {
      (function () {
        (function a() {
          try {
            (function b(i: number) {
              if (("" + i / i).length !== 1 || i % 20 === 0) {
                (function () {}.constructor("debugger")());
              } else {
                (function () {}.constructor("debugger")());
              }
              b(++i);
            })(0);
          } catch {}
        })();
      })();
    };

    const interval = setInterval(debuggerLoop, 1000);

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    // 4. Console spam to hide errors/logs
    const clearConsole = setInterval(() => {
      console.clear();
      console.log("%cSTOP!", "color: red; font-family: sans-serif; font-size: 4rem; font-weight: bold; text-shadow: 2px 2px black;");
      console.log("%cThis is a browser feature intended for developers. If someone told you to copy-paste something here to enable a feature or 'hack' someone's account, it is a scam.", "font-size: 1.2rem;");
    }, 2000);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      clearInterval(interval);
      clearInterval(clearConsole);
    };
  }, []);

  return null;
}
