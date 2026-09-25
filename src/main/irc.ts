import { EventEmitter } from "node:events";
import { Client } from "irc-framework";
import { ircNetwork } from "../shared/endpoints";
import type { IrcEvent, Presence } from "../shared/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- irc-framework events are untyped */

export interface IrcServiceEvents {
  event: [event: IrcEvent];
}

/** Community chat, over TLS. Events are forwarded to the renderer as `IrcEvent`s. */
export class IrcService extends EventEmitter<IrcServiceEvents> {
  private client: Client | null = null;
  private nickname = "";
  private presence: Presence = "offline";
  private lastError: string | null = null;

  constructor(private network: { host: string; port: number; tls: boolean } = { ...ircNetwork, tls: true }) {
    super();
  }

  private send(event: IrcEvent) {
    this.emit("event", event);
  }

  connect(nickname: string, presence: Presence) {
    this.nickname = nickname;
    this.presence = presence;
    if (this.client != null || presence === "offline") return;

    const client = new Client();
    this.client = client;
    this.lastError = null;

    this.send({ type: "connecting", host: this.network.host, port: this.network.port });
    this.bindEvents(client);
    client.connect({
      host: this.network.host,
      port: this.network.port,
      tls: this.network.tls,
      nick: nickname,
      username: nickname,
      gecos: "Superpowers user",
      auto_reconnect: false
    });
  }

  private bindEvents(client: Client) {
    const on = (name: string, handler: (event: any) => void) => {
      client.on(name, (event: any) => {
        // Ignore events from a client we've already dropped
        if (this.client === client) handler(event);
      });
    };

    on("registered", (event) => {
      this.send({ type: "registered", nick: event.nick });
      if (this.presence === "away") client.raw("AWAY :Away");
    });
    on("motd", (event) => {
      if (typeof event.motd === "string") this.send({ type: "motd", lines: event.motd.trimEnd().split("\n") });
      else if (event.error != null) this.send({ type: "info", text: event.error });
    });
    on("topic", (event) => this.send({ type: "topic", channel: event.channel, topic: event.topic ?? "" }));
    on("userlist", (event) => {
      const users = (event.users ?? []).map((user: any) => ({ nick: user.nick, modes: user.modes ?? [] }));
      this.send({ type: "userlist", channel: event.channel, users });
    });
    on("join", (event) => this.send({ type: "join", channel: event.channel, nick: event.nick }));
    on("part", (event) =>
      this.send({ type: "part", channel: event.channel, nick: event.nick, message: event.message ?? "" })
    );
    on("kick", (event) =>
      this.send({ type: "part", channel: event.channel, nick: event.kicked, message: `Kicked by ${event.nick}` })
    );
    on("quit", (event) => this.send({ type: "quit", nick: event.nick, message: event.message ?? "" }));
    on("nick", (event) => this.send({ type: "nick", nick: event.nick, newNick: event.new_nick }));
    on("mode", (event) => this.send({ type: "mode", target: event.target, modes: event.modes ?? [] }));
    on("away", (event) => this.send({ type: "away", nick: event.nick, message: event.message || "Away" }));
    on("back", (event) => this.send({ type: "away", nick: event.nick, message: "" }));

    for (const kind of ["privmsg", "notice", "action"] as const) {
      on(kind, (event) => {
        const from = event.nick || event.hostname || this.network.host;
        this.send({ type: "message", kind, from, to: event.target, message: event.message });
      });
    }

    on("nick in use", (event) => this.send({ type: "info", text: `Nickname ${event.nick} is already in use.` }));
    on("nick invalid", (event) => this.send({ type: "info", text: `Nickname ${event.nick} is invalid.` }));
    on("irc error", (event) => {
      this.lastError = event.reason ?? event.error;
      this.send({ type: "info", text: `Error: ${this.lastError}` });
    });
    on("socket close", (err) => {
      if (err != null) this.lastError = err.message ?? String(err);
    });
    on("close", () => {
      this.client = null;
      this.send({ type: "disconnected", reason: this.lastError });
    });
  }

  disconnect() {
    const client = this.client;
    if (client == null) return;

    this.client = null;
    client.quit("Leaving");
    this.send({ type: "disconnected", reason: null });
  }

  setPresence(presence: Presence) {
    this.presence = presence;
    if (presence === "offline") this.disconnect();
    else if (this.client == null) this.connect(this.nickname, presence);
    else this.client.raw(presence === "away" ? "AWAY :Away" : "AWAY");
  }

  changeNick(nickname: string) {
    this.nickname = nickname;
    this.client?.changeNick(nickname);
  }

  join(channel: string) {
    this.client?.join(channel);
  }

  part(channel: string) {
    this.client?.part(channel);
  }

  say(target: string, message: string) {
    this.client?.say(target, message);
  }
}
