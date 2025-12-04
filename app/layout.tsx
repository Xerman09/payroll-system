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
    <html lang="en" suppressHydrationWarning>
      <body>
        <SidebarProvider>{children}</SidebarProvider>
      </body>
    </html>
  );
}
