import * as dialogs from "simple-dialogs";
import type { Registry } from "../shared/types";

import { api } from "./api";
import * as systemServerSettings from "./serverSettings/systems";
import * as i18n from "../shared/i18n";
import * as splashScreen from "./splashScreen";

const confirm = (label: string, options: dialogs.ConfirmOptions) =>
  new Promise<boolean>((resolve) => new dialogs.ConfirmDialog(label, options, resolve));
const info = (label: string) => new Promise<void>((resolve) => new dialogs.InfoDialog(label, null, () => resolve()));

/** Resolves once the app can start, i.e. no update is being downloaded */
export async function checkForUpdates() {
  await checkAppUpdate();
  await checkCoreUpdate();
}

async function checkAppUpdate() {
  const update = await api.invoke("app:check-for-update");
  if (update == null) return;

  const shouldDownload = await confirm(i18n.t("startup:updateAvailable.app", { latest: update.latest, current: update.current }), {
    validationLabel: i18n.t("common:actions.download"),
    cancelLabel: i18n.t("common:actions.skip")
  });

  if (shouldDownload) {
    api.send("app:open-external", update.downloadURL);
    api.send("app:quit");
    await new Promise(() => { /* Quitting */ });
  }
}

async function checkCoreUpdate() {
  try {
    if (await api.invoke("core:is-installed")) await updateCore();
    else await firstCoreInstall();
  } catch (err) {
    await info(i18n.t("startup:status.installingCoreFailed", { error: (err as Error).message }));
  }
}

async function firstCoreInstall() {
  splashScreen.setStatus(i18n.t("startup:status.installingCore"));
  splashScreen.setProgressVisible(true);
  splashScreen.setProgressValue(null);

  const removeListener = api.on("core:install-progress", (value, max) => {
    splashScreen.setProgressMax(max);
    splashScreen.setProgressValue(value);
  });

  try {
    await api.invoke("core:install");
  } finally {
    removeListener();
    splashScreen.setProgressVisible(false);
  }

  splashScreen.setStatus(i18n.t("startup:status.installingCoreSucceed"));
}

async function updateCore() {
  const registry = await new Promise<Registry | null>((resolve) => {
    systemServerSettings.getRegistry(resolve);
  });
  if (registry == null || registry.core.isLocalDev || registry.core.version === registry.core.localVersion) return;

  const shouldUpdate = await confirm(
    i18n.t("startup:updateAvailable.core", { latest: registry.core.version, current: registry.core.localVersion }),
    { validationLabel: i18n.t("common:actions.update"), cancelLabel: i18n.t("common:actions.skip") }
  );
  if (!shouldUpdate) return;

  splashScreen.setStatus(i18n.t("startup:status.installingCore"));
  splashScreen.setProgressVisible(true);
  splashScreen.setProgressMax(100);
  splashScreen.setProgressValue(null);

  const removeListener = api.on("registry:progress", (id, percent) => {
    if (id === "core") splashScreen.setProgressValue(percent);
  });

  let result: { ok: boolean; error: string | null };
  try {
    result = await api.invoke("registry:run", "update", "core", registry.core.downloadURL);
  } finally {
    removeListener();
    splashScreen.setProgressVisible(false);
  }

  if (!result.ok) throw new Error(result.error ?? "Update failed");
  splashScreen.setStatus(i18n.t("startup:status.installingCoreSucceed"));
}
