import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Nạp tiền tài khoản",
  path: "/deposit"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
