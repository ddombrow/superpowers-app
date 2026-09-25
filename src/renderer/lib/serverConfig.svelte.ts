import type { ServerConfig } from "../../shared/types";
import { api } from "./api";

export const serverConfig = $state<{ loaded: boolean; config: ServerConfig | null }>({ loaded: false, config: null });

export async function loadServerConfig() {
  serverConfig.config = await api.invoke("server-config:load");
  serverConfig.loaded = true;
}

/** Sends the config to the main process, which saves it before the server starts */
export function saveServerConfig() {
  if (serverConfig.config != null) api.send("server-config:save", $state.snapshot(serverConfig.config));
}

/** A random password for opening the server to the Internet */
export function generatePassword(length = 15) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  // Printable ASCII, from "!" to "~"
  return Array.from(bytes, (byte) => String.fromCharCode(33 + (byte % 94))).join("");
}
