import chat from "../assets/images/tabs/chat.svg?inline";
import close from "../assets/images/tabs/close.svg?inline";
import home from "../assets/images/tabs/home.svg?inline";
import server from "../assets/images/tabs/server.svg?inline";
import serverSettings from "../assets/images/tabs/serverSettings.svg?inline";
import add from "../assets/images/servers/add.svg?inline";
import edit from "../assets/images/servers/edit.svg?inline";
import remove from "../assets/images/servers/remove.svg?inline";

// NOTE: Icons are CSS masks, which load images with CORS. Under file:// that fails for
// separate files, so every icon is inlined as a data: URL.
export const icons = { chat, close, home, server, serverSettings, add, edit, remove };
export type IconName = keyof typeof icons;

/**
 * Style for an element with the "icon" class. Characters with a meaning in CSS strings are
 * percent-encoded: some SVGs contain Windows paths, whose backslashes would be CSS escapes.
 */
export function iconStyle(name: IconName) {
  const url = icons[name].replace(/[\\"\n]/g, (char) => encodeURIComponent(char));
  return `--icon: url("${url}")`;
}
