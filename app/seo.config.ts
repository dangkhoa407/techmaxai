import type { Metadata } from "next";

const siteUrl = "https://techmaxai.store";

export const seoConfig = {
  siteName: "TECHMAX AI",
  defaultTitle: "TECHMAX AI - Nền tảng tự động hóa chăm sóc khách hàng",
  titleTemplate: "%s | TECHMAX AI",
  description:
    "TECHMAX AI cung cấp nền tảng thuê bot AI cá nhân, tự động chăm sóc khách hàng, gửi nội dung quảng bá và theo dõi hiệu quả theo thời gian thực.",
  keywords: [
    "TECHMAX AI",
    "TECHMAX",
    "bot Zalo",
    "tự động hóa Zalo",
    "Zalo marketing",
    "thuê bot Zalo",
    "chăm sóc khách hàng tự động",
    "Tự động chăm sóc khách hàng",
    "AI chăm sóc khách hàng",
    "Dịch vụ AI",
    "Chăm sóc khách hàng Facebook",
    "Chăm sóc khách hàng Zalo",
    "Tự động bán hàng",
    "Tự động marketing",
    "Dịch vụ marketing",
    "Dịch vụ bán hàng",
    "Tự động gửi tin nhắn",
    "Tự động trả lời tin nhắn",
    "Tự động gửi báo giá",
    "Zalo automation"
  ],
  url: siteUrl,
  locale: "vi_VN",
  ogImage: "https://i.ibb.co/KpDDsJSF/Chat-GPT-Image-20-37-27-4-thg-7-2026.png",
  twitterHandle: "@techmax"
};

export function buildDefaultMetadata(): Metadata {
  return {
    metadataBase: new URL(seoConfig.url),
    title: {
      default: seoConfig.defaultTitle,
      template: seoConfig.titleTemplate
    },
    description: seoConfig.description,
    keywords: seoConfig.keywords,
    applicationName: seoConfig.siteName,
    authors: [{ name: seoConfig.siteName }],
    creator: seoConfig.siteName,
    publisher: seoConfig.siteName,
    alternates: {
      canonical: "/"
    },
    openGraph: {
      type: "website",
      locale: seoConfig.locale,
      url: seoConfig.url,
      siteName: seoConfig.siteName,
      title: seoConfig.defaultTitle,
      description: seoConfig.description,
      images: [
        {
          url: seoConfig.ogImage,
          width: 1200,
          height: 630,
          alt: `${seoConfig.siteName} preview`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      site: seoConfig.twitterHandle,
      creator: seoConfig.twitterHandle,
      title: seoConfig.defaultTitle,
      description: seoConfig.description,
      images: [seoConfig.ogImage]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
        { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
        { url: "/favicon-192x192.png", type: "image/png", sizes: "192x192" },
        { url: "/favicon.png", type: "image/png", sizes: "512x512" }
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }]
    },
    manifest: "/site.webmanifest"
  };
}

export function buildMetadata({
  title,
  description,
  path,
  noIndex = false
}: {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const metaTitle = title;
  const metaDesc = description || seoConfig.description;
  const canonicalUrl = path ? `${seoConfig.url}${path}` : undefined;

  return {
    title: metaTitle,
    description: metaDesc,
    alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,
    openGraph: {
      title: `${metaTitle} | ${seoConfig.siteName}`,
      description: metaDesc,
      url: canonicalUrl || seoConfig.url,
      images: [
        {
          url: seoConfig.ogImage,
          width: 1200,
          height: 630,
          alt: `${metaTitle} - ${seoConfig.siteName}`
        }
      ]
    },
    twitter: {
      title: `${metaTitle} | ${seoConfig.siteName}`,
      description: metaDesc,
      images: [seoConfig.ogImage]
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false
      }
    })
  };
}
