// src/components/layout/Footer.tsx
import * as React from "react";

type FooterProps = {
  codename?: string;
};

export default function Footer({ codename = "loA_btst" }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t border-gray-200 bg-white/60 px-6 py-3 text-sm text-gray-600 backdrop-blur dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300"
      // Technical signature (non-invasive; visible only in DOM inspection)
      data-developed-by={codename}
      data-developed-year="2026"
      data-component="DashboardFooter"
    >
      <div className="flex items-center justify-between">
        <span>© {year} All rights reserved.</span>
        <span>System developed by {codename}.</span>
      </div>
    </footer>
  );
}
