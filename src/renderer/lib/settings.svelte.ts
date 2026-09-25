import type { ServerEntry, Settings } from "../../shared/types";
import { api } from "./api";

type AppSettings = Omit<Settings, "favoriteServers"> & { favoriteServers: ServerEntry[] };

export const settings = $state<AppSettings>({
  favoriteServers: [],
  recentProjects: [],
  autoStartServer: true,
  nickname: null,
  presence: "offline",
  savedChatrooms: []
});

export let isFirstRun = false;

/** Resolves with an error message if the settings file couldn't be read (defaults are used then) */
export async function loadSettings(): Promise<string | null> {
  const result = await api.invoke("settings:load");
  Object.assign(settings, {
    ...result.settings,
    favoriteServers: result.settings.favoriteServers.map((entry, index) => ({ ...entry, id: index.toString() }))
  });

  if (!result.ok) return result.error;
  isFirstRun = result.isFirstRun;
  return null;
}

/** Sends the settings to the main process, which takes care of writing them to disk */
export function saveSettings() {
  const snapshot = $state.snapshot(settings);
  api.send("settings:save", {
    ...snapshot,
    favoriteServers: snapshot.favoriteServers.map(({ hostname, port, label, password }) => ({
      hostname,
      port,
      label,
      password
    }))
  });
}

export function addFavoriteServer(entry: Omit<ServerEntry, "id">) {
  const id = Math.max(-1, ...settings.favoriteServers.map((server) => Number(server.id))) + 1;
  settings.favoriteServers.push({ ...entry, id: id.toString() });
  saveSettings();
  return id.toString();
}

export function updateFavoriteServer(id: string, entry: Omit<ServerEntry, "id">) {
  const server = settings.favoriteServers.find((server) => server.id === id);
  if (server == null) return;
  Object.assign(server, entry);
  saveSettings();
}

export function removeFavoriteServer(id: string) {
  const index = settings.favoriteServers.findIndex((server) => server.id === id);
  if (index === -1) return;
  settings.favoriteServers.splice(index, 1);
  saveSettings();
}

export function moveFavoriteServer(id: string, toIndex: number) {
  const index = settings.favoriteServers.findIndex((server) => server.id === id);
  if (index === -1) return;
  const [server] = settings.favoriteServers.splice(index, 1);
  settings.favoriteServers.splice(Math.min(toIndex, settings.favoriteServers.length), 0, server);
  saveSettings();
}
