// File system authorizations for the SupApp API (see src/preload/supapp.ts).
// Pages can only read/write files or folders the user picked, per origin.

import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { readFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { writeFileAtomic } from "./settings";

export type Access = "readWrite" | "execute";

interface OriginAuthorizations {
  folders: string[];
  rwFiles: string[];
  exeFiles: string[];
}

let authorizationsByOrigin: { [origin: string]: OriginAuthorizations } = {};

export function loadAuthorizations(dataPath: string) {
  try {
    const parsed = JSON.parse(readFileSync(join(dataPath, "authorizationsByOrigin.json"), "utf8"));
    if (parsed != null && typeof parsed === "object") authorizationsByOrigin = parsed;
  } catch {
    // Nothing authorized yet
  }
}

export async function saveAuthorizations(dataPath: string) {
  await writeFileAtomic(join(dataPath, "authorizationsByOrigin.json"), JSON.stringify(authorizationsByOrigin, null, 2));
}

function getAuthorizationsForOrigin(origin: string) {
  authorizationsByOrigin[origin] ??= { folders: [], rwFiles: [], exeFiles: [] };
  return authorizationsByOrigin[origin];
}

export function authorizeFolder(origin: string, folderPath: string) {
  getAuthorizationsForOrigin(origin).folders.push(normalize(folderPath));
}

export function authorizeFile(origin: string, filePath: string, access: Access) {
  const authorizations = getAuthorizationsForOrigin(origin);
  (access === "execute" ? authorizations.exeFiles : authorizations.rwFiles).push(normalize(filePath));
}

/** Files inside an authorized folder are read/write; execution must be authorized per file */
export function checkPathAuthorization(origin: string, pathToCheck: string): Access | null {
  const normalizedPath = normalize(pathToCheck);
  const authorizations = getAuthorizationsForOrigin(origin);

  if (authorizations.rwFiles.includes(normalizedPath)) return "readWrite";
  for (const folderPath of authorizations.folders) {
    if (normalizedPath.startsWith(folderPath.endsWith(sep) ? folderPath : folderPath + sep)) return "readWrite";
  }
  if (authorizations.exeFiles.includes(normalizedPath)) return "execute";
  return null;
}

export function resetAuthorizations() {
  authorizationsByOrigin = {};
}

// IPC from the SupApp preload. Each page registers a random secret key first,
// and every later request must present one of its keys.
const secretKeys = new WeakMap<WebContents, string[]>();

function checkKey(event: IpcMainInvokeEvent, secretKey: string) {
  if (!secretKeys.get(event.sender)?.includes(secretKey)) throw new Error("Invalid SupApp key");
}

export function setupSupAppIpc(showMainWindow: () => void) {
  ipcMain.on("sup-app:setup-key", (event, secretKey: string) => {
    const keys = secretKeys.get(event.sender) ?? [];
    keys.push(secretKey);
    secretKeys.set(event.sender, keys);
  });

  ipcMain.handle("sup-app:choose-folder", async (event, secretKey: string, origin: string) => {
    checkKey(event, secretKey);
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (result.canceled) return null;

    authorizeFolder(origin, result.filePaths[0]);
    return normalize(result.filePaths[0]);
  });

  ipcMain.handle("sup-app:choose-file", async (event, secretKey: string, origin: string, access: Access) => {
    checkKey(event, secretKey);
    const result = await dialog.showOpenDialog({ properties: ["openFile"] });
    if (result.canceled) return null;

    authorizeFile(origin, result.filePaths[0], access);
    return normalize(result.filePaths[0]);
  });

  ipcMain.handle("sup-app:authorize-temp-folder", (event, secretKey: string, origin: string, folderPath: string) => {
    checkKey(event, secretKey);
    authorizeFolder(origin, folderPath);
  });

  ipcMain.handle("sup-app:check-path", (event, secretKey: string, origin: string, pathToCheck: string) => {
    checkKey(event, secretKey);
    return { normalizedPath: normalize(pathToCheck), access: checkPathAuthorization(origin, pathToCheck) };
  });

  ipcMain.on("sup-app:send-message", (_event, windowId: number, message: string, args: unknown[] = []) => {
    BrowserWindow.fromId(windowId)?.webContents.send(`sup-app-message-${message}`, ...args);
  });

  ipcMain.on("sup-app:show-main-window", () => showMainWindow());
}
