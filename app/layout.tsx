import "./globals.css";
import { SidebarProvider } from "@/providers/SidebarProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SidebarProvider>{children}</SidebarProvider>
      </body>
    </html>
  );
}
