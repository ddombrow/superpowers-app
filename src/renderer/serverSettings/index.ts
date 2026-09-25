import { api } from "../api";
import * as settings from "../settings";
import type { ServerConfig } from "../../shared/types";
import * as i18n from "../../shared/i18n";

import * as systems from "./systems";
import "./log";

export let config: ServerConfig;

const settingsElt = document.querySelector(".server-settings") as HTMLDivElement;
const disabledElt = settingsElt.querySelector(".disabled") as HTMLDivElement;

const serverNameElt = settingsElt.querySelector(".server-name input") as HTMLInputElement;
const mainPortElt = settingsElt.querySelector(".main-port input") as HTMLInputElement;
const buildPortElt = settingsElt.querySelector(".build-port input") as HTMLInputElement;
const autoStartServerElt = settingsElt.querySelector("#auto-start-server-checkbox") as HTMLInputElement;

const openProjectsFolderElt = settingsElt.querySelector(".projects-folder button") as HTMLButtonElement;
const maxRecentBuildsElt = settingsElt.querySelector(".max-recent-builds input") as HTMLInputElement;

const openToInternetElt = document.getElementById("open-server-to-internet-checkbox") as HTMLInputElement;
const passwordRowElt = settingsElt.querySelector("li.password") as HTMLLIElement;
const passwordElt = passwordRowElt.querySelector("input") as HTMLInputElement;
const showOrHidePasswordElt = passwordRowElt.querySelector("button") as HTMLButtonElement;

export async function start() {
  config = await api.invoke("server-config:load");

  if (config == null) {
    (settingsElt.querySelector(".error") as HTMLElement).hidden = false;
    (settingsElt.querySelector(".settings") as HTMLElement).hidden = true;
    (settingsElt.querySelector(".systems") as HTMLElement).hidden = true;
    return;
  }

  serverNameElt.value = config.serverName != null ? config.serverName : "";
  serverNameElt.addEventListener("input", scheduleSave);
  mainPortElt.value = config.mainPort.toString();
  mainPortElt.addEventListener("input", scheduleSave);
  buildPortElt.value = config.buildPort.toString();
  buildPortElt.addEventListener("input", scheduleSave);
  maxRecentBuildsElt.value = config.maxRecentBuilds.toString();
  maxRecentBuildsElt.addEventListener("input", scheduleSave);

  autoStartServerElt.checked = settings.autoStartServer;
  autoStartServerElt.addEventListener("change", onChangeAutoStartServer);

  openProjectsFolderElt.addEventListener("click", onOpenProjectsFolderClick);

  openToInternetElt.checked = config.password.length > 0;
  openToInternetElt.addEventListener("change", onChangeOpenToInternet);
  passwordRowElt.hidden = config.password.length === 0;
  passwordElt.value = config.password;
  passwordElt.addEventListener("input", scheduleSave);
  showOrHidePasswordElt.addEventListener("click", onShowOrHidePassword);

  systems.refreshRegistry();
}

export function enable(enabled: boolean) {
  disabledElt.hidden = enabled;
}

function onOpenProjectsFolderClick() {
  api.send("app:open-projects-folder");
}

function onChangeAutoStartServer() {
  settings.setAutoStartServer(autoStartServerElt.checked);
  settings.scheduleSave();
}

function onChangeOpenToInternet() {
  if (openToInternetElt.checked) {
    let password = "";
    for (let i = 0; i < 15; i++) {
      const minCharCode = 33;
      const maxCharCode = 126;
      const charCode = minCharCode + Math.round(Math.random() * (maxCharCode - minCharCode));
      const char = String.fromCharCode(charCode);
      password += char;
    }

    passwordElt.value = password;
    passwordRowElt.hidden = false;
  } else {
    passwordRowElt.hidden = true;
    passwordElt.value = "";
  }

  scheduleSave();
}

function onShowOrHidePassword() {
  if (passwordElt.type === "password") {
    passwordElt.type = "text";
    showOrHidePasswordElt.textContent = i18n.t("common:actions.hide");
  } else {
    passwordElt.type = "password";
    showOrHidePasswordElt.textContent = i18n.t("common:actions.show");
  }
}

/** Sends the config to the main process, which saves it before the server starts */
function scheduleSave() {
  config.serverName = serverNameElt.value.length > 0 ? serverNameElt.value : null;
  config.mainPort = parseInt(mainPortElt.value, 10);
  config.buildPort = parseInt(buildPortElt.value, 10);
  config.password = passwordElt.value;
  config.maxRecentBuilds = parseInt(maxRecentBuildsElt.value, 10);

  api.send("server-config:save", config);
}
