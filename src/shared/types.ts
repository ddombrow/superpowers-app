export interface ServerEntry {
  id: string;
  hostname: string;
  port: string;
  label: string;
  password: string;
}

export type Presence = "online" | "away" | "offline";

export interface Settings {
  favoriteServers: Omit<ServerEntry, "id">[];
  recentProjects: { host: string; projectId: string; name: string }[];
  autoStartServer: boolean;
  nickname: string | null;
  presence: Presence;
  savedChatrooms: string[];
}

export type SettingsLoadResult =
  { ok: true; settings: Settings; isFirstRun: boolean } | { ok: false; error: string; settings: Settings };

export interface ServerConfig {
  serverName: string | null;
  mainPort: number;
  buildPort: number;
  password: string;
  maxRecentBuilds: number;
  [key: string]: unknown;
}

export interface RegistryItem {
  version: string;
  downloadURL: string;
  releaseNotesURL: string;
  localVersion: string | null;
  isLocalDev: boolean;
}

export interface RegistrySystem extends RegistryItem {
  repository: string;
  plugins: { [authorName: string]: { [pluginName: string]: RegistryItem } };
}

export interface Registry {
  version: number;
  core: RegistryItem;
  systems: { [systemId: string]: RegistrySystem };
}

export type RegistryCommand = "install" | "uninstall" | "update";

export type LocalServerStatus = "starting" | "started" | "stopping" | "stopped";

export interface AppInfo {
  corePath: string;
  userDataPath: string;
  languageCode: string;
  /** e.g. "v6.1.0", or "v6.1.0-dev" when not packaged */
  appVersion: string;
  isPackaged: boolean;
  appApiVersion: number;
  /** The chat backend, if any (see src/main/chat/backend.ts); without one, the chat UI is hidden */
  chat: { name: string } | null;
}

export type LocaleContexts = { [namespace: string]: LocaleValue };
export interface LocaleValue {
  [key: string]: LocaleValue | string;
}

export interface AppUpdate {
  latest: string;
  current: string;
  downloadURL: string;
}

/** What a chat backend reports to the UI (see src/main/chat/backend.ts) */
export type ChatEvent =
  | { type: "connecting" }
  | { type: "registered"; nick: string }
  /** Status messages from the service, shown in the status tab */
  | { type: "info"; text: string }
  | { type: "topic"; channel: string; topic: string }
  /** `modes`: "o" for operators, "v" for voiced users */
  | { type: "userlist"; channel: string; users: { nick: string; modes: string[] }[] }
  | { type: "join"; channel: string; nick: string }
  | { type: "part"; channel: string; nick: string; message: string }
  | { type: "quit"; nick: string; message: string }
  | { type: "nick"; nick: string; newNick: string }
  | { type: "mode"; target: string; modes: { mode: string; param?: string }[] }
  | { type: "away"; nick: string; message: string }
  | { type: "message"; kind: "privmsg" | "notice" | "action"; from: string; to: string; message: string }
  | { type: "disconnected"; reason: string | null };

export type ServerProbeResult =
  | { ok: true; buildPort: number }
  | { ok: false; error: "unreachable" | "unauthorized" | "notSuperpowers" }
  | { ok: false; error: "incompatible"; serverApiVersion: number };
