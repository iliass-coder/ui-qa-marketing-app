import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  cacheDir: join(tmpdir(), "steadysignal-ui-qa-vite-cache"),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/oauth2": "http://127.0.0.1:8080",
      "/login/oauth2": "http://127.0.0.1:8080",
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (request) => request.removeHeader("origin"));
        }
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
