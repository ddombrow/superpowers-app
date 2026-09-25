import type { LocalServerStatus } from "../../shared/types";
import { api } from "./api";

const maxLogLength = 200_000;

export const localServer = $state({
  status: "stopped" as LocalServerStatus,
  /** Set while systems, plugins or core are being installed or updated */
  updating: false,
  log: ""
});

api.on("local-server:status", (status) => {
  localServer.status = status;
});
api.on("local-server:log", (text) => {
  const log = localServer.log + text;
  localServer.log = log.length > maxLogLength ? log.slice(log.length - maxLogLength) : log;
});

export function startLocalServer() {
  if (localServer.status === "stopped" && !localServer.updating) api.send("local-server:start");
}

export function stopLocalServer() {
  if (localServer.status === "starting" || localServer.status === "started") api.send("local-server:stop");
}

export function clearLocalServerLog() {
  localServer.log = "";
}
