import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Tổng quan",
  path: "/dashboard"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
