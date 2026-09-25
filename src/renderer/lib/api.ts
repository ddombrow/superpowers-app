import type { AppApi } from "../../shared/ipc-contract";
import type { AppInfo } from "../../shared/types";

/** Exposed by src/preload/app.ts */
export const api = (window as unknown as { api: AppApi }).api;

export let appInfo: AppInfo;
export function setAppInfo(info: AppInfo) {
  appInfo = info;
}
