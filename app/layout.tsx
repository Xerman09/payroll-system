/* TypeScript doesn't need type declarations for Next.js global side-effect CSS imports */
// @ts-expect-error TypeScript doesn't need type declarations for Next.js global side-effect CSS imports
import "./globals.css";
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
