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
      // TODO: Make this an error once main & preload are ported to strict mode
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" }
  },
  {
    // SupApp's public surface is a namespace; keep it as-is for compatibility
    files: ["src/preload/supapp.ts"],
    languageOptions: { globals: { ...globals.browser } },
    rules: { "@typescript-eslint/no-namespace": "off" }
  }
);
