import { app, Menu, Tray } from "electron";
import { join } from "node:path";
import * as i18n from "../shared/i18n";

let tray: Tray | null = null;

export function setupTrayOrDock(resourcesPath: string, restoreMainWindow: () => void) {
  const menu = Menu.buildFromTemplate([
    { label: i18n.t("tray:dashboard"), type: "normal", click: restoreMainWindow },
    { type: "separator" },
    { label: i18n.t("tray:exit"), type: "normal", click: () => app.quit() }
  ]);

  if (process.platform === "darwin") {
    app.dock?.setMenu(menu);
    return;
  }

  tray = new Tray(join(resourcesPath, "icons/tray-16.png"));
  tray.setToolTip("Superpowers");
  tray.setContextMenu(menu);
  tray.on("double-click", restoreMainWindow);
}

export function showStillRunningBalloon() {
  if (process.platform !== "win32" || tray == null) return;
  tray.displayBalloon({ title: i18n.t("tray:stillRunning.title"), content: i18n.t("tray:stillRunning.content") });
}
