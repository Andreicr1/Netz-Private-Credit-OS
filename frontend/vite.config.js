import { defineConfig } from "vite";

export default defineConfig({
  // Keep the existing OpenUI5 app in frontend/webapp/ untouched, but build/run the new
  // UI5 Web Components app from the frontend root.
  publicDir: "webapp/public",
  base: "/",
  resolve: {
    alias: {
      // User-mandated import path; UI5 theming ships as a JS module.
      "@ui5/webcomponents-theming/dist/generated/themes/sap_horizon.css":
        "@ui5/webcomponents-theming/dist/generated/themes/sap_horizon/parameters-bundle.css.js",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
