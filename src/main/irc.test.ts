import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IrcEvent } from "../shared/types";
import { IrcService } from "./irc";
import { FakeIrcServer } from "./testing/fakeIrcServer";

describe("IrcService", () => {
  let server: FakeIrcServer;
  let irc: IrcService;
  let events: IrcEvent[];

  const waitFor = async <T extends IrcEvent["type"]>(type: T) => {
    for (let i = 0; i < 200; i++) {
      const event = events.find((event) => event.type === type);
      if (event != null) return event as Extract<IrcEvent, { type: T }>;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for "${type}", got: ${events.map((event) => event.type).join(", ")}`);
  };

  beforeEach(async () => {
    server = new FakeIrcServer();
    const port = await server.listen();
    irc = new IrcService({ host: "127.0.0.1", port, tls: false });
    events = [];
    irc.on("event", (event) => events.push(event));
  });

  afterEach(async () => {
    irc.disconnect();
    await server.close();
  });

  it("doesn't connect when offline", () => {
    irc.connect("Tester", "offline");
    expect(events).toEqual([]);
  });

  it("registers, then forwards the MOTD", async () => {
    irc.connect("Tester", "online");

    expect(events[0]).toEqual({ type: "connecting", host: "127.0.0.1", port: expect.any(Number) });
    expect(await waitFor("registered")).toEqual({ type: "registered", nick: "Tester" });
    expect((await waitFor("motd")).lines.join("\n")).toContain("Be nice");
  });

  it("marks itself away when connecting as away", async () => {
    irc.connect("Tester", "away");
    await waitFor("registered");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.received).toContain("AWAY :Away");
  });

  it("joins channels and reports topic and users", async () => {
    irc.connect("Tester", "online");
    await waitFor("registered");

    irc.join("#superpowers-html5");
    expect(await waitFor("join")).toEqual({ type: "join", channel: "#superpowers-html5", nick: "Tester" });
    expect(await waitFor("topic")).toEqual({
      type: "topic",
      channel: "#superpowers-html5",
      topic: "Making games together"
    });

    const userlist = await waitFor("userlist");
    expect(userlist.users).toEqual(
      expect.arrayContaining([
        { nick: "op", modes: ["o"] },
        { nick: "voiced", modes: ["v"] },
        { nick: "Tester", modes: [] }
      ])
    );
  });

  it("forwards messages and sends ours", async () => {
    irc.connect("Tester", "online");
    await waitFor("registered");

    server.send(":friend!u@host PRIVMSG #superpowers-html5 :hello Tester");
    server.send(":friend!u@host PRIVMSG Tester :psst");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(events.filter((event) => event.type === "message")).toEqual([
      { type: "message", kind: "privmsg", from: "friend", to: "#superpowers-html5", message: "hello Tester" },
      { type: "message", kind: "privmsg", from: "friend", to: "Tester", message: "psst" }
    ]);

    irc.say("#superpowers-html5", "hi there!");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.received).toContain("PRIVMSG #superpowers-html5 :hi there!");
  });

  it("reports nick changes, quits and mode changes", async () => {
    irc.connect("Tester", "online");
    await waitFor("registered");

    server.send(":friend!u@host NICK buddy");
    server.send(":op!u@host MODE #superpowers-html5 +v buddy");
    server.send(":buddy!u@host QUIT :Bye");
    await waitFor("quit");

    expect(events).toContainEqual({ type: "nick", nick: "friend", newNick: "buddy" });
    expect(events).toContainEqual({
      type: "mode",
      target: "#superpowers-html5",
      modes: [{ mode: "+v", param: "buddy" }]
    });
    expect(events).toContainEqual({ type: "quit", nick: "buddy", message: "Bye" });
  });

  it("reports when the server drops the connection", async () => {
    irc.connect("Tester", "online");
    await waitFor("registered");

    server.socket!.destroy();
    expect((await waitFor("disconnected")).type).toBe("disconnected");

    // Can reconnect afterwards
    events = [];
    irc.setPresence("online");
    expect(await waitFor("registered")).toEqual({ type: "registered", nick: "Tester" });
  });
});
