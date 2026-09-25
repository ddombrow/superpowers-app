import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findServerProcesses, launchApp } from "./fixtures";

test("first launch: welcome, local server, hub webview with SupApp, clean quit", async () => {
  const { app, window, dataPath, quit, cleanup } = await launchApp();
  const pageErrors: string[] = [];
  window.on("pageerror", (err) => pageErrors.push(err.message));
  window.on("console", (message) => {
    // Content Security Policy violations and other errors logged by the UI
    if (message.type() === "error") pageErrors.push(message.text());
  });

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

    const welcome = window.getByRole("dialog", { name: "Welcome to Superpowers!" });
    await expect(welcome).toBeVisible({ timeout: 60_000 });
    await window.screenshot({ path: "test-results/screens/01-welcome.png" });

    await welcome.getByRole("textbox", { name: "Nickname" }).fill("E2ETester");
    await welcome.getByRole("checkbox", { name: "Connect to community chat" }).uncheck();
    await welcome.getByRole("button", { name: "Get started!" }).click();

    // "Install the game system?" prompt
    const installPrompt = window.getByRole("dialog", { name: "Getting started" });
    await expect(installPrompt).toBeVisible();
    await window.screenshot({ path: "test-results/screens/02-install-prompt.png" });
    await installPrompt.getByRole("button", { name: "Skip" }).click();

    const localServerStatus = window.getByRole("region", { name: "My Server" }).getByRole("status");
    await expect(localServerStatus).toHaveText("Server running.", { timeout: 60_000 });
    await window.screenshot({ path: "test-results/screens/03-server-running.png" });

    // Open the local server: its hub loads in a webview with the SupApp preload
    await window.getByRole("option", { name: /My Server/ }).dblclick();
    await expect(window.getByRole("tab", { name: /My Server/ })).toHaveAttribute("aria-selected", "true");
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
