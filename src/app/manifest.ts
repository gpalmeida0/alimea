import type { MetadataRoute } from "next";

// "Add to home screen" opens Alimea full-screen, like an installed app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alimea",
    short_name: "Alimea",
    description: "Produtividade clínica para nutricionistas",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F8F5",
    theme_color: "#222122",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
