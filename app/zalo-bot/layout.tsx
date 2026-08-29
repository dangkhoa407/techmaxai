import type { Metadata } from "next";
import { buildMetadata } from "../seo.config";

export const metadata: Metadata = buildMetadata({
  title: "BOT Zalo",
  path: "/zalo-bot"
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
