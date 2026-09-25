import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // The legacy renderer is replaced by the Svelte UI; it is not linted in the meantime
    ignores: ["out/", "dist/", "node_modules/", ".dev-core/", "test-results/", "src/renderer/"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" }
  },
  {
    // SupApp's public surface is a namespace taking arbitrary values from core; keep it as-is for compatibility
    files: ["src/preload/supapp.ts"],
    languageOptions: { globals: { ...globals.browser } },
    rules: { "@typescript-eslint/no-namespace": "off", "@typescript-eslint/no-explicit-any": "off" }
  }
);
