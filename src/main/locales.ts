import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LocaleContexts } from "../shared/types";

export async function getLanguageIds(localesPath: string) {
  return readdir(localesPath);
}

async function loadContexts(localesPath: string, languageCode: string, namespaces: string[]) {
  const contexts: LocaleContexts = {};
  await Promise.all(
    namespaces.map(async (namespace) => {
      try {
        const text = await readFile(join(localesPath, languageCode, `${namespace}.json`), "utf8");
        contexts[namespace] = JSON.parse(text);
      } catch {
        // Missing translations fall back to English
      }
    })
  );
  return contexts;
}

export async function loadLocales(localesPath: string, languageCode: string, namespaces: string[]) {
  const contexts = await loadContexts(localesPath, languageCode, namespaces);
  const fallbackContexts = languageCode === "en" ? {} : await loadContexts(localesPath, "en", namespaces);
  return { contexts, fallbackContexts };
}

/** Picks the best available language: the saved one, then the OS locale, then English */
export async function resolveLanguageCode(localesPath: string, preferred: string | undefined, systemLocale: string) {
  const languageIds = await getLanguageIds(localesPath);
  for (const candidate of [preferred, systemLocale, systemLocale.split("-")[0]]) {
    if (candidate != null && languageIds.includes(candidate)) return candidate;
  }
  return "en";
}
