import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Static marketing site — builds to dist/ for S3 + CloudFront hosting.
export default defineConfig({
  base: "/",
  // Fixed dev port (web/ owns 5173) so the API's CORS allow-list is deterministic.
  // Bound to all interfaces and host-allowed for the shared "liono" dev server
  // (reached over LAN / Tailscale MagicDNS) — dev-only, prod is a static build.
  server: {
    port: 5174,
    host: true,
    allowedHosts: ["liono", ".ts.net"],
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
