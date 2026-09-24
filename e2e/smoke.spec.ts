import { expect, test } from "@playwright/test";
import { launchApp } from "./fixtures";

test("first launch: welcome dialog, skip game install, local server starts", async () => {
  const { app, window, cleanup } = await launchApp();
  const pageErrors: string[] = [];
  window.on("pageerror", (err) => pageErrors.push(err.message));

  try {
    await expect(window).toHaveTitle("Superpowers");

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
  } finally {
    await cleanup();
  }
});
