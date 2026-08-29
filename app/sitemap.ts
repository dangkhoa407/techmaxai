import type { MetadataRoute } from "next";
import { seoConfig } from "./seo.config";

const routes = [
  "",
  "/landing",
  "/login",
  "/register",
  "/dashboard",
  "/packages",
  "/plan-management",
  "/deposit",
  "/invoices",
  "/balance-changes",
  "/activity",
  "/zalo-accounts",
  "/campaigns",
  "/profile"
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${seoConfig.url}${route}`,
    lastModified: new Date("2026-06-19"),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7
  }));
}
