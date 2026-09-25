import type { Presence } from "../../shared/types";
import { api } from "./api";
import { ChatState, conversationKey } from "./chatState.svelte";
import { saveSettings, settings } from "./settings.svelte";
import { chatTabId, tabs } from "./tabs.svelte";
import iconURL from "../assets/images/superpowers-256.png";

export { ircNetwork } from "../../shared/endpoints";

/** Chatrooms for languages that have one, e.g. #superpowers-html5-fr */
export const languageChatRooms = ["fr"];

export const chat = new ChatState({
  onRegistered() {
    for (const conversation of Object.values(chat.conversations)) {
      if (!conversation.isChannel) continue;
      chat.addInfo(conversation.target, `Joining ${conversation.target}...`);
      api.send("irc:join", conversation.target);
    }
  },
  onPrivateRenamed(oldNick, newNick) {
    const oldId = chatTabId(oldNick);
    if (tabs.has(oldId)) tabs.rename(oldId, { id: chatTabId(newNick), kind: "chat", target: newNick });
  },
  onNotify(title, body, key) {
    const target = chat.conversations[key]?.target;
    if (target != null) tabs.open({ id: chatTabId(target), kind: "chat", target }, false);
    notify(title, body, () => {
      if (target != null) tabs.activate(chatTabId(target));
    });
  }
});

api.on("irc:event", (event) => {
  chat.apply(event);

  // New private conversations get a tab
  if (event.type === "message" && chat.me != null && event.to.toLowerCase() === chat.me.toLowerCase()) {
    tabs.open({ id: chatTabId(event.from), kind: "chat", target: event.from }, false);
  }
});

tabs.onClose((tab) => {
  if (tab.kind !== "chat" || tab.target === "status") return;

  if (tab.target.startsWith("#")) {
    if (chat.me != null) api.send("irc:part", tab.target);
    const key = conversationKey(tab.target);
    settings.savedChatrooms = settings.savedChatrooms.filter((room) => conversationKey(room) !== key);
    saveSettings();
  }
  chat.remove(tab.target);
});

function notify(title: string, body: string, onClick: () => void) {
  if (document.hasFocus()) return;

  const notification = new Notification(title, { icon: iconURL, body });
  const closeTimeout = setTimeout(() => notification.close(), 5000);
  notification.addEventListener("click", () => {
    window.focus();
    clearTimeout(closeTimeout);
    notification.close();
    onClick();
  });
}

/** Called once the app has started: reconnects to saved chatrooms unless offline */
export function startChat() {
  for (const room of settings.savedChatrooms) {
    chat.open(room);
    tabs.open({ id: chatTabId(room), kind: "chat", target: room }, false);
  }
  if (settings.presence !== "offline") connect();
}

function connect() {
  if (chat.connecting || settings.nickname == null) return;
  api.send("irc:connect", settings.nickname, settings.presence);
}

export function setPresence(presence: Presence) {
  settings.presence = presence;
  saveSettings();

  if (presence === "offline") api.send("irc:disconnect");
  else if (!chat.connecting) connect();
  else api.send("irc:set-presence", presence);
}

export function setNickname(nickname: string) {
  settings.nickname = nickname;
  saveSettings();
  if (chat.connecting) api.send("irc:nick", nickname);
}

export function openStatusTab() {
  tabs.open({ id: chatTabId("status"), kind: "chat", target: "status" });
}

export function joinChannel(name: string, focus = true) {
  const conversation = chat.open(name.toLowerCase());
  tabs.open({ id: chatTabId(conversation.target), kind: "chat", target: conversation.target }, focus);

  if (!settings.savedChatrooms.includes(conversation.target)) {
    settings.savedChatrooms.push(conversation.target);
    saveSettings();
  }

  if (chat.me != null) {
    chat.addInfo(conversation.target, `Joining ${conversation.target}...`);
    api.send("irc:join", conversation.target);
  } else if (settings.presence === "offline") {
    setPresence("online");
  } else {
    connect();
  }
}

const commandRegex = /^\/(\S*)(?:\s(.*))?$/;

/** Sends a message, or runs a /command, from the input box of `target` */
export function sendFromInput(target: string, input: string) {
  const command = commandRegex.exec(input);

  if (chat.me == null) {
    chat.addInfo(target, "You are not connected.");
    return;
  }

  if (command == null) {
    say(target, input);
    return;
  }

  const [, name, params = ""] = command;
  switch (name.toLowerCase()) {
    case "nick":
      if (params.length === 0) chat.addInfo(target, "/nick: Please enter a nickname.");
      else setNickname(params.trim());
      break;

    case "msg": {
      const index = params.indexOf(" ");
      if (index === -1) {
        chat.addInfo(target, "/msg: Please enter a message.");
        break;
      }
      const recipient = params.slice(0, index);
      if (recipient.startsWith("#") && chat.get(recipient) == null) {
        chat.addInfo(target, `/msg: Can't send message to ${recipient}.`);
        break;
      }
      say(recipient, params.slice(index + 1));
      if (!recipient.startsWith("#")) tabs.open({ id: chatTabId(recipient), kind: "chat", target: recipient });
      break;
    }

    case "join":
      if (!params.startsWith("#") || params.includes(" ")) chat.addInfo(target, "/join: Please enter a channel name.");
      else joinChannel(params);
      break;

    default:
      chat.addInfo(target, `Unsupported command: ${name}`);
  }
}

function say(target: string, message: string) {
  api.send("irc:say", target, message);
  chat.addMessage(target, chat.me!, message, "me");
}
