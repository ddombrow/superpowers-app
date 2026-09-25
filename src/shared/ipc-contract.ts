// The only way the launcher UI (sandboxed renderer) talks to the main process.
// The preload exposes exactly these channels as `window.api`.

import type {
  AppInfo,
  AppUpdate,
  ChatEvent,
  LocalServerStatus,
  LocaleContexts,
  Presence,
  Registry,
  RegistryCommand,
  ServerConfig,
  ServerProbeResult,
  Settings,
  SettingsLoadResult
} from "./types";

/** Request/response calls: `await api.invoke(channel, ...args)` */
export interface InvokeChannels {
  "app:get-info": { args: []; result: AppInfo };
  "app:get-locales": {
    args: [namespaces: string[]];
    result: { contexts: LocaleContexts; fallbackContexts: LocaleContexts };
  };
  "app:check-for-update": { args: []; result: AppUpdate | null };
  "app:fetch-news": { args: []; result: string | null };
  "server:probe": { args: [baseUrl: string, password: string]; result: ServerProbeResult };

  "settings:load": { args: []; result: SettingsLoadResult };
  "server-config:load": { args: []; result: ServerConfig | null };

  "core:is-installed": { args: []; result: boolean };
  "core:install": { args: []; result: void };

  "registry:fetch": { args: []; result: Registry | null };
  "registry:run": {
    args: [command: RegistryCommand, id: string, downloadURL: string];
    result: { ok: boolean; error: string | null };
  };
}

/** Fire-and-forget messages: `api.send(channel, ...args)` */
export interface SendChannels {
  "app:quit": [];
  "app:open-dev-tools": [];
  "app:open-external": [url: string];
  "app:open-projects-folder": [];
  "app:set-http-auth": [hostnameAndPort: string, auth: { username: string; password: string }];

  "settings:save": [settings: Settings];
  "server-config:save": [config: ServerConfig];

  "local-server:start": [];
  "local-server:stop": [];

  "chat:connect": [nickname: string, presence: Presence];
  "chat:disconnect": [];
  "chat:set-presence": [presence: Presence];
  "chat:nick": [nickname: string];
  "chat:join": [channel: string];
  "chat:part": [channel: string];
  "chat:say": [target: string, message: string];
}

/** Main → renderer notifications: `api.on(channel, listener)` */
export interface EventChannels {
  "local-server:status": [status: LocalServerStatus];
  "local-server:log": [text: string];
  "core:install-progress": [value: number | null, max: number];
  "registry:progress": [id: string, percent: number];
  "chat:event": [event: ChatEvent];
  /** From the macOS menu (⌘W) */
  "app:close-tab": [];
}

export type InvokeChannel = keyof InvokeChannels;
export type SendChannel = keyof SendChannels;
export type EventChannel = keyof EventChannels;

// Runtime allowlists, checked against the interfaces above
const channelList =
  <T extends string>() =>
  <L extends T[]>(...list: L & ([T] extends [L[number]] ? unknown : never)) =>
    list;
export const invokeChannels = channelList<InvokeChannel>()(
  "app:get-info",
  "app:get-locales",
  "app:check-for-update",
  "app:fetch-news",
  "server:probe",
  "settings:load",
  "server-config:load",
  "core:is-installed",
  "core:install",
  "registry:fetch",
  "registry:run"
);
export const sendChannels = channelList<SendChannel>()(
  "app:quit",
  "app:open-dev-tools",
  "app:open-external",
  "app:open-projects-folder",
  "app:set-http-auth",
  "settings:save",
  "server-config:save",
  "local-server:start",
  "local-server:stop",
  "chat:connect",
  "chat:disconnect",
  "chat:set-presence",
  "chat:nick",
  "chat:join",
  "chat:part",
  "chat:say"
);
export const eventChannels = channelList<EventChannel>()(
  "local-server:status",
  "local-server:log",
  "core:install-progress",
  "registry:progress",
  "chat:event",
  "app:close-tab"
);

/** The object exposed on `window.api` by src/preload/app.ts */
export interface AppApi {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeChannels[C]["args"]): Promise<InvokeChannels[C]["result"]>;
  send<C extends SendChannel>(channel: C, ...args: SendChannels[C]): void;
  /** Returns a function that removes the listener */
  on<C extends EventChannel>(channel: C, listener: (...args: EventChannels[C]) => void): () => void;
}
