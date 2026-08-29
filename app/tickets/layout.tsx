import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Hỗ trợ & Gửi ticket",
  path: "/tickets"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
