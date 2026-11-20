import type { MetadataRoute } from "next";

// Public pages only; portal pages are excluded (and marked noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return ["", "/about", "/programs", "/how-to-apply", "/startups", "/schemes", "/faq", "/register", "/login"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p === "/startups" ? "daily" : "monthly",
  }));
}
