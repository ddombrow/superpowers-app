import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(__dirname, "..");

/**
 * Launches the built app (run `npm run build` first) with an isolated data folder.
 * If `.dev-core` exists (created by `npm run dev`), it is copied in so the core
 * doesn't need to be downloaded again. Settings are never copied over.
 */
export interface LaunchedApp {
  app: ElectronApplication;
  window: Page;
  dataPath: string;
  /** Quits like a user would; resolves with the core server processes still running afterwards */
  quit: () => Promise<string[]>;
  /** Quits, kills anything left over, and deletes the data folder */
  cleanup: () => Promise<void>;
  /** Quits without deleting the data folder, to launch again with `{ dataPath }` */
  quitKeepingData: () => Promise<void>;
}

/** Core server processes (`server/index.js`) started with this data folder */
export function findServerProcesses(dataPath: string): string[] {
  return execFileSync("ps", ["-A", "-o", "pid=,args="], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line.includes(dataPath) && line.includes("server/index.js"));
}

export interface LaunchOptions {
  env?: Record<string, string>;
  /** Reuses the data folder of a previous launch (which must have been quit, not cleaned up) */
  dataPath?: string;
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const reusingData = options.dataPath != null;
  const dataPath = options.dataPath ?? mkdtempSync(join(tmpdir(), "superpowers-e2e-"));
  const devCorePath = join(root, ".dev-core");
  if (!reusingData && existsSync(devCorePath)) {
    cpSync(devCorePath, dataPath, {
      recursive: true,
      filter: (src) => !src.endsWith("settings.json") && !src.includes(".electron-profile")
    });
  }

  // Set SUPERPOWERS_EXECUTABLE to test a packaged build instead of the dev build in out/
  const executablePath = process.env.SUPERPOWERS_EXECUTABLE;
  const env = { ...(process.env as Record<string, string>), ...options.env };
  const app = await electron.launch(
    executablePath != null
      ? { executablePath, args: [`--core-path=${dataPath}`], env }
      : { args: [root, `--core-path=${dataPath}`], cwd: root, env }
  );
  const window = await app.firstWindow();

  let quitting: Promise<string[]> | null = null;
  const quit = () => {
    quitting ??= (async () => {
      const closed = new Promise<void>((resolve) => app.once("close", () => resolve()));
      await app.evaluate(({ app }) => app.quit()).catch(() => {});
      await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 15_000))]);
      return findServerProcesses(dataPath);
    })();
    return quitting;
  };

  const quitKeepingData = async () => {
    await quit();
    await app.close().catch(() => {});

    // Never leave an orphaned server holding the ports
    try {
      execFileSync("pkill", ["-f", dataPath]);
    } catch {
      /* nothing left running */
    }
  };

  const cleanup = async () => {
    await quitKeepingData();
    rmSync(dataPath, { recursive: true, force: true });
  };

  return { app, window, dataPath, quit, cleanup, quitKeepingData };
}
