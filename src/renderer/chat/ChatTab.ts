import ResizeHandle from "resize-handle";
import TreeView from "dnd-tree-view";
import { tabStrip, panesElt } from "../tabs";
import * as chat from "./index";
import * as tabs from  "../tabs";

import html from "../html";
import escapeHTML from "escape-html";
import getBackgroundColor from "./getBackgroundColor";

const tabTemplate = document.querySelector("template.chat-tab") as HTMLTemplateElement;
const commandRegex = /^\/([^\s]*)(?:\s(.*))?$/;

interface ChannelUser {
  nickname: string;
  mode: string;
}

export default class ChatTab {
  private tabElt: HTMLLIElement;
  paneElt: HTMLDivElement;
  private label: string;

  private topicElt: HTMLDivElement;
  private waitingForTopic: boolean;

  private logElt: HTMLDivElement;
  private textAreaElt: HTMLTextAreaElement;
  private previousMessage: string;

  private usersTreeView: TreeView;
  private users: { [nickname: string]: ChannelUser } = {};

  constructor(public target: string, options?: { label?: string; isChannel?: boolean; showTab?: boolean; }) {
    if (options == null) options = {};
    this.label = (options.label != null) ? options.label : target;
    if (options.showTab !== false) this.showTab(false);

    this.paneElt = document.createElement("div");
    this.paneElt.hidden = true;
    this.paneElt.dataset["name"] = `chat-${target}`;
    this.paneElt.className = "chat-tab";
    panesElt.appendChild(this.paneElt);
    this.paneElt.appendChild(document.importNode(tabTemplate.content, true));

    const headerElt = this.paneElt.querySelector(".header") as HTMLDivElement;

    let chatTabName = this.target;
    let chatTabDetails = `on ${chat.ircNetwork.host}:${chat.ircNetwork.port}`;
    let chatTabTopic = "(Waiting for topic...)";

    if (this.target === "status") {
      chatTabName = `${chat.ircNetwork.host}:${chat.ircNetwork.port}`;
      chatTabDetails = "";
      chatTabTopic = "Connection status";
    } else if (this.target[0] !== "#") {
      chatTabTopic = "Private chat";
    } else {
      this.waitingForTopic = true;
    }

    (headerElt.querySelector(".info .name") as HTMLDivElement).textContent = chatTabName;
    (headerElt.querySelector(".info .details") as HTMLDivElement).textContent = chatTabDetails;
    this.topicElt = (headerElt.querySelector(".topic") as HTMLDivElement);
    this.topicElt.textContent = chatTabTopic;

    this.logElt = this.paneElt.querySelector(".log") as HTMLDivElement;
    this.textAreaElt = this.paneElt.querySelector("textarea") as HTMLTextAreaElement;

    this.textAreaElt.addEventListener("keydown", this.onTextAreaKeyDown);
    this.textAreaElt.addEventListener("keypress", this.onTextAreaKeyPress);

    const sidebarElt = this.paneElt.querySelector(".sidebar") as HTMLDivElement;

    if (options.isChannel) {
      new ResizeHandle(sidebarElt, "right");
      this.usersTreeView = new TreeView(this.paneElt.querySelector(".users-tree-view") as HTMLElement);

      if (chat.isConnected()) this.join();
    } else {
      sidebarElt.parentElement.removeChild(sidebarElt.previousElementSibling); // Resize handle
      sidebarElt.parentElement.removeChild(sidebarElt);
    }
  }

  updateTarget(target: string) {
    this.target = target;
    this.paneElt.dataset["name"] = `chat-${target}`;

    this.label = target;

    if (this.tabElt != null) {
      this.tabElt.dataset["name"] = `chat-${this.target}`;
      this.tabElt.dataset["chatTarget"] = this.target;
      this.tabElt.querySelector(".label").textContent = this.label;
    }
  }

  showTab(focus: boolean) {
    if (this.tabElt == null) {
      this.tabElt = document.createElement("li");
      this.tabElt.dataset["name"] = `chat-${this.target}`;
      this.tabElt.dataset["chatTarget"] = this.target;

      const iconElt = document.createElement("img");
      iconElt.className = "icon";
      iconElt.src = "images/tabs/chat.svg";
      this.tabElt.appendChild(iconElt);

      const labelElt = document.createElement("div");
      this.tabElt.appendChild(labelElt);
      labelElt.className = "label";
      labelElt.textContent = this.label;

      const closeButton = document.createElement("button");
      closeButton.className = "close";
      this.tabElt.appendChild(closeButton);
    }

    if (this.tabElt.parentElement == null) tabStrip.tabsRoot.appendChild(this.tabElt);
    if (focus) tabs.onActivateTab(this.tabElt);
  }

  join() {
    this.addInfo(`Joining ${this.target}...`);
    chat.joinChannel(this.target);
  }

  private linkify(text: string) {
    text = escapeHTML(text);

    const channelRegex = /^(.*\s)?#([#A-Za-z0-9_-]+)/g;
    text = text.replace(channelRegex, "$1<a href=\"#\">#$2</a>");

    const linkRegex = /^(.*\s)?(http|https):\/\/([^\s]+)/g;
    text = text.replace(linkRegex, "$1<a href=\"$2://$3\">$2://$3</a>");

    return text;
  }

  lastLogItem: {
    elt: HTMLDivElement;
    type: string;
    from: string;
    style: string;
  };

  private appendLogElt(type: string, from: string, style: string) {
    let elt: HTMLDivElement;
    let contentElt: HTMLDivElement;

    if (this.lastLogItem != null &&
    this.lastLogItem.elt.classList.contains(type) &&
    this.lastLogItem.from === from &&
    this.lastLogItem.style === style) {
      elt = this.lastLogItem.elt;
      contentElt = elt.querySelector(".content") as HTMLDivElement;
    } else {
      elt = html("div", type);
      if (style != null) style.split(" ").forEach((x) => elt.classList.add(x));

      if (from != null) {
        const gutterElt = html("div", "gutter", { parent: elt });
        html("div", "avatar", {
          textContent: from.substring(0, 2),
          style: { backgroundColor: getBackgroundColor(from), },
          parent: gutterElt
        });
      }

      contentElt = html("div", "content", { parent: elt });
      html("div", "from", { parent: contentElt, textContent: from });

      this.logElt.appendChild(elt);
    }

    this.lastLogItem = { elt, type, from, style };

    return contentElt;
 }

 private scrollToBottom() {
    this.logElt.scrollTop = 9e9;
 }

  addInfo(text: string) {
    const contentElt = this.appendLogElt("info", null, null);
    html("div", "text", { innerHTML: this.linkify(text), parent: contentElt });
    this.scrollToBottom();
  }

  addMessage(from: string, text: string, style: string) {
    const contentElt = this.appendLogElt("message", from, style);
    html("div", "text", { innerHTML: this.linkify(text), parent: contentElt });
    this.scrollToBottom();
  }

  hasUser(nickname: string) {
    return this.users[nickname] != null;
  }

  private addUser(nickname: string, mode: string) {
    if (this.hasUser(nickname)) return;
    this.users[nickname] = { nickname, mode };

    const userElt = document.createElement("li");
    userElt.dataset["nickname"] = nickname;

    const modeElt = document.createElement("div");
    modeElt.className = "mode";
    modeElt.textContent = this.getModeSymbol(mode);
    userElt.appendChild(modeElt);

    const nicknameElt = document.createElement("div");
    nicknameElt.className = "nickname";
    nicknameElt.textContent = nickname;
    userElt.appendChild(nicknameElt);

    this.usersTreeView.append(userElt, "item");
  }

  private getModeSymbol(mode: string) {
    if (mode.indexOf("o") !== -1) return "@";
    if (mode.indexOf("v") !== -1) return "+";
    return "";
  }

  private removeUser(nickname: string) {
    if (!this.hasUser(nickname)) return;
    delete this.users[nickname];

    const userElt = this.usersTreeView.treeRoot.querySelector(`li[data-nickname="${nickname}"]`) as HTMLLIElement;
    this.usersTreeView.remove(userElt);
  }

  send(message: string) {
    const result = commandRegex.exec(message);
    if (result != null) {
      this.handleCommand(result[1].toLocaleLowerCase(), result[2]);
      return;
    }

    if (!chat.isConnected()) this.addInfo("You are not connected.");
    else chat.send(this.target, message);
  }

  handleCommand(command: string, params: string) {
    if (chat.isConnected()) {
      switch (command) {
        case "nick":
          chat.changeNickname(params);
          break;
        case "msg": {
          const index = params.indexOf(" ");
          if (index === -1) {
            this.addInfo("/msg: Please enter a message.");
            return;
          }

          const target = params.slice(0, index);
          const message = params.slice(index + 1);
          if (!chat.send(target, message)) {
            this.addInfo(`/msg: Can't send message to ${target}.`);
            return;
          }
        } break;
        case "join": {
          if (params.length === 0 || params[0] !== "#" || params.indexOf(" ") !== -1) {
            this.addInfo("/join: Please enter a channel name.");
            return;
          }

          chat.join(params, true);
        } break;
        default:
          this.addInfo(`Unsupported command: ${command}`);
      }
    } else {
      this.addInfo("You are not connected.");
    }
  }

  onDisconnect(reason: string) {
    this.addInfo(reason != null ? `Disconnected: ${reason}.` : "Disconnected.");

    if (this.usersTreeView != null) {
      this.usersTreeView.clearSelection();
      this.usersTreeView.treeRoot.innerHTML = "";
      this.users = {};
    }
  }

  onTopic(topic: string) {
    this.topicElt.classList.toggle("disabled", topic.length === 0);
    this.topicElt.textContent = topic.length > 0 ? topic : "(No topic)";
    this.waitingForTopic = false;
  }

  onJoin(nick: string) {
    this.addInfo(`${nick} has joined ${this.target}.`);

    // The server sends the full user list after we join
    if (nick !== chat.getNickname()) this.addUser(nick, "");
  }

  onPart(nick: string, channel: string) {
    this.addInfo(`${nick} has parted ${channel}.`);
    this.removeUser(nick);
  }

  onNick(nick: string, newNick: string) {
    this.addInfo(`${nick} has changed nick to ${newNick}.`);

    const oldUser = this.users[nick];
    if (oldUser == null || this.usersTreeView == null) return;
    delete this.users[nick];
    this.users[newNick] = { nickname: newNick, mode: oldUser.mode };

    const userElt = this.usersTreeView.treeRoot.querySelector(`li[data-nickname="${nick}"]`) as HTMLLIElement;
    userElt.dataset["nickname"] = newNick;
    userElt.querySelector(".nickname").textContent = newNick;
  }

  onMode(modes: { mode: string; param?: string }[]) {
    for (const { mode, param } of modes) {
      const user = param != null ? this.users[param] : null;
      if (user == null) continue;

      const adding = mode[0] !== "-";
      for (const c of mode.replace(/^[+-]/, "")) {
        const index = user.mode.indexOf(c);
        if (adding && index === -1) user.mode += c;
        else if (!adding && index !== -1) user.mode = user.mode.substring(0, index) + user.mode.substring(index + 1);
      }

      const userElt = this.usersTreeView.treeRoot.querySelector(`li[data-nickname="${param}"]`) as HTMLLIElement;
      userElt.querySelector(".mode").textContent = this.getModeSymbol(user.mode);
    }
  }

  onAway(nick: string, message: string) {
    if (message.length > 0) this.addInfo(`${nick} is now away: ${message}.`);
    else this.addInfo(`${nick} is now back.`);
  }

  onQuit(nick: string, message: string) {
    this.addInfo(`${nick} has quit (${message}).`);
    this.removeUser(nick);
  }

  private onTextAreaKeyDown = (event: KeyboardEvent) => {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.keyCode === 38 /* Up */) {
      if (this.previousMessage == null) return;
      if (this.textAreaElt.value.length > 0) return;
      event.preventDefault();
      this.textAreaElt.value = this.previousMessage;
    } else if (event.keyCode === 9 /* Tab */) {
      event.preventDefault();
      this.doNicknameAutocomplete();
    }
  }

  private doNicknameAutocomplete() {
    const stubStartIndex = this.textAreaElt.value.lastIndexOf(" ", this.textAreaElt.selectionStart - 1) + 1;
    const stubEndIndex =  this.textAreaElt.selectionStart;
    const stub = this.textAreaElt.value.slice(stubStartIndex, stubEndIndex).toLowerCase();
    if (stub.length === 0) return;

    const matches: string[] = [];
    for (const user in this.users) {
      if (user.toLowerCase().indexOf(stub) === 0) matches.push(user);
    }

    if (matches.length === 1) {
      this.textAreaElt.value = `${this.textAreaElt.value.slice(0, stubStartIndex)}${matches[0]} `;
    } else if (matches.length > 1) {
      this.addInfo(`Matching users: ${matches.join(", ")}.`);
    }
  }

  private onTextAreaKeyPress = (event: KeyboardEvent) => {
    if (event.keyCode === 13) {
      event.preventDefault();

      if (this.textAreaElt.value.length > 0) {
        this.send(this.textAreaElt.value);
        this.previousMessage = this.textAreaElt.value;
        this.textAreaElt.value = "";
      }
    }
  }

  onUserList(users: { nick: string; modes: string[] }[]) {
    if (this.usersTreeView == null) return;

    this.users = {};
    this.usersTreeView.treeRoot.innerHTML = "";
    users.sort((a, b) => a.nick.localeCompare(b.nick));
    for (const user of users) {
      const mode = user.modes.filter((mode) => mode === "o" || mode === "v").join("");
      this.addUser(user.nick, mode);
    }

    if (this.waitingForTopic) {
      // If we receive the names before the topic then we can assume no topic has been set
      this.waitingForTopic = false;
      this.topicElt.textContent = "(No topic)";
    }
  }
}
