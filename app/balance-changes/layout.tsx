import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Biến động số dư",
  path: "/balance-changes"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
