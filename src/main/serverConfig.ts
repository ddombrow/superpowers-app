import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { ServerConfig } from "../shared/types";
import { writeFileAtomic } from "./settings";

const nodeRequire = createRequire(__filename);

/** The local server's config: core's defaults, overridden by `config.json` in the data folder */
export async function loadServerConfig(corePath: string, userDataPath: string): Promise<ServerConfig | null> {
  let defaults: ServerConfig;
  try {
    const configModulePath = join(corePath, "server/config.js");
    delete nodeRequire.cache[nodeRequire.resolve(configModulePath)];
    defaults = nodeRequire(configModulePath).defaults;
  } catch {
    return null;
  }

  let localConfig: Partial<ServerConfig> = {};
  try {
    localConfig = JSON.parse(await readFile(join(userDataPath, "config.json"), "utf8")) ?? {};
  } catch {
    // Use the defaults
  }

  const config = {} as ServerConfig;
  for (const key in defaults) config[key] = localConfig[key] ?? defaults[key];
  return config;
}

export async function saveServerConfig(userDataPath: string, config: ServerConfig) {
  await writeFileAtomic(join(userDataPath, "config.json"), JSON.stringify(config, null, 2) + "\n");
}

/** Serializes config writes; `flush()` resolves once everything saved so far is on disk */
export class ServerConfigWriter {
  private pending: Promise<void> = Promise.resolve();

  constructor(private userDataPath: string) {}

  save(config: ServerConfig) {
    this.pending = this.pending
      .then(() => saveServerConfig(this.userDataPath, config))
      .catch((err) => {
        console.error(`Could not save server config: ${err.message}`);
      });
  }

  flush() {
    return this.pending;
  }
}
