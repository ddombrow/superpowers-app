import { api } from "../api";
import * as settings from "../settings";
import * as tabs from "../tabs";
import * as sidebarMe from "../sidebar/me";
import type { IrcEvent } from "../../shared/types";
export { ircNetwork } from "../../shared/endpoints";
import { ircNetwork } from "../../shared/endpoints";

import ChatTab from "./ChatTab";

export const nicknamePattern = /^([A-Za-z][A-Za-z0-9_-]{1,15})$/;
export const nicknamePatternString = nicknamePattern.toString().slice(1, -1);

export const languageChatRooms = [ "fr" ];

/** Set while connecting or connected */
let connecting = false;
/** Our nickname once registered on the network, null otherwise */
let me: string = null;
let mentionRegex: RegExp;

const statusChatTab = new ChatTab("status", { label: ircNetwork.host, showTab: false });
statusChatTab.paneElt.dataset["persist"] = "true";

const channelChatTabs: { [name: string]: ChatTab } = {};
const privateChatTabs: { [name: string]: ChatTab } = {};

tabs.tabStrip.on("closeTab", onCloseTab);
api.on("irc:event", onIrcEvent);

export function isConnected() {
  return me != null;
}

export function getNickname() {
  return me;
}

export function start() {
  if (settings.presence !== "offline") {
    connect();
    for (const roomName of settings.savedChatrooms) {
      join(roomName, false);
      channelChatTabs[roomName].addInfo("Connecting...");
    }
  }
}

export function openStatusTab() {
  statusChatTab.showTab(true);
}

export function onPresenceUpdated() {
  if (settings.presence === "offline") disconnect();
  else if (!connecting) connect();
  else api.send("irc:set-presence", settings.presence);
}

export function onNicknameUpdated() {
  if (connecting) api.send("irc:nick", settings.nickname);
}

export function changeNickname(nickname: string) {
  api.send("irc:nick", nickname);
}

export function joinChannel(channelName: string) {
  api.send("irc:join", channelName);
}

function onCloseTab(tabElement: HTMLLIElement) {
  const name = tabElement.dataset["chatTarget"];
  if (name == null) return;

  const chatTab = channelChatTabs[name];
  if (chatTab != null) {
    if (isConnected()) api.send("irc:part", name);
    delete channelChatTabs[name];
    settings.savedChatrooms.splice(settings.savedChatrooms.indexOf(name), 1);
    settings.scheduleSave();
    return;
  }

  const privateChatTab = privateChatTabs[name];
  if (privateChatTab != null) {
    delete privateChatTabs[name];
  }
}

function connect() {
  if (connecting) return;
  connecting = true;

  for (const name in channelChatTabs) channelChatTabs[name].addInfo("Connecting...");
  for (const name in privateChatTabs) privateChatTabs[name].addInfo("Connecting...");

  api.send("irc:connect", settings.nickname, settings.presence);
}

export function disconnect() {
  api.send("irc:disconnect");
}

function setupMentionRegex() {
  mentionRegex = new RegExp(`(.*\\s)?${me}([^\\w]*)`, "g");
}

export function send(target: string, message: string) {
  api.send("irc:say", target, message);

  let chatTab: ChatTab;

  if (target[0] === "#") {
    chatTab = channelChatTabs[target];
    if (chatTab == null) return false;
  } else {
    chatTab = privateChatTabs[target];
    if (chatTab == null) {
      chatTab = new ChatTab(target);
      privateChatTabs[target] = chatTab;
    }
  }

  chatTab.addMessage(me, message, "me");
  return true;
}

export function join(channelName: string, focus?: boolean) {
  channelName = channelName.toLowerCase();
  let chatTab = channelChatTabs[channelName];
  if (chatTab == null) {
    chatTab = new ChatTab(channelName, { isChannel: true });
    channelChatTabs[chatTab.target] = chatTab;
    if (settings.savedChatrooms.indexOf(channelName) === -1) settings.savedChatrooms.push(channelName);
  }

  if (settings.presence === "offline") {
    settings.setPresence("online");
    sidebarMe.updatePresenceFromSettings();
    connect();
  }

  settings.scheduleSave();

  chatTab.showTab(focus === true);
}

function forEachTabWithUser(nick: string, callback: (chatTab: ChatTab) => void) {
  for (const name in channelChatTabs) {
    const chatTab = channelChatTabs[name];
    if (chatTab.hasUser(nick)) callback(chatTab);
  }

  const privateChatTab = privateChatTabs[nick];
  if (privateChatTab != null) callback(privateChatTab);
}

function onIrcEvent(event: IrcEvent) {
  switch (event.type) {
    case "connecting":
      statusChatTab.addInfo(`Connecting to ${event.host}:${event.port}...`);
      break;

    case "registered":
      me = event.nick;
      statusChatTab.addInfo(`Connected as ${me}.`);
      setupMentionRegex();
      for (const name in channelChatTabs) channelChatTabs[name].join();
      break;

    case "motd":
      for (const line of event.lines) statusChatTab.addInfo(line);
      break;

    case "info":
      statusChatTab.addInfo(event.text);
      break;

    case "topic":
      channelChatTabs[event.channel.toLowerCase()]?.onTopic(event.topic);
      break;

    case "userlist":
      channelChatTabs[event.channel.toLowerCase()]?.onUserList(event.users);
      break;

    case "join":
      channelChatTabs[event.channel.toLowerCase()]?.onJoin(event.nick);
      break;

    case "part":
      channelChatTabs[event.channel.toLowerCase()]?.onPart(event.nick, event.channel);
      break;

    case "nick": {
      if (event.nick === me) {
        me = event.newNick;
        setupMentionRegex();
      }

      forEachTabWithUser(event.nick, (chatTab) => chatTab.onNick(event.nick, event.newNick));

      const privateChatTab = privateChatTabs[event.nick];
      if (privateChatTab != null) {
        delete privateChatTabs[event.nick];
        privateChatTabs[event.newNick] = privateChatTab;
        privateChatTab.updateTarget(event.newNick);
      }
    } break;

    case "mode":
      channelChatTabs[event.target.toLowerCase()]?.onMode(event.modes);
      break;

    case "away":
      forEachTabWithUser(event.nick, (chatTab) => chatTab.onAway(event.nick, event.message));
      break;

    case "quit":
      forEachTabWithUser(event.nick, (chatTab) => chatTab.onQuit(event.nick, event.message));
      break;

    case "message":
      onMessage(event.kind, event.from, event.to, event.message);
      break;

    case "disconnected":
      connecting = false;
      me = null;
      for (const name in channelChatTabs) channelChatTabs[name].onDisconnect(event.reason);
      statusChatTab.onDisconnect(event.reason);
      break;
  }
}

function onMessage(kind: "privmsg" | "notice" | "action", from: string, to: string, message: string) {
  const style = kind === "notice" ? "notice" : null;
  if (kind === "action") message = `* ${from} ${message}`;

  if (to === "*" || (kind === "notice" && me == null)) {
    statusChatTab.addMessage(from, message, "private notice");
    return;
  }

  if (to === me) {
    let privateChatTab = privateChatTabs[from];
    if (privateChatTab == null) {
      privateChatTab = new ChatTab(from);
      privateChatTabs[from] = privateChatTab;
    }

    privateChatTab.addMessage(from, message, style ?? "private");
    notify(`Private ${kind === "notice" ? "notice" : "message"} from ${from}`, message, () => { privateChatTab.showTab(true); });
  } else {
    const chatTab = channelChatTabs[to.toLowerCase()];
    if (chatTab == null) return;

    if (mentionRegex != null) {
      // NOTE: The regex is global, so it must be rewound before each test
      mentionRegex.lastIndex = 0;
      if (mentionRegex.test(message)) notify(`Mentioned by ${from} in ${to}`, message, () => { chatTab.showTab(true); });
    }

    chatTab.addMessage(from, message, style);
  }
}

function notify(title: string, body: string, callback: () => void) {
  const notification = new Notification(title, { icon: "images/superpowers-256.png", body });
  const closeTimeoutId = setTimeout(() => { notification.close(); }, 5000);

  notification.addEventListener("click", () => {
    window.focus();
    clearTimeout(closeTimeoutId);
    notification.close();
    callback();
  });
}
