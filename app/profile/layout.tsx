import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Hồ sơ cá nhân",
  path: "/profile"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
