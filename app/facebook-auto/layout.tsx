import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";
import "./facebook-auto.css";

export const metadata: Metadata = buildMetadata({
  title: "Facebook Auto",
  path: "/facebook-auto"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
