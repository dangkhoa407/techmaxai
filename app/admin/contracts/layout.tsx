import type { Metadata } from "next";
import { buildMetadata } from "../../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Quản lý Hợp đồng - Admin",
  noIndex: true
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
