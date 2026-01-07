import "./globals.css";
import { SidebarProvider } from "@/providers/SidebarProvider";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SidebarProvider>{children}</SidebarProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
