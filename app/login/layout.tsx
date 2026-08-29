import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Đăng nhập tài khoản",
  path: "/login"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
