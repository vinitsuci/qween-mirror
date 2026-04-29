import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Qween Mirror",
        short_name: "Qween Mirror",
        description: "AR beauty mirror with virtual makeup, filters, and backgrounds.",
        theme_color: "#2196f3",
        background_color: "#1a1a1a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Camera app — don't cache the app shell aggressively, we want fresh
        // SDK assets on update. Cache fonts and images for offline-ish use.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        // Tencent's SDK bundles heavy AI assets — bump from the 2 MiB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // Background scenes from Unsplash
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "unsplash-backgrounds",
              expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Tencent SDK CDN assets (effects/filters covers and models)
            urlPattern: /^https:\/\/[^/]*tencent-cloud\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "tencent-cdn",
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    https: true,
    host: true,
  },
});
