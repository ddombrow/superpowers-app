import * as async from "async";
import { api } from "../api";
import type { Registry, RegistryCommand } from "../../shared/types";
import TreeView from "dnd-tree-view";
import * as dialogs from "simple-dialogs";
import html from "../html";
import * as i18n from "../../shared/i18n";
import * as localServer from "../localServer";

const settingsElt = document.querySelector(".server-settings") as HTMLDivElement;
const systemsPaneElt = settingsElt.querySelector(".systems") as HTMLDivElement;

const treeView = new TreeView(systemsPaneElt.querySelector(".tree-view-container") as HTMLDivElement, { multipleSelection: false });
treeView.addListener("selectionChange", updateUI);

const refreshButton = systemsPaneElt.querySelector(".registry .actions .refresh") as HTMLButtonElement;
refreshButton.addEventListener("click", refreshRegistry);
const updateAllButton = systemsPaneElt.querySelector(".registry .actions .update-all") as HTMLButtonElement;
updateAllButton.addEventListener("click", () => { updateAll(); });

const detailsElt = systemsPaneElt.querySelector(".details") as HTMLDivElement;

const selectionTitleElt = detailsElt.querySelector(".title") as HTMLDirectoryElement;
const selectionActionsElt = detailsElt.querySelector(".actions") as HTMLDivElement;
const installOrUninstallButton = selectionActionsElt.querySelector(".install-uninstall") as HTMLButtonElement;
installOrUninstallButton.addEventListener("click", installOrUninstallClick);
const updateButton = selectionActionsElt.querySelector(".update") as HTMLButtonElement;
updateButton.addEventListener("click", onUpdateClick);

const releaseNotesButton = selectionActionsElt.querySelector(".release-notes") as HTMLButtonElement;
releaseNotesButton.addEventListener("click", onReleaseNotesClick);

const installedElt = detailsElt.querySelector("tr.installed td") as HTMLLabelElement;
const latestElt = detailsElt.querySelector("tr.latest td") as HTMLLabelElement;

let registry: Registry;
let fetchingRegistry = false;
/** IDs of the systems & plugins currently being installed, updated or uninstalled */
const runningActions = new Set<string>();

api.on("registry:progress", (id, percent) => {
  const progressElt = treeView.treeRoot.querySelector(`li[data-id="${id}"] .progress`) as HTMLDivElement;
  if (progressElt != null) progressElt.textContent = `${percent}%`;
});

type RegistryCallback = (registry: Registry) => void;

let getRegistryCallbacks: RegistryCallback[] = [];
export function getRegistry(callback: RegistryCallback) {
  if (registry != null) {
    callback(registry);
  } else {
    getRegistryCallbacks.push(callback);
    refreshRegistry();
  }
}

export function refreshRegistry() {
  if (fetchingRegistry) return;

  registry = null;
  treeView.clear();

  fetchingRegistry = true;
  updateUI();

  api.invoke("registry:fetch").then((fetchedRegistry) => {
    fetchingRegistry = false;
    onRegistryReceived(fetchedRegistry);
    updateUI();
  });
}

function onRegistryReceived(fetchedRegistry: Registry | null) {
  if (fetchedRegistry != null) {
    registry = fetchedRegistry;
    const systemsById = registry.systems;

    for (const systemId in systemsById) {
      const system = systemsById[systemId];

      const systemElt = html("li", { dataset: { id: systemId } });
      html("div", "label", { parent: systemElt, textContent: systemId });
      html("div", "progress", { parent: systemElt });
      treeView.append(systemElt, "group");

      for (const authorName in system.plugins) {
        const plugins = system.plugins[authorName];

        const authorElt = html("li");
        html("div", "label", { parent: authorElt, textContent: `${authorName} (${Object.keys(plugins).length} plugins)` });
        treeView.append(authorElt, "group", systemElt);

        for (const pluginName in plugins) {
          const pluginElt = html("li", { dataset: { id: `${systemId}:${authorName}/${pluginName}` } });
          html("div", "label", { parent: pluginElt, textContent: pluginName });
          html("div", "progress", { parent: pluginElt });
          treeView.append(pluginElt, "item", authorElt);
        }
      }
    }
  } else {
    registry = null;
  }

  for (const getRegistryCallback of getRegistryCallbacks) getRegistryCallback(registry);
  getRegistryCallbacks.length = 0;
}

type ActionItem = { systemId: string; authorName?: string; pluginName?: string };
export function action(command: RegistryCommand, item: ActionItem, callback?: (succeed: boolean) => void) {
  getRegistry((registry) => {
    if (registry == null) return;

    const id = item.pluginName != null ? `${item.systemId}:${item.authorName}/${item.pluginName}` : item.systemId;

    const progressElt = treeView.treeRoot.querySelector(`li[data-id="${id}"] .progress`) as HTMLDivElement;
    const registryItem = item.pluginName != null ? registry.systems[item.systemId].plugins[item.authorName][item.pluginName] : registry.systems[item.systemId];

    progressElt.textContent = "...";
    runningActions.add(id);
    updateUI();

    api.invoke("registry:run", command, id, registryItem.downloadURL).then(({ ok, error }) => {
      progressElt.textContent = "";
      runningActions.delete(id);
      if (error != null) new dialogs.InfoDialog(error);

      if (ok) {
        if (command === "uninstall") {
          registryItem.localVersion = null;
          if (item.pluginName == null) {
            for (const authorName in registry.systems[item.systemId].plugins) {
              for (const pluginName in registry.systems[item.systemId].plugins[authorName]) {
                registry.systems[item.systemId].plugins[authorName][pluginName].localVersion = null;
              }
            }
          }
        } else {
          registryItem.localVersion = registryItem.version;
        }
      }

      updateUI();
      if (callback != null) callback(ok);
    });
  });
}

export function updateAll(callback?: Function) {
  getRegistry((registry) => {
    if (registry == null) return;

    async.each(Object.keys(registry.systems), (systemId, cb) => {
      const system = registry.systems[systemId];
      async.parallel([
        (systemCb) => {
          if (!system.isLocalDev && system.localVersion != null && system.version !== system.localVersion)
            action("update", { systemId }, () => { systemCb(); });
          else
            systemCb();
        }, (pluginsCb) => {
          async.each(Object.keys(system.plugins), (authorName, authorCb) => {
            const pluginsByName = system.plugins[authorName];
            async.each(Object.keys(pluginsByName), (pluginName, pluginCb) => {
              const plugin = system.plugins[authorName][pluginName];
              if (!plugin.isLocalDev && plugin.localVersion != null && plugin.version !== plugin.localVersion)
                action("update", { systemId, authorName, pluginName }, () => { pluginCb(); });
              else
                pluginCb();
            }, authorCb);
          }, pluginsCb);
        }
      ], cb);
    }, () => { if (callback != null) callback(); });
  });
}

function updateUI() {
  if (fetchingRegistry) {
    refreshButton.disabled = true;
    detailsElt.hidden = true;
    localServer.setServerUpdating(false);
    return;
  }

  const updating = runningActions.size > 0;
  refreshButton.disabled = updating;
  localServer.setServerUpdating(updating);

  const id = treeView.selectedNodes.length === 1 ? treeView.selectedNodes[0].dataset["id"] : null;
  if (id != null) {
    detailsElt.hidden = false;

    const [ systemId, pluginPath ] = id.split(":");
    const [ authorName, pluginName ] = pluginPath != null ? pluginPath.split("/") : [null, null];
    const registrySystem = registry.systems[systemId];
    const registryItem = pluginName != null ? registrySystem.plugins[authorName][pluginName] : registrySystem;

    installOrUninstallButton.disabled = runningActions.has(id) || registryItem.isLocalDev || (pluginName != null && registrySystem.localVersion == null);
    updateButton.disabled = runningActions.has(id) || registryItem.isLocalDev || registryItem.localVersion == null || registryItem.version === registryItem.localVersion;

    const installOrUninstallAction = registryItem.isLocalDev || registryItem.localVersion == null ? "install" : "uninstall";
    installOrUninstallButton.textContent = i18n.t(`common:actions.${installOrUninstallAction}`);

    selectionTitleElt.textContent = id;
    installedElt.textContent = registryItem.isLocalDev ? "(dev)" : (registryItem.localVersion == null ? i18n.t("common:none") : registryItem.localVersion);
    latestElt.textContent = registryItem.version;

    // TODO: Update system details (description, ...)
  } else {
    detailsElt.hidden = true;
  }
}

function installOrUninstallClick() {
  const id = treeView.selectedNodes.length === 1 ? treeView.selectedNodes[0].dataset["id"] : null;
  if (id == null || runningActions.has(id)) return;

  const [ systemId, pluginPath ] = id.split(":");
  const [ authorName, pluginName ] = pluginPath != null ? pluginPath.split("/") : [null, null];
  const registryItem = pluginName != null ? registry.systems[systemId].plugins[authorName][pluginName] : registry.systems[systemId];

  action(registryItem.localVersion == null ? "install" : "uninstall", { systemId, authorName, pluginName });
}

function onUpdateClick() {
  const id = treeView.selectedNodes.length === 1 ? treeView.selectedNodes[0].dataset["id"] : null;
  if (id == null || runningActions.has(id)) return;

  const [ systemId, pluginPath ] = id.split(":");
  const [ authorName, pluginName ] = pluginPath != null ? pluginPath.split("/") : [null, null];

  action("update", { systemId, authorName, pluginName });
}

function onReleaseNotesClick() {
  const id = treeView.selectedNodes.length === 1 ? treeView.selectedNodes[0].dataset["id"] : null;
  if (id == null) return;

  const [ systemId, pluginPath ] = id.split(":");
  const [ authorName, pluginName ] = pluginPath != null ? pluginPath.split("/") : [null, null];
  const registryItem = pluginName != null ? registry.systems[systemId].plugins[authorName][pluginName] : registry.systems[systemId];

  api.send("app:open-external", registryItem.releaseNotesURL);
}
