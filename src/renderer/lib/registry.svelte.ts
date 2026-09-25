import type { Registry, RegistryCommand, RegistryItem } from "../../shared/types";
import { api } from "./api";
import { info } from "./dialogs.svelte";
import { localServer } from "./localServer.svelte";

export const registry = $state({
  data: null as Registry | null,
  fetching: false,
  /** Progress of running installs/updates, by item ID ("game", "game:author/plugin") */
  progress: {} as Record<string, number | null>
});

api.on("registry:progress", (id, percent) => {
  if (id in registry.progress) registry.progress[id] = percent;
});

let pendingFetch: Promise<Registry | null> | null = null;

export function refreshRegistry(): Promise<Registry | null> {
  pendingFetch ??= (async () => {
    registry.fetching = true;
    registry.data = null;
    try {
      registry.data = await api.invoke("registry:fetch");
      return registry.data;
    } finally {
      registry.fetching = false;
      pendingFetch = null;
    }
  })();
  return pendingFetch;
}

/** The registry, fetched on first use */
export function getRegistry() {
  return registry.data != null ? Promise.resolve(registry.data) : refreshRegistry();
}

export interface ItemPath {
  systemId: string;
  authorName?: string;
  pluginName?: string;
}

export const itemId = ({ systemId, authorName, pluginName }: ItemPath) =>
  pluginName != null ? `${systemId}:${authorName}/${pluginName}` : systemId;

export function parseItemId(id: string): ItemPath {
  const [systemId, pluginPath] = id.split(":");
  if (pluginPath == null) return { systemId };
  const [authorName, pluginName] = pluginPath.split("/");
  return { systemId, authorName, pluginName };
}

export function getItem(data: Registry, { systemId, authorName, pluginName }: ItemPath): RegistryItem | undefined {
  const system = data.systems[systemId];
  if (pluginName == null || authorName == null) return system;
  return system?.plugins[authorName]?.[pluginName];
}

export const hasUpdate = (item: RegistryItem) =>
  !item.isLocalDev && item.localVersion != null && item.version !== item.localVersion;

/** Installs, updates or uninstalls a system or plugin */
export async function runRegistryAction(command: RegistryCommand, path: ItemPath): Promise<boolean> {
  const data = await getRegistry();
  const item = data != null ? getItem(data, path) : undefined;
  if (data == null || item == null) return false;

  const id = itemId(path);
  registry.progress[id] = null;
  localServer.updating = true;

  const { ok, error } = await api.invoke("registry:run", command, id, item.downloadURL);

  delete registry.progress[id];
  localServer.updating = Object.keys(registry.progress).length > 0;
  if (error != null) void info(error);

  if (ok) {
    if (command === "uninstall") {
      item.localVersion = null;
      if (path.pluginName == null) {
        for (const plugins of Object.values(data.systems[path.systemId].plugins)) {
          for (const plugin of Object.values(plugins)) plugin.localVersion = null;
        }
      }
    } else {
      item.localVersion = item.version;
    }
  }
  return ok;
}

/** IDs of everything installed that has an update available */
export function getUpdatableItems(data: Registry): ItemPath[] {
  const items: ItemPath[] = [];
  for (const [systemId, system] of Object.entries(data.systems)) {
    if (hasUpdate(system)) items.push({ systemId });
    for (const [authorName, plugins] of Object.entries(system.plugins)) {
      for (const [pluginName, plugin] of Object.entries(plugins)) {
        if (hasUpdate(plugin)) items.push({ systemId, authorName, pluginName });
      }
    }
  }
  return items;
}

export async function updateAll() {
  const data = await getRegistry();
  if (data == null) return;
  await Promise.all(getUpdatableItems(data).map((path) => runRegistryAction("update", path)));
}
