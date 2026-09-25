import type { LocaleContexts, LocaleValue } from "./types";

export let languageCode: string;
let contexts: LocaleContexts = {};
let fallbackContexts: LocaleContexts = {};

export function setLanguageCode(code: string) {
  languageCode = code;
}

/** Adds loaded namespaces (see `loadLocales` in src/main/locales.ts) */
export function addContexts(newContexts: LocaleContexts, newFallbackContexts: LocaleContexts) {
  contexts = { ...contexts, ...newContexts };
  fallbackContexts = { ...fallbackContexts, ...newFallbackContexts };
}

export class LocalizedError extends Error {
  constructor(
    public key: string,
    public variables: { [key: string]: string }
  ) {
    super(key);
  }
}

export function t(key: string, variables?: { [name: string]: string | number }) {
  return genericT(contexts, key, variables) ?? genericT(fallbackContexts, key, variables) ?? key;
}

export function getLocalizedFilename(filename: string) {
  if (languageCode === "en") return filename;
  const [basename, extension] = filename.split(".");
  return `${basename}.${languageCode}.${extension}`;
}

function genericT(contexts: LocaleContexts, key: string, variables?: { [name: string]: string | number }) {
  const [contextName, keys] = key.split(":");
  if (keys == null) return null;

  let valueOrText: LocaleValue | string | undefined = contexts[contextName];
  for (const keyPart of keys.split(".")) {
    if (valueOrText == null || typeof valueOrText === "string") return null;
    valueOrText = valueOrText[keyPart];
  }

  if (valueOrText == null) return null;
  if (typeof valueOrText === "string") return insertVariables(valueOrText, variables ?? {});
  return key;
}

function insertVariables(text: string, variables: { [key: string]: string | number }) {
  return text.replace(/\$\{([^}]*)\}/g, (_match, key: string) =>
    variables[key] != null ? String(variables[key]) : `"${key}" is missing`
  );
}
