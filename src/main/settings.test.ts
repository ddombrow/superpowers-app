import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsStore, currentVersion, defaultSettings } from "./settings";

let dir: string;
const settingsPath = () => join(dir, "settings.json");
const readSaved = () => JSON.parse(readFileSync(settingsPath(), "utf8"));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "superpowers-settings-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("SettingsStore", () => {
  it("reports a first run when there is no settings file", async () => {
    const result = await new SettingsStore(dir).load();
    expect(result).toEqual({ ok: true, settings: defaultSettings(), isFirstRun: true, notices: [] });
  });

  it("loads and migrates a v1 settings file", async () => {
    writeFileSync(
      settingsPath(),
      JSON.stringify({
        favoriteServers: [{ hostname: "example.com", port: 4237, label: "Example" }],
        recentProjects: [],
        autoStartServer: false,
        nickname: "Elisee",
        presence: "online",
        savedChatrooms: ["#superpowers-html5"],
        languageCode: "fr"
      })
    );

    const store = new SettingsStore(dir, 0);
    const result = await store.load();
    if (!result.ok) throw new Error(result.error);

    expect(result.isFirstRun).toBe(false);
    expect(result.notices).toEqual(["liberaMigration"]);
    expect(result.settings).toEqual({
      favoriteServers: [{ hostname: "example.com", port: "4237", label: "Example", password: "" }],
      recentProjects: [],
      autoStartServer: false,
      nickname: "Elisee",
      presence: "online",
      savedChatrooms: ["#superpowers-html5"]
    });

    // The migration is persisted, and unknown keys are kept
    await store.flush();
    expect(readSaved()).toMatchObject({ version: currentVersion, languageCode: "fr" });

    const reloaded = await new SettingsStore(dir).load();
    expect(reloaded.ok && reloaded.notices).toEqual([]);
  });

  it("does not show the Libera notice to users who never used chat", async () => {
    writeFileSync(settingsPath(), JSON.stringify({ nickname: "Someone", presence: "offline", savedChatrooms: [] }));
    const result = await new SettingsStore(dir).load();
    expect(result.ok && result.notices).toEqual([]);
  });

  it("backs up a corrupt file and returns defaults", async () => {
    writeFileSync(settingsPath(), "{ not json");
    const result = await new SettingsStore(dir).load();

    expect(result.ok).toBe(false);
    expect(result.settings).toEqual(defaultSettings());
    expect(readFileSync(`${settingsPath()}.bak`, "utf8")).toBe("{ not json");
  });

  it("debounces saves and writes on flush", async () => {
    const store = new SettingsStore(dir, 60_000);
    await store.load();

    store.save({ ...defaultSettings(), nickname: "First" });
    store.save({ ...defaultSettings(), nickname: "Second" });
    expect(existsSync(settingsPath())).toBe(false);

    await store.flush();
    expect(readSaved()).toMatchObject({ nickname: "Second", version: currentVersion });
    expect(existsSync(`${settingsPath()}.${process.pid}.tmp`)).toBe(false);
  });
});
