import type { NextConfig } from "next";
import logos from "./data/resource-logos.json";
import aliases from "./data/resource-logo-aliases.json";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    // Serve bundled art from the CDN while preserving the tile's resource ID for selection and drag-to-save.
    const artwork = new Map(Object.keys(logos).map(id => [id, id]));
    for (const [id, logo] of Object.entries(aliases as Record<string, string>)) artwork.set(id, logo);
    return Array.from(artwork, ([id, logo]) => ({
      source: `/api/resource-icon/${id}`,
      destination: `/resource-logos/${logo}.png`,
    }));
  },
};

export default nextConfig;
