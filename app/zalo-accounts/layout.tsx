import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Quản lý tài khoản Zalo",
  path: "/zalo-accounts"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
