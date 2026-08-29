import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Đăng ký tài khoản mới",
  path: "/register"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
