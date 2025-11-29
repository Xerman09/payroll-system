/* TypeScript doesn't need type declarations for Next.js global side-effect CSS imports */
// @ts-ignore
import "./globals.css";
import Script from "next/script";
import { SidebarProvider } from "@/providers/SidebarProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Run a very small script before React hydration so the <html> classes match client preference.
            Using next/script with strategy="beforeInteractive" guarantees execution before the bundle hydrates. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})()`}
        </Script>

        <SidebarProvider>{children}</SidebarProvider>
      </body>
    </html>
  );
}
