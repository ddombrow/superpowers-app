import { describe, expect, it } from "vitest";
import { Tabs, chatTabId } from "./tabs.svelte";

const chat = (target: string) => ({ id: chatTabId(target), kind: "chat" as const, target });

describe("Tabs", () => {
  it("starts with the home tab active", () => {
    const tabs = new Tabs();
    expect(tabs.list.map((tab) => tab.id)).toEqual(["home"]);
    expect(tabs.activeId).toBe("home");
  });

  it("opens tabs once and focuses them", () => {
    const tabs = new Tabs();
    tabs.open(chat("#a"));
    tabs.open(chat("#b"), false);
    tabs.open(chat("#a"));
    expect(tabs.list.map((tab) => tab.id)).toEqual(["home", "chat:#a", "chat:#b"]);
    expect(tabs.activeId).toBe("chat:#a");
  });

  it("activates a neighbor when closing the active tab, and never closes home", () => {
    const tabs = new Tabs();
    const closed: string[] = [];
    tabs.onClose((tab) => closed.push(tab.id));

    tabs.open(chat("#a"));
    tabs.open(chat("#b"));
    tabs.activate("chat:#a");
    tabs.close("chat:#a");
    expect(tabs.activeId).toBe("chat:#b");

    tabs.close("chat:#b");
    expect(tabs.activeId).toBe("home");

    tabs.close("home");
    expect(tabs.list).toHaveLength(1);
    expect(closed).toEqual(["chat:#a", "chat:#b"]);
  });

  it("cycles through tabs", () => {
    const tabs = new Tabs();
    tabs.open(chat("#a"));
    tabs.activateNext(1);
    expect(tabs.activeId).toBe("home");
    tabs.activateNext(-1);
    expect(tabs.activeId).toBe("chat:#a");
  });

  it("renames tabs in place", () => {
    const tabs = new Tabs();
    tabs.open(chat("alice"));
    tabs.rename("chat:alice", chat("alice2"));
    expect(tabs.list.map((tab) => tab.id)).toEqual(["home", "chat:alice2"]);
    expect(tabs.activeId).toBe("chat:alice2");
  });
});
