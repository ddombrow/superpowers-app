import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";

// The launcher preload runs sandboxed: it can require("electron") but not other chunks
const checkSandboxedPreload: Plugin = {
  name: "check-sandboxed-preload",
  generateBundle(_options, bundle) {
    const chunk = bundle["app.js"];
    const imports = chunk?.type === "chunk" ? chunk.imports.filter((name) => name !== "electron") : [];
    if (imports.length > 0) {
      this.error(`The sandboxed preload must be self-contained, but it imports: ${imports.join(", ")}`);
    }
  }
};

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "src/main/index.ts") } }
    }
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    // Relative asset URLs, since the page is loaded from file:// when packaged
    base: "./",
    plugins: [svelte()],
    build: {
      minify: true,
      rollupOptions: { input: { index: resolve(__dirname, "src/renderer/index.html") } }
    }
  },
  preload: {
    plugins: [checkSandboxedPreload],
    build: {
      rollupOptions: {
        input: {
          app: resolve(__dirname, "src/preload/app.ts"),
          supapp: resolve(__dirname, "src/preload/supapp.ts")
        },
        output: { format: "cjs", entryFileNames: "[name].js" }
      }
    }
  }
});
