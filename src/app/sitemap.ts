import type { MetadataRoute } from "next";

// Public pages only; portal pages are excluded (and marked noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return ["", "/about", "/faq", "/public-startups", "/register", "/login"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p === "/public-startups" ? "daily" : "monthly",
  }));
}
