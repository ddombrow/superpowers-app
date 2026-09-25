// Preload for the launcher UI. It runs sandboxed and only exposes the
// channels declared in src/shared/ipc-contract.ts.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { type AppApi, eventChannels, invokeChannels, sendChannels } from "../shared/ipc-contract";

const allowedInvokes = new Set<string>(invokeChannels);
const allowedSends = new Set<string>(sendChannels);
const allowedEvents = new Set<string>(eventChannels);

const api: AppApi = {
  invoke(channel, ...args) {
    if (!allowedInvokes.has(channel)) throw new Error(`Unknown channel: ${channel}`);
    return ipcRenderer.invoke(channel, ...args);
  },
  send(channel, ...args) {
    if (!allowedSends.has(channel)) throw new Error(`Unknown channel: ${channel}`);
    ipcRenderer.send(channel, ...args);
  },
  on(channel, listener) {
    if (!allowedEvents.has(channel)) throw new Error(`Unknown channel: ${channel}`);
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) =>
      (listener as (...args: unknown[]) => void)(...args);
    ipcRenderer.on(channel, wrapped);
    return () => {
      ipcRenderer.removeListener(channel, wrapped);
    };
  }
};

contextBridge.exposeInMainWorld("api", api);
