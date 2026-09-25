import type { IrcEvent } from "../../shared/types";
import { mentions } from "./chatFormat";

export interface LogEntry {
  id: number;
  kind: "info" | "message";
  from: string | null;
  style: "me" | "private" | "notice" | "private notice" | null;
  lines: string[];
}

export interface Conversation {
  /** "status", a channel ("#name") or a nickname */
  target: string;
  isChannel: boolean;
  topic: string | null;
  waitingForTopic: boolean;
  /** Channel users and their modes ("o", "v", ...) */
  users: Record<string, string>;
  log: LogEntry[];
}

const maxLogEntries = 1000;
let nextEntryId = 0;

export const conversationKey = (target: string) => (target.startsWith("#") ? target.toLowerCase() : target);

function newConversation(target: string): Conversation {
  const isChannel = target.startsWith("#");
  return { target, isChannel, topic: null, waitingForTopic: isChannel, users: {}, log: [] };
}

export interface ChatHooks {
  onRegistered?: () => void;
  onPrivateRenamed?: (oldNick: string, newNick: string) => void;
  onNotify?: (title: string, body: string, conversationKey: string) => void;
}

/** Chat state, driven by `IrcEvent`s from the main process (see src/main/irc.ts) */
export class ChatState {
  me = $state<string | null>(null);
  connecting = $state(false);
  conversations = $state<Record<string, Conversation>>({ status: newConversation("status") });

  constructor(private hooks: ChatHooks = {}) {}

  get(target: string): Conversation | undefined {
    return this.conversations[conversationKey(target)];
  }

  open(target: string): Conversation {
    const key = conversationKey(target);
    this.conversations[key] ??= newConversation(target);
    return this.conversations[key];
  }

  remove(target: string) {
    delete this.conversations[conversationKey(target)];
  }

  private append(
    conversation: Conversation,
    kind: LogEntry["kind"],
    from: string | null,
    style: LogEntry["style"],
    text: string
  ) {
    const last = conversation.log.at(-1);
    if (last != null && last.kind === kind && last.from === from && last.style === style) {
      last.lines.push(text);
      return;
    }

    conversation.log.push({ id: nextEntryId++, kind, from, style, lines: [text] });
    if (conversation.log.length > maxLogEntries) conversation.log.splice(0, conversation.log.length - maxLogEntries);
  }

  addInfo(target: string, text: string) {
    const conversation = this.get(target);
    if (conversation != null) this.append(conversation, "info", null, null, text);
  }

  addMessage(target: string, from: string, text: string, style: LogEntry["style"]) {
    this.append(this.open(target), "message", from, style, text);
  }

  private channels() {
    return Object.values(this.conversations).filter((conversation) => conversation.isChannel);
  }

  /** Channels where `nick` is, plus the private conversation with them */
  private conversationsWith(nick: string) {
    const result = this.channels().filter((channel) => nick in channel.users);
    const privateConversation = this.get(nick);
    if (privateConversation != null) result.push(privateConversation);
    return result;
  }

  apply(event: IrcEvent) {
    switch (event.type) {
      case "connecting":
        this.connecting = true;
        this.addInfo("status", `Connecting to ${event.host}:${event.port}...`);
        break;

      case "registered":
        this.me = event.nick;
        this.addInfo("status", `Connected as ${event.nick}.`);
        this.hooks.onRegistered?.();
        break;

      case "motd":
        for (const line of event.lines) this.addInfo("status", line);
        break;

      case "info":
        this.addInfo("status", event.text);
        break;

      case "topic": {
        const channel = this.get(event.channel);
        if (channel == null) break;
        channel.topic = event.topic.length > 0 ? event.topic : null;
        channel.waitingForTopic = false;
        break;
      }

      case "userlist": {
        const channel = this.get(event.channel);
        if (channel == null) break;
        channel.users = Object.fromEntries(
          event.users.map((user) => [user.nick, user.modes.filter((mode) => mode === "o" || mode === "v").join("")])
        );
        // Names come after the topic, so there is no topic if we're still waiting for one
        channel.waitingForTopic = false;
        break;
      }

      case "join": {
        const channel = this.get(event.channel);
        if (channel == null) break;
        this.addInfo(channel.target, `${event.nick} has joined ${channel.target}.`);
        if (event.nick !== this.me) channel.users[event.nick] = "";
        break;
      }

      case "part": {
        const channel = this.get(event.channel);
        if (channel == null) break;
        this.addInfo(channel.target, `${event.nick} has parted ${channel.target}.`);
        delete channel.users[event.nick];
        break;
      }

      case "nick": {
        if (event.nick === this.me) this.me = event.newNick;

        for (const channel of this.channels()) {
          if (!(event.nick in channel.users)) continue;
          this.addInfo(channel.target, `${event.nick} has changed nick to ${event.newNick}.`);
          channel.users[event.newNick] = channel.users[event.nick];
          delete channel.users[event.nick];
        }

        const privateConversation = this.get(event.nick);
        if (privateConversation != null) {
          this.remove(event.nick);
          privateConversation.target = event.newNick;
          this.conversations[conversationKey(event.newNick)] = privateConversation;
          this.addInfo(event.newNick, `${event.nick} has changed nick to ${event.newNick}.`);
          this.hooks.onPrivateRenamed?.(event.nick, event.newNick);
        }
        break;
      }

      case "mode": {
        const channel = this.get(event.target);
        if (channel == null) break;

        for (const { mode, param } of event.modes) {
          if (param == null || !(param in channel.users)) continue;
          const adding = !mode.startsWith("-");
          let userModes = channel.users[param];
          for (const flag of mode.replace(/^[+-]/, "")) {
            if (adding && !userModes.includes(flag)) userModes += flag;
            else if (!adding) userModes = userModes.replace(flag, "");
          }
          channel.users[param] = userModes;
        }
        break;
      }

      case "away":
        for (const conversation of this.conversationsWith(event.nick)) {
          this.addInfo(
            conversation.target,
            event.message.length > 0 ? `${event.nick} is now away: ${event.message}.` : `${event.nick} is now back.`
          );
        }
        break;

      case "quit":
        for (const conversation of this.conversationsWith(event.nick)) {
          this.addInfo(conversation.target, `${event.nick} has quit (${event.message}).`);
          delete conversation.users[event.nick];
        }
        break;

      case "message":
        this.onMessage(event.kind, event.from, event.to, event.message);
        break;

      case "disconnected":
        this.connecting = false;
        this.me = null;
        for (const conversation of [this.conversations.status, ...this.channels()]) {
          this.addInfo(conversation.target, event.reason != null ? `Disconnected: ${event.reason}.` : "Disconnected.");
          conversation.users = {};
        }
        break;
    }
  }

  private onMessage(kind: "privmsg" | "notice" | "action", from: string, to: string, message: string) {
    const text = kind === "action" ? `* ${from} ${message}` : message;
    const isNotice = kind === "notice";

    // Server notices, and notices before we're registered
    if (to === "*" || (isNotice && this.me == null)) {
      this.addMessage("status", from, text, "private notice");
      return;
    }

    if (this.me != null && to.toLowerCase() === this.me.toLowerCase()) {
      this.addMessage(from, from, text, isNotice ? "notice" : "private");
      this.hooks.onNotify?.(`Private ${isNotice ? "notice" : "message"} from ${from}`, text, conversationKey(from));
      return;
    }

    const channel = this.get(to);
    if (channel == null) return;
    if (this.me != null && mentions(message, this.me)) {
      this.hooks.onNotify?.(`Mentioned by ${from} in ${channel.target}`, text, conversationKey(to));
    }
    this.addMessage(channel.target, from, text, isNotice ? "notice" : null);
  }
}
