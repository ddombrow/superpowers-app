import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadLocales, resolveLanguageCode } from "../main/locales";
import * as i18n from "./i18n";

const localesPath = join(__dirname, "../../resources/locales");

describe("i18n", () => {
  beforeAll(async () => {
    i18n.setLanguageCode("fr");
    const { contexts, fallbackContexts } = await loadLocales(localesPath, "fr", ["common", "startup"]);
    i18n.addContexts(contexts, fallbackContexts);
  });

  it("falls back to English when a namespace is missing", () => {
    // There is no fr/startup.json
    expect(i18n.t("startup:failedToStart")).toBe("Could not start app");
  });

  it("substitutes variables", () => {
    const text = i18n.t("common:server.errors.incompatibleVersion", {
      baseUrl: "http://localhost",
      serverVersion: 4,
      appVersion: 5
    });
    expect(text).toBe(
      "The server at http://localhost runs an incompatible version of Superpowers (got app API version 4, expected 5)."
    );
  });

  it("flags missing variables", () => {
    expect(i18n.t("common:server.errors.incompatibleVersion")).toContain('"baseUrl" is missing');
  });

  it("returns the key when it can't be found", () => {
    expect(i18n.t("common:does.not.exist")).toBe("common:does.not.exist");
    expect(i18n.t("nonamespace")).toBe("nonamespace");
  });
});

describe("resolveLanguageCode", () => {
  it("prefers the saved language", async () => {
    expect(await resolveLanguageCode(localesPath, "de", "fr-FR")).toBe("de");
  });

  it("uses the system locale, then its base language", async () => {
    expect(await resolveLanguageCode(localesPath, undefined, "pt-BR")).toBe("pt-BR");
    expect(await resolveLanguageCode(localesPath, undefined, "fr-CA")).toBe("fr");
  });

  it("falls back to English", async () => {
    expect(await resolveLanguageCode(localesPath, "xx", "zz-ZZ")).toBe("en");
  });
});
