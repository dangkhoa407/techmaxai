import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Cuộc hội thoại",
  path: "/chat"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
