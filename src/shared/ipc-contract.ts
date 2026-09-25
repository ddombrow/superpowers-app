// The only way the launcher UI (sandboxed renderer) talks to the main process.
// The preload exposes exactly these channels as `window.api`.

import type {
  AppInfo,
  AppUpdate,
  IrcEvent,
  LocalServerStatus,
  LocaleContexts,
  Presence,
  Registry,
  RegistryCommand,
  ServerConfig,
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

  "irc:connect": [nickname: string, presence: Presence];
  "irc:disconnect": [];
  "irc:set-presence": [presence: Presence];
  "irc:nick": [nickname: string];
  "irc:join": [channel: string];
  "irc:part": [channel: string];
  "irc:say": [target: string, message: string];
}

/** Main → renderer notifications: `api.on(channel, listener)` */
export interface EventChannels {
  "local-server:status": [status: LocalServerStatus];
  "local-server:log": [text: string];
  "core:install-progress": [value: number | null, max: number];
  "registry:progress": [id: string, percent: number];
  "irc:event": [event: IrcEvent];
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
  "irc:connect",
  "irc:disconnect",
  "irc:set-presence",
  "irc:nick",
  "irc:join",
  "irc:part",
  "irc:say"
);
export const eventChannels = channelList<EventChannel>()(
  "local-server:status",
  "local-server:log",
  "core:install-progress",
  "registry:progress",
  "irc:event"
);

/** The object exposed on `window.api` by src/preload/app.ts */
export interface AppApi {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeChannels[C]["args"]): Promise<InvokeChannels[C]["result"]>;
  send<C extends SendChannel>(channel: C, ...args: SendChannels[C]): void;
  /** Returns a function that removes the listener */
  on<C extends EventChannel>(channel: C, listener: (...args: EventChannels[C]) => void): () => void;
}
