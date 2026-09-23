import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stridebook",
    short_name: "Stridebook",
    description: "Calm training plans and running progress.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1ede3",
    theme_color: "#f1ede3",
    orientation: "portrait-primary",
    icons: [{ src: "/stridebook-logo.png", sizes: "any", type: "image/png", purpose: "maskable" }],
  };
}
