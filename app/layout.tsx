import type { Metadata } from "next";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";
import { RouteTransitionOverlay } from "./components";
import { buildDefaultMetadata } from "./seo.config";

export const metadata: Metadata = buildDefaultMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <RouteTransitionOverlay />
        {children}
      </body>
    </html>
  );
}
