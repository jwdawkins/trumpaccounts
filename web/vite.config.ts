import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SPA served from S3 + CloudFront (handoff §3). Route groups:
//   /              buyer storefront
//   /claim/:token  recipient claim
//   /admin         admin portal (Cognito admins group)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: true },
});
