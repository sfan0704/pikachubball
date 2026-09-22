import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// The dev server loads this file as CommonJS (package "type": "commonjs"),
// where import.meta.dirname is undefined; Vite's own loader provides both.
const projectRoot = import.meta.dirname ?? __dirname;

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
    outDir: path.resolve(
      projectRoot,
      process.env.VERCEL ? "public" : "dist/public",
    ),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
