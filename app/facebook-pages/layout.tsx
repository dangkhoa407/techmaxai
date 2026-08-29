import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "Quản lý Facebook Fanpage",
  path: "/facebook-pages"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
