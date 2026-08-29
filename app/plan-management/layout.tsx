import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Quản lý gói dịch vụ",
  path: "/plan-management"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
