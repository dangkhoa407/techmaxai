import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Quản lý Proxy",
  path: "/proxies"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
