import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Tích hợp Website Livechat",
  path: "/api-docs"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
