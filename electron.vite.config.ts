import { resolve } from "node:path";
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
