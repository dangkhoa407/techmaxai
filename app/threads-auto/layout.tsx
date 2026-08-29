import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";
import "../facebook-auto/facebook-auto.css";

export const metadata: Metadata = buildMetadata({
  title: "Auto Threads",
  path: "/threads-auto"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
