import { expect, test, type ElectronApplication } from "@playwright/test";
import type { ChatEvent } from "../src/shared/types";
import { launchApp } from "./fixtures";

/** Makes the loopback chat backend emit an event, as if another user did something */
function simulate(app: ElectronApplication, event: ChatEvent) {
  return app.evaluate((_electron, event) => {
    const backend = (globalThis as { superpowersLoopbackChat?: { simulate(event: unknown): void } })
      .superpowersLoopbackChat;
    backend!.simulate(event);
  }, event);
}

test("chat UI with the loopback backend: join, read, send, private messages, go offline", async () => {
  const { app, window, cleanup } = await launchApp({ env: { SUPERPOWERS_CHAT_BACKEND: "loopback" } });

  try {
    // With a chat backend, first launch asks for a nickname
    const welcome = window.getByRole("dialog", { name: "Welcome to Superpowers!" });
    await expect(welcome).toBeVisible({ timeout: 60_000 });
    await welcome.getByRole("textbox", { name: "Nickname" }).fill("E2ETester");
    // Connecting to chat is the default
    await welcome.getByRole("button", { name: "Get started!" }).click();
    await window.getByRole("dialog", { name: "Getting started" }).getByRole("button", { name: "Skip" }).click();

    await expect(window.getByRole("combobox", { name: "Chat presence" })).toHaveValue("online");

    // The default chatroom has a tab showing the topic and users
    await window.getByRole("tab", { name: "#superpowers-html5" }).click();
    const pane = window.getByRole("tabpanel", { name: "#superpowers-html5" });
    await expect(pane.getByText("Loopback channel")).toBeVisible();
    const users = pane.getByRole("complementary", { name: "Users in #superpowers-html5" });
    await expect(users.getByRole("listitem")).toHaveText(["@E2ETester"]);

    // Someone joins and posts; links are rendered as links, HTML as text
    await simulate(app, { type: "join", channel: "#superpowers-html5", nick: "friend" });
    await simulate(app, {
      type: "message",
      kind: "privmsg",
      from: "friend",
      to: "#superpowers-html5",
      message: "hi E2ETester, see https://example.com <b>bold</b>"
    });
    await expect(users.getByRole("listitem")).toHaveText(["@E2ETester", "friend"]);
    const log = pane.getByRole("log");
    await expect(log.getByRole("link", { name: "https://example.com" })).toBeVisible();
    await expect(log.getByText("<b>bold</b>", { exact: false })).toBeVisible();

    // Sending a message
    const input = pane.getByRole("textbox", { name: "Message #superpowers-html5" });
    await input.fill("hello everyone");
    await input.press("Enter");
    await expect(log.getByText("hello everyone")).toBeVisible();

    // Nickname completion, from the channel's users
    await input.fill("fri");
    await input.press("Tab");
    await expect(input).toHaveValue("friend: ");

    // A private conversation, with the loopback "echo" user
    await input.fill("/msg echo psst");
    await input.press("Enter");
    const privatePane = window.getByRole("tabpanel", { name: "echo" });
    await expect(window.getByRole("tab", { name: "echo" })).toHaveAttribute("aria-selected", "true");
    await expect(privatePane.getByRole("log").getByText("psst")).toHaveCount(2);
    await window.screenshot({ path: "test-results/screens/05-chat.png" });

    // Going offline disconnects
    await window.getByRole("combobox", { name: "Chat presence" }).selectOption("offline");
    await window.getByRole("tab", { name: "#superpowers-html5" }).click();
    await expect(log.getByText("Disconnected.")).toBeVisible();
    await expect(users.getByRole("listitem")).toHaveCount(0);
  } finally {
    await cleanup();
  }
});
