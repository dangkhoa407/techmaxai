import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Quên mật khẩu",
  path: "/forgot-password",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
