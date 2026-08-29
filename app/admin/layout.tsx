import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";
import AdminLayoutClient from "./admin-layout-client";

export const metadata: Metadata = buildMetadata({
  title: "Trang quản trị (Admin)",
  path: "/admin"
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
