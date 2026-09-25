// Builds the legacy (Pug + Stylus + CommonJS) renderer into out/legacy.
// Temporary: this goes away once the Svelte renderer replaces it.

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const require = createRequire(import.meta.url);
const pug = require("pug");
const stylus = require("stylus");
const i18n = require("./i18n.js");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src/renderer");
const outDir = join(root, "out/legacy/renderer");
rmSync(join(root, "out/legacy"), { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// TypeScript, bundled for the sandboxed window (no Node.js available)
await esbuild.build({
  entryPoints: [join(srcDir, "index.ts")],
  outfile: join(outDir, "index.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome140",
  sourcemap: true,
  logLevel: "warning"
});

// Pug, one HTML file per language
const renderIndex = pug.compileFile(join(srcDir, "index.pug"));
const languageCodes = [...readdirSync(i18n.localesPath), "none"];
for (const languageCode of languageCodes) {
  const html = renderIndex({ t: i18n.makeT(i18n.loadLocale(languageCode)) });
  const filename = languageCode === "en" ? "index.html" : `index.${languageCode}.html`;
  writeFileSync(join(outDir, filename), html);
}

// Stylus
const stylusPath = join(srcDir, "index.styl");
const css = stylus(readFileSync(stylusPath, "utf8")).set("filename", stylusPath).set("compress", true).render();
writeFileSync(join(outDir, "index.css"), css);

// Static assets
cpSync(join(srcDir, "public"), outDir, { recursive: true });

console.log("Legacy renderer built.");
