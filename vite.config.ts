import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  publicDir: mode === "studio" ? false : "public",
  clearScreen: false,
  server: {
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "es2022",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/jszip")) return "engine-export";
          if (id.includes("node_modules/@xyflow") || id.includes("node_modules/@dagrejs")) return "graph-editor";
          if (id.includes("node_modules/xstate") || id.includes("node_modules/mistreevous")) return "simulation";
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
          return undefined;
        },
      },
    },
  },
}));
