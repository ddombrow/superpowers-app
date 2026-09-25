import * as remoteMain from "@electron/remote/main";
import { app, BrowserWindow, dialog, type WebContents } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as i18n from "../shared/i18n";
import type { AppInfo } from "../shared/types";
import { loadAuthorizations, saveAuthorizations, setupSupAppIpc } from "./authorizations";
import { setupHttpAuth } from "./httpAuth";
import { openExternal, setupIpc } from "./ipc";
import { IrcService } from "./irc";
import { loadLocales, resolveLanguageCode } from "./locales";
import { LocalServer } from "./localServer";
import * as menu from "./menu";
import { getPaths, setupElectronProfilePath } from "./paths";
import { RegistryService } from "./registry";
import { ServerConfigWriter } from "./serverConfig";
import { killAllServerProcesses } from "./serverProcess";
import { SettingsStore } from "./settings";
import { setupTrayOrDock, showStillRunningBalloon } from "./tray";

const resourcesPath = join(app.getAppPath(), "resources");
const localesPath = join(resourcesPath, "locales");
const appPreloadPath = join(__dirname, "../preload/app.js");
const supAppPreloadPath = join(__dirname, "../preload/supapp.js");

let mainWindow: BrowserWindow | null = null;
let creatingMainWindow = false;

setupElectronProfilePath();
remoteMain.initialize();
setupWebContentsSecurity();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", restoreMainWindow);
  app.on("activate", restoreMainWindow);
  app.whenReady().then(start, (err) => fatalError(err));
}

// Last resort: never leave core servers running without the app
process.on("exit", killAllServerProcesses);

async function start() {
  menu.setup(app);

  // Startup errors are shown in the system language until settings are loaded
  i18n.setLanguageCode(await resolveLanguageCode(localesPath, undefined, app.getLocale()));
  await addLocales(["startup"]);

  const paths = await getPaths().catch(fatalError);

  const settings = new SettingsStore(paths.userDataPath);
  const settingsLoadResult = await settings.load();

  const languageCode = await resolveLanguageCode(
    localesPath,
    settings.get("languageCode") as string | undefined,
    app.getLocale()
  );
  i18n.setLanguageCode(languageCode);
  await addLocales(["startup", "tray"]);

  loadAuthorizations(paths.userDataPath);

  const packageJSON = JSON.parse(readFileSync(join(app.getAppPath(), "package.json"), "utf8"));
  const info: AppInfo = {
    ...paths,
    languageCode,
    appVersion: app.isPackaged ? `v${app.getVersion()}` : `v${app.getVersion()}-dev`,
    isPackaged: app.isPackaged,
    appApiVersion: packageJSON.superpowers.appApiVersion
  };

  const serverConfig = new ServerConfigWriter(paths.userDataPath);
  const localServer = new LocalServer(paths.corePath, paths.userDataPath);
  const registry = new RegistryService(paths.corePath, paths.userDataPath);
  const irc = new IrcService(getIrcNetworkOverride());

  setupIpc({
    info,
    localesPath,
    settings,
    serverConfig,
    localServer,
    registry,
    irc,
    getMainWindow: () => mainWindow,
    quit: () => app.quit()
  });
  // The renderer asks for the settings once; hand it the result of the load above
  settings.load = async () => settingsLoadResult;

  setupSupAppIpc(restoreMainWindow);
  setupHttpAuth();
  setupCleanExit(async () => {
    irc.disconnect();
    await Promise.allSettled([
      localServer.stop(),
      settings.flush(),
      serverConfig.flush(),
      saveAuthorizations(paths.userDataPath)
    ]);
  });

  setupTrayOrDock(resourcesPath, restoreMainWindow);
  createMainWindow();
}

async function addLocales(namespaces: string[]) {
  const { contexts, fallbackContexts } = await loadLocales(localesPath, i18n.languageCode, namespaces);
  i18n.addContexts(contexts, fallbackContexts);
}

function fatalError(err: unknown): never {
  const message = err instanceof i18n.LocalizedError ? i18n.t(err.key, err.variables) : String(err);
  dialog.showErrorBox(i18n.t("startup:failedToStart"), message);
  app.exit(1);
  throw err;
}

function createMainWindow() {
  creatingMainWindow = true;
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    minWidth: 800,
    minHeight: 480,
    icon: join(resourcesPath, "icons/superpowers-256.png"),
    useContentSize: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: appPreloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });
  creatingMainWindow = false;

  const window = mainWindow;
  // electron-vite serves the UI with hot reloading during `npm run dev`
  const devServerURL = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devServerURL != null) void window.loadURL(devServerURL);
  else void window.loadFile(join(__dirname, "../renderer/index.html"));
  window.once("ready-to-show", () => window.show());

  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
    void openExternal(event.url);
  });

  // Server & project pages get the SupApp preload, and nothing else
  window.webContents.on("will-attach-webview", (event, webPreferences, params) => {
    if (!/^https?:\/\//.test(params.src)) {
      event.preventDefault();
      return;
    }

    webPreferences.preload = supAppPreloadPath;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = false;
    webPreferences.sandbox = false;
  });

  window.on("close", (event) => {
    if (quitState !== "running") return;

    // Keep running in the background (tray / dock)
    event.preventDefault();
    if (process.platform === "darwin") {
      window.hide();
    } else {
      // Minimize first to convey that the app is still running
      window.minimize();
      setTimeout(() => {
        if (window.isMinimized()) window.hide();
      }, 200);
      showStillRunningBalloon();
    }
  });
}

function restoreMainWindow() {
  if (mainWindow == null || quitState !== "running") return;
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function setupWebContentsSecurity() {
  app.on("web-contents-created", (_event, webContents: WebContents) => {
    // Links opening new windows go to the system browser. SupApp.openWindow() is unaffected.
    webContents.setWindowOpenHandler(({ url }) => {
      void openExternal(url);
      return { action: "deny" };
    });

    // NOTE: SupApp hands out live BrowserWindow, Menu and ChildProcess objects,
    // so server & project pages need @electron/remote. The launcher UI doesn't.
    // See docs/supapp-compat.md
    if (!creatingMainWindow) remoteMain.enable(webContents);
  });
}

let quitState: "running" | "shuttingDown" | "done" = "running";

/** Stops the local server, saves everything, then quits */
function setupCleanExit(shutdown: () => Promise<void>) {
  app.on("before-quit", (event) => {
    if (quitState === "done") return;
    event.preventDefault();
    if (quitState === "shuttingDown") return;

    quitState = "shuttingDown";
    console.log("Exiting cleanly...");
    shutdown().finally(() => {
      console.log("Exited cleanly.");
      quitState = "done";
      app.quit();
    });
  });
}

/** SUPERPOWERS_IRC_SERVER=host:port connects chat to another server, without TLS (used by tests) */
function getIrcNetworkOverride() {
  const override = process.env.SUPERPOWERS_IRC_SERVER;
  if (override == null || override === "") return undefined;
  const [host, port] = override.split(":");
  return { host, port: Number(port), tls: false };
}
