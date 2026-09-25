import { describe, expect, it } from "vitest";
import type { ChatEvent } from "../../shared/types";
import { LoopbackChatBackend } from "./loopback";

function setup() {
  const backend = new LoopbackChatBackend();
  const events: ChatEvent[] = [];
  backend.on("event", (event) => events.push(event));
  return { backend, events, settle: () => new Promise((resolve) => setTimeout(resolve, 0)) };
}

describe("LoopbackChatBackend", () => {
  it("connects unless offline", async () => {
    const { backend, events, settle } = setup();
    backend.connect("me", "offline");
    expect(events).toEqual([]);

    backend.connect("me", "online");
    await settle();
    expect(events.slice(0, 2)).toEqual([{ type: "connecting" }, { type: "registered", nick: "me" }]);
  });

  it("joins channels with a topic and user list", async () => {
    const { backend, events, settle } = setup();
    backend.connect("me", "online");
    await settle();
    events.length = 0;

    backend.join("#test");
    backend.join("#test");
    expect(events).toEqual([
      { type: "join", channel: "#test", nick: "me" },
      { type: "topic", channel: "#test", topic: "Loopback channel" },
      { type: "userlist", channel: "#test", users: [{ nick: "me", modes: ["o"] }] }
    ]);
  });

  it("echoes private messages sent to echo", async () => {
    const { backend, events, settle } = setup();
    backend.connect("me", "online");
    await settle();
    events.length = 0;

    backend.say("#test", "not echoed");
    backend.say("Echo", "hello");
    await settle();
    expect(events).toEqual([{ type: "message", kind: "privmsg", from: "echo", to: "me", message: "hello" }]);
  });

  it("renames and disconnects", async () => {
    const { backend, events, settle } = setup();
    backend.connect("me", "online");
    await settle();
    events.length = 0;

    backend.changeNick("me2");
    backend.setPresence("away");
    backend.setPresence("offline");
    expect(events).toEqual([
      { type: "nick", nick: "me", newNick: "me2" },
      { type: "disconnected", reason: null }
    ]);
  });
});
