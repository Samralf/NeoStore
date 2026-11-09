import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neo Coffee Store",
    short_name: "Neo Coffee",
    description:
      "Original coffee brands, machines, grinders and brewing tools delivered across Egypt.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#15549a",
    icons: [
      {
        src: "/neo-coffee-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
