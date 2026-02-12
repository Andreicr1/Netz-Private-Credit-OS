import { defineConfig } from "vite";

export default defineConfig({
  root: "webapp",
  publicDir: "public",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
