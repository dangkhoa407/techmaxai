import type { Metadata } from "next";
import { buildMetadata } from "../../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Nhật ký Hệ thống - Admin",
  noIndex: true
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
