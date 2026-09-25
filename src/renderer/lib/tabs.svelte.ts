import type { ServerEntry } from "../../shared/types";

export type Tab =
  | { id: "home"; kind: "home" }
  | { id: "server-settings"; kind: "server-settings" }
  | { id: string; kind: "server"; server: ServerEntry }
  | { id: string; kind: "chat"; target: string };

export const serverTabId = (serverId: string) => `server:${serverId}`;
export const chatTabId = (target: string) => `chat:${target}`;

type CloseListener = (tab: Tab) => void;

export class Tabs {
  list = $state<Tab[]>([{ id: "home", kind: "home" }]);
  activeId = $state("home");
  private closeListeners: CloseListener[] = [];

  get active() {
    return this.list.find((tab) => tab.id === this.activeId);
  }

  has(id: string) {
    return this.list.some((tab) => tab.id === id);
  }

  /** Adds the tab if needed, and activates it unless `focus` is false */
  open(tab: Tab, focus = true) {
    if (!this.has(tab.id)) this.list.push(tab);
    if (focus) this.activeId = tab.id;
  }

  activate(id: string) {
    if (this.has(id)) this.activeId = id;
  }

  close(id: string) {
    if (id === "home") return;
    const index = this.list.findIndex((tab) => tab.id === id);
    if (index === -1) return;

    if (this.activeId === id) {
      const neighbor = this.list[index + 1] ?? this.list[index - 1];
      this.activeId = neighbor.id;
    }

    const [tab] = this.list.splice(index, 1);
    for (const listener of this.closeListeners) listener(tab);
  }

  /** Renames a tab, e.g. a private chat after the other user changed nicknames */
  rename(id: string, newTab: Tab) {
    const index = this.list.findIndex((tab) => tab.id === id);
    if (index === -1) return;
    this.list[index] = newTab;
    if (this.activeId === id) this.activeId = newTab.id;
  }

  activateNext(offset: 1 | -1) {
    const index = this.list.findIndex((tab) => tab.id === this.activeId);
    const newIndex = (index + offset + this.list.length) % this.list.length;
    this.activeId = this.list[newIndex].id;
  }

  onClose(listener: CloseListener) {
    this.closeListeners.push(listener);
  }
}

export const tabs = new Tabs();
