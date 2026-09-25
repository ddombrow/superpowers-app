import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Compiles runes in *.svelte.ts modules
  plugins: [svelte()],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node"
  }
});
