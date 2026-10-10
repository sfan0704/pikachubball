import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// .mts so that Node, Vite and the dev server always load this file as ESM.
const projectRoot = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "client", "src"),
      "@shared": path.resolve(projectRoot, "shared"),
      "@assets": path.resolve(projectRoot, "attached_assets"),
    },
  },
  root: path.resolve(projectRoot, "client"),
  build: {
    outDir: path.resolve(projectRoot, process.env.VERCEL ? "public" : "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
