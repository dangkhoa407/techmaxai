import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Gói dịch vụ",
  path: "/packages"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
