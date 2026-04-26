// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "node:fs";
import path from "node:path";

// Build a static SPA bundle so the frontend can be hosted on Surge / Netlify /
// any static host while the Express backend in /backend runs separately
// (e.g. on Vercel as a serverless function).
//
// Output layout after `bun run build`:
//   dist/index.html          ← entry HTML (also copied to 200.html for SPA fallback)
//   dist/assets/*            ← hashed JS/CSS bundles
//   dist/favicon.png         ← static files from /public
//
// Surge requires a 200.html file as the SPA fallback so deep links like
// /dashboard reload correctly. The post-build hook below copies index.html
// to 200.html automatically.
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
  vite: {
    base: "/",
    environments: {
      client: {
        build: {
          outDir: "dist",
          emptyOutDir: true,
        },
      },
    },
    plugins: [
      {
        name: "surge-spa-fallback",
        apply: "build",
        closeBundle() {
          try {
            const src = path.resolve("dist/index.html");
            const dest = path.resolve("dist/200.html");
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
              console.log("[surge-spa-fallback] dist/200.html written");
            }
          } catch (e) {
            console.warn("[surge-spa-fallback] skipped:", e);
          }
        },
      },
    ],
  },
});
