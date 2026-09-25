import type { Component } from "svelte";
import { api, appInfo } from "./api";
import { languageChatRooms, startChat } from "./chat.svelte";
import { confirm, info, openDialog, type DialogProps } from "./dialogs.svelte";
import { languageCode, t } from "./i18n";
import { startLocalServer } from "./localServer.svelte";
import {
  getRegistry,
  getUpdatableItems,
  itemId,
  refreshRegistry,
  runRegistryAction,
  updateAll
} from "./registry.svelte";
import { loadServerConfig } from "./serverConfig.svelte";
import { loadSettings, notices, saveSettings, settings } from "./settings.svelte";
import { tabs } from "./tabs.svelte";

/** How long the splash screen takes to fade out */
export const splashFadeDuration = 300;

export const startup = $state({
  /** The splash screen is shown until "ready" */
  phase: "starting" as "starting" | "ready",
  status: "",
  progress: null as { value: number | null; max: number } | null,
  /** Shown over the UI while the first system installs */
  waitingForGameInstall: false
});

export interface WelcomeResult {
  nickname: string;
  connectToChat: boolean;
}

/** The welcome dialog component is passed in to avoid a circular import */
export async function boot(welcomeDialog: Component<DialogProps<WelcomeResult>>) {
  startup.status = t("startup:startingUp");

  const settingsError = await loadSettings();
  if (settingsError != null) {
    const proceed = await confirm(
      t("startup:errors.couldNotLoadSettings", {
        settingsPath: `${appInfo.userDataPath}/settings.json`,
        reason: settingsError
      }),
      { confirmLabel: t("startup:startAnyway"), cancelLabel: t("common:actions.close") }
    );
    if (!proceed) {
      api.send("app:quit");
      return;
    }
  }

  await checkAppUpdate();
  await checkCoreUpdate();

  await loadServerConfig();
  void refreshRegistry();
  startup.phase = "ready";
  await new Promise((resolve) => setTimeout(resolve, splashFadeDuration));

  if (settings.nickname == null) {
    await welcome(welcomeDialog);
    await installFirstSystem();
  } else {
    if (notices.includes("liberaMigration")) void info(t("common:chat.liberaMigration"));
    startChat();
    await updateSystemsAndPlugins();
    startLocalServerIfNeeded();
  }
}

function startLocalServerIfNeeded() {
  if (settings.autoStartServer) startLocalServer();
}

async function checkAppUpdate() {
  const update = await api.invoke("app:check-for-update");
  if (update == null) return;

  const download = await confirm(t("startup:updateAvailable.app", { latest: update.latest, current: update.current }), {
    confirmLabel: t("common:actions.download"),
    cancelLabel: t("common:actions.skip")
  });
  if (download) {
    api.send("app:open-external", update.downloadURL);
    api.send("app:quit");
    await new Promise(() => {
      /* Quitting */
    });
  }
}

async function checkCoreUpdate() {
  try {
    if (await api.invoke("core:is-installed")) await updateCore();
    else await installCore();
  } catch (err) {
    await info(t("startup:status.installingCoreFailed", { error: (err as Error).message }));
  }
}

async function withProgress<T>(task: () => Promise<T>): Promise<T> {
  startup.status = t("startup:status.installingCore");
  startup.progress = { value: null, max: 1 };
  try {
    const result = await task();
    startup.status = t("startup:status.installingCoreSucceed");
    return result;
  } finally {
    startup.progress = null;
  }
}

function installCore() {
  return withProgress(async () => {
    const stopListening = api.on("core:install-progress", (value, max) => {
      startup.progress = { value, max };
    });
    try {
      await api.invoke("core:install");
    } finally {
      stopListening();
    }
  });
}

async function updateCore() {
  const registry = await getRegistry();
  if (registry == null || registry.core.isLocalDev || registry.core.version === registry.core.localVersion) return;

  const update = await confirm(
    t("startup:updateAvailable.core", { latest: registry.core.version, current: registry.core.localVersion ?? "" }),
    { confirmLabel: t("common:actions.update"), cancelLabel: t("common:actions.skip") }
  );
  if (!update) return;

  await withProgress(async () => {
    const stopListening = api.on("registry:progress", (id, percent) => {
      if (id === "core") startup.progress = { value: percent, max: 100 };
    });
    try {
      const result = await api.invoke("registry:run", "update", "core", registry.core.downloadURL);
      if (!result.ok) throw new Error(result.error ?? "Update failed");
    } finally {
      stopListening();
    }
  });

  // Core changed, so the registry's local versions might have too
  await refreshRegistry();
}

async function welcome(welcomeDialog: Component<DialogProps<WelcomeResult>>) {
  const result = await openDialog(welcomeDialog, {});

  settings.nickname = result?.nickname ?? "Nickname";
  settings.presence = result?.connectToChat ? "online" : "offline";
  if (result?.connectToChat) {
    settings.savedChatrooms = ["#superpowers-html5"];
    if (languageChatRooms.includes(languageCode)) settings.savedChatrooms.push(`#superpowers-html5-${languageCode}`);
  }
  saveSettings();
  startChat();
}

async function installFirstSystem() {
  const install = await confirm(t("welcome:askGameInstall.prompt"), {
    title: t("welcome:askGameInstall.title"),
    confirmLabel: t("common:actions.install"),
    cancelLabel: t("common:actions.skip")
  });

  if (!install) {
    startLocalServerIfNeeded();
    return;
  }

  tabs.open({ id: "server-settings", kind: "server-settings" });
  startup.waitingForGameInstall = true;
  try {
    await runRegistryAction("install", { systemId: "game" });
  } finally {
    startup.waitingForGameInstall = false;
  }

  await info(t("welcome:serverInformation.info"), {
    title: t("welcome:serverInformation.title"),
    confirmLabel: t("welcome:serverInformation.gotIt")
  });
  startLocalServerIfNeeded();
  await info(t("welcome:sidebarInformation.info"), { title: t("welcome:sidebarInformation.title") });
  tabs.activate("home");
}

async function updateSystemsAndPlugins() {
  const registry = await getRegistry();
  if (registry == null) return;

  const items = getUpdatableItems(registry);
  if (items.length === 0) return;

  const update = await confirm(
    t("startup:updateAvailable.systemsAndPlugins", { systemsAndPlugins: items.map(itemId).join(", ") }),
    { confirmLabel: t("common:actions.update"), cancelLabel: t("common:actions.skip") }
  );
  if (!update) return;

  tabs.open({ id: "server-settings", kind: "server-settings" });
  await updateAll();
}
