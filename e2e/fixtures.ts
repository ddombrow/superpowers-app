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
  /** Quits like a user would; resolves with the processes still running from the data folder afterwards */
  quit: () => Promise<string[]>;
  /** Quits, kills anything left over, and deletes the data folder */
  cleanup: () => Promise<void>;
}

/** Processes whose command line mentions `dataPath` (i.e. core servers started for this test) */
export function findProcesses(dataPath: string): string[] {
  try {
    return execFileSync("pgrep", ["-fl", dataPath], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export async function launchApp(): Promise<LaunchedApp> {
  const dataPath = mkdtempSync(join(tmpdir(), "superpowers-e2e-"));
  const devCorePath = join(root, ".dev-core");
  if (existsSync(devCorePath)) {
    cpSync(devCorePath, dataPath, {
      recursive: true,
      filter: (src) => !src.endsWith("settings.json") && !src.includes(".electron-profile")
    });
  }

  // Set SUPERPOWERS_EXECUTABLE to test a packaged build instead of the dev build in out/
  const executablePath = process.env.SUPERPOWERS_EXECUTABLE;
  const app = await electron.launch(
    executablePath != null
      ? { executablePath, args: [`--core-path=${dataPath}`] }
      : { args: [root, `--core-path=${dataPath}`], cwd: root }
  );
  const window = await app.firstWindow();

  let quitting: Promise<string[]> | null = null;
  const quit = () => {
    quitting ??= (async () => {
      const closed = new Promise<void>((resolve) => app.once("close", () => resolve()));
      await app.evaluate(({ app }) => app.quit()).catch(() => {});
      await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 15_000))]);
      return findProcesses(dataPath);
    })();
    return quitting;
  };

  const cleanup = async () => {
    await quit();
    await app.close().catch(() => {});

    // Never leave an orphaned server holding the ports
    try {
      execFileSync("pkill", ["-f", dataPath]);
    } catch {
      /* nothing left running */
    }
    rmSync(dataPath, { recursive: true, force: true });
  };

  return { app, window, dataPath, quit, cleanup };
}
