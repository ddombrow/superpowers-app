import { ipcMain, shell, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { join } from "node:path";
import type {
  EventChannel,
  EventChannels,
  InvokeChannel,
  InvokeChannels,
  SendChannel,
  SendChannels
} from "../shared/ipc-contract";
import type { AppInfo } from "../shared/types";
import { installCore, isCoreInstalled } from "./coreInstaller";
import { setHttpAuth } from "./httpAuth";
import type { IrcService } from "./irc";
import { loadLocales } from "./locales";
import { fetchNews } from "./news";
import { probeServer } from "./serverProbe";
import type { LocalServer } from "./localServer";
import type { RegistryService } from "./registry";
import { loadServerConfig, type ServerConfigWriter } from "./serverConfig";
import type { SettingsStore } from "./settings";
import { checkForAppUpdate } from "./updates";

export interface Services {
  info: AppInfo;
  localesPath: string;
  settings: SettingsStore;
  serverConfig: ServerConfigWriter;
  localServer: LocalServer;
  registry: RegistryService;
  irc: IrcService;
  getMainWindow: () => BrowserWindow | null;
  quit: () => void;
}

function handle<C extends InvokeChannel>(
  channel: C,
  handler: (...args: InvokeChannels[C]["args"]) => InvokeChannels[C]["result"] | Promise<InvokeChannels[C]["result"]>,
  isTrusted: (event: IpcMainInvokeEvent) => boolean
) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrusted(event)) throw new Error(`Untrusted sender for ${channel}`);
    return handler(...(args as InvokeChannels[C]["args"]));
  });
}

function on<C extends SendChannel>(
  channel: C,
  listener: (...args: SendChannels[C]) => void,
  isTrusted: (event: IpcMainEvent) => boolean
) {
  ipcMain.on(channel, (event, ...args) => {
    if (isTrusted(event)) listener(...(args as SendChannels[C]));
  });
}

export function setupIpc(services: Services) {
  const { info, settings, serverConfig, localServer, registry, irc } = services;

  // Only the launcher window may use these channels, not server webviews or project windows
  const isTrusted = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    event.sender === services.getMainWindow()?.webContents;

  const emit = <C extends EventChannel>(channel: C, ...args: EventChannels[C]) => {
    const window = services.getMainWindow();
    if (window != null && !window.isDestroyed()) window.webContents.send(channel, ...args);
  };

  handle("app:get-info", () => info, isTrusted);
  handle(
    "app:get-locales",
    (namespaces) => loadLocales(services.localesPath, info.languageCode, namespaces),
    isTrusted
  );
  handle("app:check-for-update", () => (info.isPackaged ? checkForAppUpdate(info.appVersion) : null), isTrusted);

  handle("app:fetch-news", () => fetchNews(info.languageCode), isTrusted);
  handle("server:probe", (baseUrl, password) => probeServer(baseUrl, password, info.appApiVersion), isTrusted);

  handle("settings:load", () => settings.load(), isTrusted);
  on("settings:save", (newSettings) => settings.save(newSettings), isTrusted);

  handle("server-config:load", () => loadServerConfig(info.corePath, info.userDataPath), isTrusted);
  on("server-config:save", (config) => serverConfig.save(config), isTrusted);

  handle("core:is-installed", () => isCoreInstalled(info.corePath), isTrusted);
  handle(
    "core:install",
    () => installCore(info.corePath, (value, max) => emit("core:install-progress", value, max)),
    isTrusted
  );

  handle("registry:fetch", () => registry.fetch(), isTrusted);
  handle("registry:run", (command, id, downloadURL) => registry.run(command, id, downloadURL), isTrusted);
  registry.on("progress", (id, percent) => emit("registry:progress", id, percent));

  // The server reads its config on startup, so pending edits must be saved first
  on("local-server:start", () => void serverConfig.flush().then(() => localServer.start()), isTrusted);
  on("local-server:stop", () => void localServer.stop(), isTrusted);
  localServer.on("status", (status) => emit("local-server:status", status));
  localServer.on("log", (text) => emit("local-server:log", text));

  on("irc:connect", (nickname, presence) => irc.connect(nickname, presence), isTrusted);
  on("irc:disconnect", () => irc.disconnect(), isTrusted);
  on("irc:set-presence", (presence) => irc.setPresence(presence), isTrusted);
  on("irc:nick", (nickname) => irc.changeNick(nickname), isTrusted);
  on("irc:join", (channel) => irc.join(channel), isTrusted);
  on("irc:part", (channel) => irc.part(channel), isTrusted);
  on("irc:say", (target, message) => irc.say(target, message), isTrusted);
  irc.on("event", (event) => emit("irc:event", event));

  on("app:quit", () => services.quit(), isTrusted);
  on("app:open-dev-tools", () => services.getMainWindow()?.webContents.openDevTools(), isTrusted);
  on("app:open-external", (url) => void openExternal(url), isTrusted);
  on("app:open-projects-folder", () => void shell.openPath(join(info.userDataPath, "projects")), isTrusted);
  on("app:set-http-auth", (hostnameAndPort, auth) => setHttpAuth(hostnameAndPort, auth), isTrusted);
}

/** Only web and mail links are opened outside of the app */
export async function openExternal(url: string) {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return;
  }
  if (["http:", "https:", "mailto:"].includes(protocol)) await shell.openExternal(url);
}
