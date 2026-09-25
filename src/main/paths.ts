import { app } from "electron";
import { existsSync, renameSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { LocalizedError } from "../shared/i18n";

export interface Paths {
  corePath: string;
  userDataPath: string;
}

/**
 * `--core-path=<folder>` runs against a core checkout (or any folder) and
 * stores all user data there too. Otherwise, data lives in the OS app data
 * folder and core is installed in its "core" subfolder.
 */
export async function getPaths(argv = process.argv): Promise<Paths> {
  const corePathArg = getCorePathArg(argv);
  if (corePathArg != null) return { corePath: corePathArg, userDataPath: corePathArg };

  let userDataPath: string;
  try {
    userDataPath = join(app.getPath("appData"), "Superpowers");
  } catch (err) {
    throw new LocalizedError("startup:errors.couldNotGetDataPath", { details: (err as Error).message });
  }

  if (!existsSync(userDataPath)) migrateOldDataFolder(userDataPath);

  try {
    await mkdir(userDataPath, { recursive: true });
  } catch (err) {
    throw new LocalizedError("startup:errors.couldNotCreateUserDataFolder", {
      dataPath: userDataPath,
      reason: (err as Error).message
    });
  }

  return { corePath: join(userDataPath, "core"), userDataPath };
}

export function getCorePathArg(argv = process.argv): string | null {
  const { values } = parseArgs({
    args: argv.slice(1),
    options: { "core-path": { type: "string" } },
    strict: false,
    allowPositionals: true
  });

  const corePathArg = values["core-path"];
  return typeof corePathArg === "string" ? resolve(corePathArg) : null;
}

/**
 * Electron's own profile (caches, local storage...) must not end up in the
 * Superpowers data folder, which it would by default since the app is named "Superpowers".
 * Must be called before the app is ready.
 */
export function setupElectronProfilePath(argv = process.argv) {
  const corePathArg = getCorePathArg(argv);
  app.setPath(
    "userData",
    corePathArg != null ? join(corePathArg, ".electron-profile") : join(app.getPath("appData"), "superpowers-app")
  );
}

/** Very old versions picked the data folder themselves */
function migrateOldDataFolder(userDataPath: string) {
  const { APPDATA, HOME, XDG_DATA_HOME } = process.env;
  let oldDataPath: string | null = null;

  switch (process.platform) {
    case "win32":
      if (APPDATA != null) oldDataPath = join(APPDATA, "Superpowers");
      break;
    case "darwin":
      if (HOME != null) oldDataPath = join(HOME, "Library", "Superpowers");
      break;
    default:
      if (XDG_DATA_HOME != null) oldDataPath = join(XDG_DATA_HOME, "Superpowers");
      else if (HOME != null) oldDataPath = join(HOME, ".local/share", "Superpowers");
  }

  if (oldDataPath != null && existsSync(oldDataPath)) {
    console.log(`Migrating data from ${oldDataPath} to ${userDataPath}...`);
    renameSync(oldDataPath, userDataPath);
  }
}
