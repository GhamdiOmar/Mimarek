import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mimaric — Saudi PropTech",
    short_name: "Mimaric",
    description:
      "منصة إدارة العقارات السعودية — Saudi real estate management platform for developers.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    theme_color: "#6d28d9",
    background_color: "#ffffff",
    categories: ["business", "productivity", "finance"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "CRM",
        short_name: "CRM",
        description: "Customer relationship management",
        url: "/dashboard/crm",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Maintenance",
        short_name: "Tickets",
        description: "Maintenance tickets",
        url: "/dashboard/maintenance",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Units",
        short_name: "Units",
        description: "Unit inventory",
        url: "/dashboard/units",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
