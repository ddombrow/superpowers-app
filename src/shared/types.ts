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

/** One-time messages to show the user after a settings migration */
export type SettingsNotice = "liberaMigration";

export type SettingsLoadResult =
  | { ok: true; settings: Settings; isFirstRun: boolean; notices: SettingsNotice[] }
  | { ok: false; error: string; settings: Settings };

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

export type IrcEvent =
  | { type: "connecting"; host: string; port: number }
  | { type: "registered"; nick: string }
  | { type: "motd"; lines: string[] }
  | { type: "info"; text: string }
  | { type: "topic"; channel: string; topic: string }
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
