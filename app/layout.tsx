import "./globals.css";
import { SidebarProvider } from "@/providers/SidebarProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ColorThemeProvider } from "@/providers/ColorThemeProvider";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ColorThemeProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </ColorThemeProvider>
        </ThemeProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
