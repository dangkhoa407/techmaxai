import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Danh sách hóa đơn",
  path: "/invoices"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
