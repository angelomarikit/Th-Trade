import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Vercel sets this at build time — hostname alone is not enough for every preview URL shape. */
const scannerV2PreviewBranch =
  (process.env.VERCEL_GIT_COMMIT_REF ?? "").replace(/^refs\/heads\//, "") ===
  "phase7/scanner-v2-preview";

/** Vercel system env var (build time). Shows which commit is actually live. */
const buildSha =
  (process.env.VERCEL_GIT_COMMIT_SHA ?? "").trim().slice(0, 7) || "local";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_IS_SCANNER_V2_PREVIEW": JSON.stringify(
      scannerV2PreviewBranch ? "1" : "0",
    ),
    "import.meta.env.VITE_BUILD_SHA": JSON.stringify(buildSha),
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
