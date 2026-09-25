import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { launchApp } from "./fixtures";

test("a second instance exits and leaves the first one running", async () => {
  const { app, window, dataPath, cleanup } = await launchApp();

  try {
    const welcome = window.getByRole("dialog", { name: "Welcome to Superpowers!" });
    await expect(welcome).toBeVisible({ timeout: 60_000 });

    // In Node, the "electron" package exports the path to the Electron binary
    const electronPath =
      process.env.SUPERPOWERS_EXECUTABLE ?? ((await import("electron")).default as unknown as string);
    const args = process.env.SUPERPOWERS_EXECUTABLE != null ? [] : [join(__dirname, "..")];
    const second = spawn(electronPath, [...args, `--core-path=${dataPath}`], { stdio: "ignore" });
    const exitCode = await new Promise<number | null>((resolve) => second.on("exit", resolve));

    expect(exitCode).toBe(0);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await expect(welcome).toBeVisible();
  } finally {
    await cleanup();
  }
});
