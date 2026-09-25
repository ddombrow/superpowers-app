import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";
import svelteConfig from "./svelte.config.mjs";

export default tseslint.config(
  {
    ignores: ["out/", "dist/", "node_modules/", ".dev-core/", "test-results/"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    files: ["src/renderer/**/*.{ts,svelte}"],
    languageOptions: { globals: { ...globals.browser } }
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".svelte"],
        parser: tseslint.parser,
        svelteConfig
      }
    }
  },
  {
    // SupApp's public surface is a namespace taking arbitrary values from core; keep it as-is for compatibility
    files: ["src/preload/supapp.ts"],
    languageOptions: { globals: { ...globals.browser } },
    rules: { "@typescript-eslint/no-namespace": "off", "@typescript-eslint/no-explicit-any": "off" }
  }
);
