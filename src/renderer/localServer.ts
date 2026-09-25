import { api } from "./api";
import * as settings from "./settings";
import * as i18n from "../shared/i18n";
import openServerSettings from "./tabs/openServerSettings";
import * as serverSettings from "./serverSettings";
import { append as appendToLog } from "./serverSettings/log";
import type { LocalServerStatus } from "../shared/types";

let status: LocalServerStatus = "stopped";
let updating = false;

const localServerElt = document.querySelector(".local-server") as HTMLDivElement;
const statusElt = localServerElt.querySelector(".status") as HTMLDivElement;
const startStopServerButton = localServerElt.querySelector(".start-stop") as HTMLButtonElement;
const settingsButton = localServerElt.querySelector(".settings") as HTMLButtonElement;

api.on("local-server:status", onStatus);
api.on("local-server:log", appendToLog);

export function start() {
  startStopServerButton.addEventListener("click", startStopServer);
  settingsButton.addEventListener("click", openServerSettings);

  if (settings.autoStartServer) startServer();
}

function startStopServer() {
  if (status === "stopped") startServer();
  else stopServer();
}

function startServer() {
  if (status !== "stopped") return;
  api.send("local-server:start");
}

export function stopServer() {
  if (status === "stopped" || status === "stopping") return;
  api.send("local-server:stop");
}

function onStatus(newStatus: LocalServerStatus) {
  status = newStatus;
  serverSettings.enable(status === "stopped");
  updateUI();
}

export function setServerUpdating(isUpdating: boolean) {
  updating = isUpdating;
  updateUI();
}

function updateUI() {
  if (updating && status === "stopped") {
    statusElt.textContent = i18n.t("server:status.updating");
    startStopServerButton.disabled = true;
    return;
  }

  statusElt.textContent = i18n.t(`server:status.${status}`);
  startStopServerButton.textContent = i18n.t(`server:buttons.${status === "stopped" ? "start" : "stop"}`);
  startStopServerButton.disabled = status === "stopping";
}
