import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findServerProcesses, launchApp } from "./fixtures";

test("first launch: welcome, local server, hub webview with SupApp, clean quit", async () => {
  const { app, window, dataPath, quit, cleanup } = await launchApp();
  const pageErrors: string[] = [];
  window.on("pageerror", (err) => pageErrors.push(err.message));

  try {
    await expect(window).toHaveTitle("Superpowers");

    // Electron's profile stays out of the Superpowers data (projects, settings...)
    expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(join(dataPath, ".electron-profile"));

    // The launcher UI is sandboxed: no Node.js, only the preload's API
    expect(
      await window.evaluate(() => {
        const globals = window as unknown as Record<string, object | undefined>;
        return {
          require: typeof globals.require,
          process: typeof globals.process,
          api: Object.keys(globals.api ?? {}).sort()
        };
      })
    ).toEqual({ require: "undefined", process: "undefined", api: ["invoke", "on", "send"] });

    const nicknameField = window.locator("#nickname-field");
    await expect(nicknameField).toBeVisible({ timeout: 60_000 });
    await window.screenshot({ path: "test-results/screens/01-welcome.png" });

    await nicknameField.fill("E2ETester");
    await window.locator("#go-online-checkbox").uncheck();
    await window.locator(".dialog .validate-button").click();

    // "Install the game system?" prompt
    const skipButton = window.locator(".dialog .cancel-button");
    await expect(skipButton).toBeVisible();
    await window.screenshot({ path: "test-results/screens/02-install-prompt.png" });
    await skipButton.click();

    await expect(window.locator(".local-server .status")).toHaveText("Server running.", { timeout: 60_000 });
    await window.screenshot({ path: "test-results/screens/03-server-running.png" });

    // Open the local server: its hub loads in a webview with the SupApp preload
    await window.locator(".servers-tree-view").getByText("My Server").dblclick();
    await expect(window.locator("webview")).toBeVisible();

    await expect
      .poll(
        () =>
          app.evaluate(async ({ webContents }) => {
            const guest = webContents.getAllWebContents().find((wc) => wc.getType() === "webview");
            if (guest == null || guest.isLoading()) return null;
            return guest.executeJavaScript("typeof SupApp === 'object' ? Object.keys(SupApp).sort() : null");
          }),
        { timeout: 30_000 }
      )
      .toEqual([
        "chooseFile",
        "chooseFolder",
        "clipboard",
        "createMenu",
        "createMenuItem",
        "getCurrentWindow",
        "mkdirp",
        "mktmpdir",
        "onMessage",
        "openLink",
        "openWindow",
        "readDir",
        "sendMessage",
        "showItemInFolder",
        "showMainWindow",
        "spawnChildProcess",
        "tryFileAccess",
        "writeFile"
      ]);
    await window.screenshot({ path: "test-results/screens/04-server-hub.png" });

    expect(pageErrors).toEqual([]);

    // Quitting stops the local server and saves the settings
    expect(findServerProcesses(dataPath)).toHaveLength(1);
    expect(await quit()).toEqual([]);
    const settings = JSON.parse(readFileSync(join(dataPath, "settings.json"), "utf8"));
    expect(settings).toMatchObject({ version: 2, nickname: "E2ETester", presence: "offline" });
  } finally {
    await cleanup();
  }
});
