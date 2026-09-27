import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-context";
import { ToastProvider } from "@/components/ui/toast";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "Vesper | Smart Resort 360",
  description:
    "AI-driven operating layer for boutique & luxury resorts. Connecting front desk, floor staff, equipment, and guests.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#faf8f5",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        <meta name="color-scheme" content="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-[#faf8f5] text-[#212b26] antialiased selection:bg-sage-200 selection:text-sage-900">
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
