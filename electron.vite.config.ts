import { resolve } from "node:path";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "src/main/index.ts") } }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { supapp: resolve(__dirname, "src/preload/supapp.ts") },
        output: { format: "cjs", entryFileNames: "[name].js" }
      }
    }
  }
});
