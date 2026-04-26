// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Build a static SPA bundle for Surge / Netlify / any static host.
// The Express backend in /backend is deployed separately (e.g. Vercel).
//
// Output (after `bun run build`):
//   dist/index.html      ← entry HTML
//   dist/200.html        ← SPA fallback (Surge), copied by the postbuild script
//   dist/assets/*        ← hashed JS/CSS bundles
//   dist/favicon.png     ← static files from /public
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
  },
});
