// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Build a static SPA bundle into ./dist so the frontend can be hosted on any
// static host (Surge, Netlify, GitHub Pages, Nginx, etc.) while the Express
// backend in /backend is hosted separately.
//
// - `cloudflare: false` disables the Worker SSR build.
// - `tanstackStart.spa.enabled` makes TanStack Start emit a single index.html
//   that hydrates client-side, with a wildcard fallback so deep links work.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
      },
    },
    pages: [],
  },
});
