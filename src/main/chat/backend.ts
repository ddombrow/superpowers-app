import type { EventEmitter } from "node:events";
import type { ChatEvent, Presence } from "../../shared/types";

export interface ChatBackendEvents {
  event: [event: ChatEvent];
}

/**
 * A chat service the launcher UI can use. The main process owns at most one,
 * and forwards its `ChatEvent`s to the renderer (see src/renderer/lib/chatState.svelte.ts).
 * Without a backend, the chat UI is hidden.
 *
 * Conventions: channels start with "#", anything else is a user's nickname.
 */
export interface ChatBackend extends EventEmitter<ChatBackendEvents> {
  /** Shown in the UI, e.g. as the status tab's title */
  readonly name: string;

  /** Connects unless `presence` is "offline"; emits "connecting", then "registered" */
  connect(nickname: string, presence: Presence): void;
  /** Emits "disconnected" */
  disconnect(): void;
  setPresence(presence: Presence): void;
  changeNick(nickname: string): void;
  /** Emits "join" (with our own nickname), then "topic" and "userlist" */
  join(channel: string): void;
  part(channel: string): void;
  /** `target` is a channel or a nickname */
  say(target: string, message: string): void;
}
