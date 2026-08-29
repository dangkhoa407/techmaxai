import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Nhật ký hoạt động",
  path: "/activity"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
