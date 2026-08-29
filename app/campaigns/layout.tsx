import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Chiến dịch Zalo",
  path: "/campaigns"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
