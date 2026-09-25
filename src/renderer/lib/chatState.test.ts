import { describe, expect, it, vi } from "vitest";
import { ChatState } from "./chatState.svelte";

const lines = (chat: ChatState, target: string) => chat.get(target)!.log.flatMap((entry) => entry.lines);

function connected(hooks = {}) {
  const chat = new ChatState(hooks);
  chat.apply({ type: "connecting", host: "irc.libera.chat", port: 6697 });
  chat.apply({ type: "registered", nick: "me" });
  return chat;
}

describe("ChatState", () => {
  it("tracks the connection in the status conversation", () => {
    const onRegistered = vi.fn();
    const chat = connected({ onRegistered });

    expect(chat.me).toBe("me");
    expect(chat.connecting).toBe(true);
    expect(onRegistered).toHaveBeenCalledOnce();
    expect(lines(chat, "status")).toEqual(["Connecting to irc.libera.chat:6697...", "Connected as me."]);
  });

  it("groups consecutive messages from the same person", () => {
    const chat = connected();
    chat.open("#Superpowers");
    chat.apply({ type: "message", kind: "privmsg", from: "a", to: "#superpowers", message: "one" });
    chat.apply({ type: "message", kind: "privmsg", from: "a", to: "#superpowers", message: "two" });
    chat.apply({ type: "message", kind: "privmsg", from: "b", to: "#superpowers", message: "three" });

    const log = chat.get("#superpowers")!.log;
    expect(log.map((entry) => [entry.from, entry.lines])).toEqual([
      ["a", ["one", "two"]],
      ["b", ["three"]]
    ]);
  });

  it("maintains channel topic and users", () => {
    const chat = connected();
    chat.open("#chan");
    chat.apply({ type: "join", channel: "#chan", nick: "me" });
    chat.apply({ type: "topic", channel: "#chan", topic: "Hello" });
    chat.apply({
      type: "userlist",
      channel: "#chan",
      users: [
        { nick: "op", modes: ["o"] },
        { nick: "me", modes: [] }
      ]
    });
    chat.apply({ type: "join", channel: "#chan", nick: "friend" });
    chat.apply({ type: "mode", target: "#chan", modes: [{ mode: "+v", param: "friend" }] });
    chat.apply({ type: "mode", target: "#chan", modes: [{ mode: "-o", param: "op" }] });
    chat.apply({ type: "nick", nick: "friend", newNick: "buddy" });

    const channel = chat.get("#chan")!;
    expect(channel.topic).toBe("Hello");
    expect(channel.waitingForTopic).toBe(false);
    expect(channel.users).toEqual({ op: "", me: "", buddy: "v" });

    chat.apply({ type: "quit", nick: "buddy", message: "Bye" });
    expect(channel.users).toEqual({ op: "", me: "" });
    expect(lines(chat, "#chan")).toContain("buddy has quit (Bye).");
  });

  it("assumes there's no topic when the user list comes first", () => {
    const chat = connected();
    chat.open("#chan");
    chat.apply({ type: "userlist", channel: "#chan", users: [] });
    expect(chat.get("#chan")).toMatchObject({ topic: null, waitingForTopic: false });
  });

  it("opens private conversations and notifies", () => {
    const onNotify = vi.fn();
    const chat = connected({ onNotify });
    chat.apply({ type: "message", kind: "privmsg", from: "friend", to: "ME", message: "psst" });

    expect(lines(chat, "friend")).toEqual(["psst"]);
    expect(onNotify).toHaveBeenCalledWith("Private message from friend", "psst", "friend");
  });

  it("notifies on mentions only", () => {
    const onNotify = vi.fn();
    const chat = connected({ onNotify });
    chat.open("#chan");
    chat.apply({ type: "message", kind: "privmsg", from: "a", to: "#chan", message: "hi me!" });
    chat.apply({ type: "message", kind: "privmsg", from: "a", to: "#chan", message: "hi meme" });
    chat.apply({ type: "message", kind: "action", from: "a", to: "#chan", message: "waves at me" });

    expect(onNotify).toHaveBeenCalledTimes(2);
    expect(lines(chat, "#chan")).toEqual(["hi me!", "hi meme", "* a waves at me"]);
  });

  it("follows private conversations when the other person changes nickname", () => {
    const onPrivateRenamed = vi.fn();
    const chat = connected({ onPrivateRenamed });
    chat.apply({ type: "message", kind: "privmsg", from: "alice", to: "me", message: "hi" });
    chat.apply({ type: "nick", nick: "alice", newNick: "alice2" });

    expect(chat.get("alice")).toBeUndefined();
    expect(chat.get("alice2")!.target).toBe("alice2");
    expect(onPrivateRenamed).toHaveBeenCalledWith("alice", "alice2");
  });

  it("routes server notices to the status conversation", () => {
    const chat = new ChatState();
    chat.apply({
      type: "message",
      kind: "notice",
      from: "irc.libera.chat",
      to: "*",
      message: "Looking up your hostname"
    });
    expect(chat.get("status")!.log[0]).toMatchObject({ style: "private notice", lines: ["Looking up your hostname"] });
  });

  it("ignores messages for channels that aren't open", () => {
    const chat = connected();
    chat.apply({ type: "message", kind: "privmsg", from: "a", to: "#unknown", message: "hi" });
    expect(chat.get("#unknown")).toBeUndefined();
  });

  it("clears users and reports the reason on disconnect", () => {
    const chat = connected();
    chat.open("#chan");
    chat.apply({ type: "userlist", channel: "#chan", users: [{ nick: "a", modes: [] }] });
    chat.apply({ type: "disconnected", reason: "Ping timeout" });

    expect(chat.me).toBeNull();
    expect(chat.connecting).toBe(false);
    expect(chat.get("#chan")!.users).toEqual({});
    expect(lines(chat, "#chan").at(-1)).toBe("Disconnected: Ping timeout.");
  });
});
