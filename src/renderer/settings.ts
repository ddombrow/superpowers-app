import { api } from "./api";
import type { Presence, ServerEntry, Settings, SettingsNotice } from "../shared/types";

export let favoriteServers: ServerEntry[];
export let favoriteServersById: { [id: string]: ServerEntry };

export let recentProjects: Settings["recentProjects"];
export let autoStartServer: boolean;

export let nickname: string;
export let presence: Presence;
export let savedChatrooms: string[];

/** One-time messages to show after a settings migration */
export let notices: SettingsNotice[] = [];

export function setNickname(newNickname: string) {
  nickname = newNickname;
}

export function setPresence(newPresence: Presence) {
  presence = newPresence;
}

export function setSavedChatrooms(newSavedChatrooms: string[]) {
  savedChatrooms = newSavedChatrooms;
}

export function setAutoStartServer(enabled: boolean) {
  autoStartServer = enabled;
}

/** Resolves with an error message if the settings file couldn't be read (defaults are used then) */
export async function load(): Promise<string | null> {
  const result = await api.invoke("settings:load");

  favoriteServersById = {};
  favoriteServers = result.settings.favoriteServers.map((entry, index) => ({ ...entry, id: index.toString() }));
  for (const entry of favoriteServers) favoriteServersById[entry.id] = entry;

  recentProjects = result.settings.recentProjects;
  autoStartServer = result.settings.autoStartServer;
  nickname = result.settings.nickname;
  presence = result.settings.presence;
  savedChatrooms = result.settings.savedChatrooms;

  if ("error" in result) return result.error;
  notices = result.notices;
  return null;
}

/** Sends the settings to the main process, which takes care of writing them to disk */
export function scheduleSave() {
  api.send("settings:save", {
    favoriteServers: favoriteServers.map(({ hostname, port, label, password }) => ({ hostname, port, label, password })),
    recentProjects,
    autoStartServer,
    nickname,
    presence,
    savedChatrooms
  });
}
