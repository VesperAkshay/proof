import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://proof.so";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/@*"],
        disallow: ["/api/", "/dashboard/", "/u/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
