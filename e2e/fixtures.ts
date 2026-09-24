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
export async function launchApp(): Promise<{
  app: ElectronApplication;
  window: Page;
  dataPath: string;
  cleanup: () => Promise<void>;
}> {
  const dataPath = mkdtempSync(join(tmpdir(), "superpowers-e2e-"));
  const devCorePath = join(root, ".dev-core");
  if (existsSync(devCorePath)) {
    cpSync(devCorePath, dataPath, { recursive: true, filter: (src) => !src.endsWith("settings.json") });
  }

  // Set SUPERPOWERS_EXECUTABLE to test a packaged build instead of the dev build in out/
  const executablePath = process.env.SUPERPOWERS_EXECUTABLE;
  const app = await electron.launch(
    executablePath != null
      ? { executablePath, args: [`--core-path=${dataPath}`] }
      : { args: [root, `--core-path=${dataPath}`], cwd: root }
  );
  const window = await app.firstWindow();

  const cleanup = async () => {
    // Graceful quit lets the renderer stop the local server first
    const closed = new Promise<void>((resolve) => app.once("close", () => resolve()));
    await app.evaluate(({ app }) => app.quit()).catch(() => {});
    await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 10_000))]);
    await app.close().catch(() => {});

    // Never leave an orphaned server holding the ports
    try {
      execFileSync("pkill", ["-f", dataPath]);
    } catch {
      /* nothing left running */
    }
    rmSync(dataPath, { recursive: true, force: true });
  };

  return { app, window, dataPath, cleanup };
}
