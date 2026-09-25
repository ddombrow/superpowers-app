// The SupApp API, injected into server & project webviews and the windows they open.
// Its public surface must stay compatible with superpowers-core: see docs/supapp-compat.md

import * as remote from "@electron/remote";
import * as childProcess from "child_process";
import * as crypto from "crypto";
import * as electron from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

type Access = "readWrite" | "execute";
type ChooseFolderCallback = (folder: string | null) => void;
type ChooseFileCallback = (filename: string | null) => void;
type CheckPathAuthorizationCallback = (normalizedPath: string, access: Access | null) => void;

interface OpenWindowOptions {
  size?: { width: number; height: number };
  minSize?: { width: number; height: number };
  resizable?: boolean;
}

const currentWindow = remote.getCurrentWindow();

const secretKey = crypto.randomBytes(48).toString("hex");
electron.ipcRenderer.send("sup-app:setup-key", secretKey);

function checkPathAuthorization(pathToCheck: string, callback: CheckPathAuthorizationCallback) {
  electron.ipcRenderer
    .invoke("sup-app:check-path", secretKey, window.location.origin, pathToCheck)
    .then(({ normalizedPath, access }) => callback(normalizedPath, access));
}

namespace SupApp {
  export function onMessage(messageType: string, callback: (...args: any[]) => void) {
    electron.ipcRenderer.addListener(`sup-app-message-${messageType}`, (_event, ...args: any[]) => {
      callback(...args);
    });
  }
  export function sendMessage(windowId: number, message: string) {
    electron.ipcRenderer.send("sup-app:send-message", windowId, message);
  }

  export function getCurrentWindow() {
    return currentWindow;
  }
  export function showMainWindow() {
    electron.ipcRenderer.send("sup-app:show-main-window");
  }

  export function openWindow(url: string, options: OpenWindowOptions = {}) {
    if (options.size == null && options.minSize == null) {
      options.size = { width: 1280, height: 800 };
      options.minSize = { width: 800, height: 480 };
    }

    const electronWindowOptions: Electron.BrowserWindowConstructorOptions = {
      icon: path.join(remote.app.getAppPath(), "resources/icons/superpowers-256.png"),
      useContentSize: true,
      autoHideMenuBar: true,
      resizable: options.resizable ?? true,
      webPreferences: { nodeIntegration: false, contextIsolation: false, sandbox: false, preload: __filename }
    };

    if (options.size != null) {
      electronWindowOptions.width = options.size.width;
      electronWindowOptions.height = options.size.height;
    }

    if (options.minSize != null) {
      electronWindowOptions.minWidth = options.minSize.width;
      electronWindowOptions.minHeight = options.minSize.height;
    }

    const window = new remote.BrowserWindow(electronWindowOptions);
    window.webContents.on("will-navigate", (event) => {
      event.preventDefault();
    });
    window.loadURL(url);
    return window;
  }

  export function openLink(url: string) {
    electron.shell.openExternal(url);
  }
  export function showItemInFolder(path: string) {
    electron.shell.showItemInFolder(path);
  }

  export function createMenu() {
    return new remote.Menu();
  }
  export function createMenuItem(options: Electron.MenuItemConstructorOptions) {
    return new remote.MenuItem(options);
  }

  export namespace clipboard {
    export function copyFromDataURL(dataURL: string) {
      const image = electron.nativeImage.createFromDataURL(dataURL);
      const blob = new Blob([new Uint8Array(image.toPNG())], { type: "image/png" });
      electron.clipboard.write([new electron.ClipboardItem({ "image/png": blob })]);
    }
  }

  export function chooseFolder(callback: ChooseFolderCallback) {
    electron.ipcRenderer.invoke("sup-app:choose-folder", secretKey, window.location.origin).then(callback);
  }

  export function chooseFile(access: Access, callback: ChooseFileCallback) {
    electron.ipcRenderer.invoke("sup-app:choose-file", secretKey, window.location.origin, access).then(callback);
  }

  export function tryFileAccess(filePath: string, access: Access, callback: (err: Error | null) => void) {
    checkPathAuthorization(filePath, (_normalizedPath, authorization) => {
      if (authorization !== access) {
        callback(new Error("Unauthorized"));
        return;
      }

      fs.access(filePath, (err) => callback(err == null ? null : new Error("Not found")));
    });
  }

  export function mkdirp(folderPath: string, callback: (err: Error | null) => void) {
    checkPathAuthorization(folderPath, (normalizedFolderPath, authorization) => {
      if (authorization !== "readWrite") {
        callback(new Error(`Access to "${normalizedFolderPath}" hasn't been authorized for read/write.`));
        return;
      }

      fs.mkdir(normalizedFolderPath, { recursive: true }, (err) => callback(err));
    });
  }

  export function mktmpdir(callback: (err: Error | null, path: string | null) => void) {
    fs.mkdtemp(path.join(os.tmpdir(), "superpowers-temp-"), (err, tempFolderPath) => {
      if (err != null) {
        callback(err, null);
        return;
      }

      electron.ipcRenderer
        .invoke("sup-app:authorize-temp-folder", secretKey, window.location.origin, tempFolderPath)
        .then(() => callback(null, tempFolderPath));
    });
  }

  export function writeFile(filename: string, data: any, options: any, callback?: (err: Error | null) => void) {
    if (callback == null && typeof options === "function") {
      callback = options;
      options = null;
    }

    checkPathAuthorization(filename, (normalizedFilename, authorization) => {
      if (authorization !== "readWrite") {
        callback!(new Error(`Access to "${normalizedFilename}" hasn't been authorized for read/write.`));
        return;
      }

      // NOTE: Pages without Node (like the build window) pass Buffers from the
      // browserified "buffer" package, which fs.writeFile's type checks reject.
      if (data != null && data._isBuffer && !Buffer.isBuffer(data)) {
        data = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      }

      fs.writeFile(normalizedFilename, data, options, (err) => callback!(err));
    });
  }

  export function readDir(folderPath: string, callback: (err: NodeJS.ErrnoException | null, files: string[]) => void) {
    fs.readdir(folderPath, callback);
  }

  export function spawnChildProcess(
    filename: string,
    args: string[],
    callback: (err: Error | null, childProcess?: childProcess.ChildProcess) => void
  ) {
    checkPathAuthorization(filename, (normalizedFilename, authorization) => {
      if (authorization !== "execute") {
        callback(new Error(`Access to "${normalizedFilename}" for execution hasn't been authorized.`));
        return;
      }

      callback(null, childProcess.spawn(filename, args));
    });
  }
}

(global as any).SupApp = SupApp;
