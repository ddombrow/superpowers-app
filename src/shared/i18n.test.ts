import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as i18n from "./i18n";

describe("i18n", () => {
  beforeAll(async () => {
    i18n.setLocalesPath(join(__dirname, "../../resources/locales"));
    i18n.setLanguageCode("fr");
    await new Promise<void>((resolve) => i18n.load(["common", "startup"], resolve));
  });

  it("lists the available languages", () => {
    expect(i18n.getLanguageIds()).toEqual(expect.arrayContaining(["en", "fr", "de"]));
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
    expect(text).toContain("http://localhost");
    expect(text).toContain("4");
    expect(text).toContain("5");
    expect(text).not.toContain("${");
  });

  it("returns the key when it can't be found", () => {
    expect(i18n.t("common:does.not.exist")).toBe("common:does.not.exist");
  });

  it("localizes filenames for non-English languages", () => {
    expect(i18n.getLocalizedFilename("index.html")).toBe("index.fr.html");
  });
});
