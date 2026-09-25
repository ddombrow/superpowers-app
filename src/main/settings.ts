import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Settings, SettingsLoadResult } from "../shared/types";

/**
 * Settings file versions:
 * - 1 (no `version` field): original format
 * - 2: normalized (ports as strings, passwords always set)
 */
export const currentVersion = 2;

export function defaultSettings(): Settings {
  return {
    favoriteServers: [],
    recentProjects: [],
    autoStartServer: true,
    nickname: null,
    presence: "offline",
    savedChatrooms: []
  };
}

/** Normalizes a parsed settings file, keeping unknown keys (e.g. `languageCode`) */
export function migrate(data: Record<string, unknown>): Record<string, unknown> {
  const defaults = defaultSettings();
  const favoriteServers = Array.isArray(data.favoriteServers) ? data.favoriteServers : defaults.favoriteServers;

  return {
    ...data,
    version: currentVersion,
    favoriteServers: favoriteServers.map((entry: Record<string, unknown>) => ({
      hostname: String(entry.hostname ?? ""),
      port: entry.port != null ? String(entry.port) : "",
      label: String(entry.label ?? ""),
      password: String(entry.password ?? "")
    })),
    recentProjects: Array.isArray(data.recentProjects) ? data.recentProjects : defaults.recentProjects,
    autoStartServer: typeof data.autoStartServer === "boolean" ? data.autoStartServer : defaults.autoStartServer,
    nickname: typeof data.nickname === "string" ? data.nickname : defaults.nickname,
    presence: ["online", "away", "offline"].includes(data.presence as string) ? data.presence : defaults.presence,
    savedChatrooms: Array.isArray(data.savedChatrooms) ? data.savedChatrooms : defaults.savedChatrooms
  };
}

/** Writes a file atomically so a crash mid-write can't corrupt it */
export async function writeFileAtomic(path: string, contents: string) {
  const tmpPath = `${path}.${process.pid}.tmp`;
  await writeFile(tmpPath, contents, "utf8");
  await rename(tmpPath, path);
}

export class SettingsStore {
  readonly path: string;
  private data: Record<string, unknown> = { version: currentVersion, ...defaultSettings() };
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(
    userDataPath: string,
    private saveDelay = 1000
  ) {
    this.path = join(userDataPath, "settings.json");
  }

  async load(): Promise<SettingsLoadResult> {
    let json: string;
    try {
      json = await readFile(this.path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { ok: true, settings: this.settings, isFirstRun: true };
      }
      return { ok: false, error: (err as Error).message, settings: this.settings };
    }

    try {
      const parsed = JSON.parse(json);
      if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Not an object");
      const needsMigration = parsed.version !== currentVersion;
      this.data = migrate(parsed);
      if (needsMigration) this.save(this.settings);
      return { ok: true, settings: this.settings, isFirstRun: false };
    } catch (err) {
      // Keep the broken file around so nothing is lost when defaults get saved over it
      await copyFile(this.path, `${this.path}.bak`).catch(() => {});
      return { ok: false, error: (err as Error).message, settings: this.settings };
    }
  }

  get settings(): Settings {
    const { favoriteServers, recentProjects, autoStartServer, nickname, presence, savedChatrooms } = this
      .data as unknown as Settings;
    return { favoriteServers, recentProjects, autoStartServer, nickname, presence, savedChatrooms };
  }

  /** Extra keys preserved in the file, e.g. `languageCode` */
  get(key: string): unknown {
    return this.data[key];
  }

  save(settings: Settings) {
    this.data = migrate({ ...this.data, ...settings });

    if (this.saveTimeout != null) return;
    this.saveTimeout = setTimeout(() => void this.flush(), this.saveDelay);
  }

  async flush() {
    if (this.saveTimeout != null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
      const contents = JSON.stringify(this.data, null, 2) + "\n";
      this.pendingWrite = this.pendingWrite.then(() => writeFileAtomic(this.path, contents));
    }
    await this.pendingWrite;
  }
}
