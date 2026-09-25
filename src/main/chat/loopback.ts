import { EventEmitter } from "node:events";
import type { ChatEvent, Presence } from "../../shared/types";
import type { ChatBackend, ChatBackendEvents } from "./backend";

/**
 * A chat backend that never leaves this computer, for developing the chat UI and testing it
 * (SUPERPOWERS_CHAT_BACKEND=loopback). Channels only contain you, and the "echo" user
 * repeats private messages. Tests can simulate other users with `simulate()`.
 */
export class LoopbackChatBackend extends EventEmitter<ChatBackendEvents> implements ChatBackend {
  readonly name = "Loopback chat";
  private nickname: string | null = null;
  private readonly channels = new Set<string>();

  private send(event: ChatEvent) {
    this.emit("event", event);
  }

  /** Emits an event as if it came from the service */
  simulate(event: ChatEvent) {
    this.send(event);
  }

  connect(nickname: string, presence: Presence) {
    if (this.nickname != null || presence === "offline") return;
    this.nickname = nickname;
    this.send({ type: "connecting" });
    // Like a real service, reply asynchronously
    queueMicrotask(() => {
      this.send({ type: "registered", nick: nickname });
      this.send({
        type: "info",
        text: "Messages stay on this computer. Send a private message to echo to try it out."
      });
    });
  }

  disconnect() {
    if (this.nickname == null) return;
    this.nickname = null;
    this.channels.clear();
    this.send({ type: "disconnected", reason: null });
  }

  setPresence(presence: Presence) {
    if (presence === "offline") this.disconnect();
  }

  changeNick(nickname: string) {
    if (this.nickname == null) return;
    const previous = this.nickname;
    this.nickname = nickname;
    this.send({ type: "nick", nick: previous, newNick: nickname });
  }

  join(channel: string) {
    const nick = this.nickname;
    if (nick == null || this.channels.has(channel)) return;
    this.channels.add(channel);
    this.send({ type: "join", channel, nick });
    this.send({ type: "topic", channel, topic: "Loopback channel" });
    this.send({ type: "userlist", channel, users: [{ nick, modes: ["o"] }] });
  }

  part(channel: string) {
    if (this.nickname == null || !this.channels.delete(channel)) return;
    this.send({ type: "part", channel, nick: this.nickname, message: "" });
  }

  say(target: string, message: string) {
    if (this.nickname == null || target.toLowerCase() !== "echo") return;
    const to = this.nickname;
    queueMicrotask(() => this.send({ type: "message", kind: "privmsg", from: "echo", to, message }));
  }
}
