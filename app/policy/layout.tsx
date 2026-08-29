import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Chính sách & Điều khoản dịch vụ",
  path: "/policy"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
