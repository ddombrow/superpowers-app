import { expect, test } from "@playwright/test";
import { FakeIrcServer } from "../src/main/testing/fakeIrcServer";
import { launchApp } from "./fixtures";

test("community chat: join, read, send, private messages, go offline", async () => {
  const irc = new FakeIrcServer();
  const port = await irc.listen();
  const { window, cleanup } = await launchApp({ env: { SUPERPOWERS_IRC_SERVER: `127.0.0.1:${port}` } });
  const received = (line: string) => expect.poll(() => irc.received, { timeout: 10_000 }).toContain(line);

  try {
    const welcome = window.getByRole("dialog", { name: "Welcome to Superpowers!" });
    await expect(welcome).toBeVisible({ timeout: 60_000 });
    await welcome.getByRole("textbox", { name: "Nickname" }).fill("E2ETester");
    // Connecting to chat is the default
    await welcome.getByRole("button", { name: "Get started!" }).click();
    await window.getByRole("dialog", { name: "Getting started" }).getByRole("button", { name: "Skip" }).click();

    await received("NICK E2ETester");
    await received("JOIN #superpowers-html5");

    // The saved chatroom has a tab showing the topic and users
    await window.getByRole("tab", { name: "#superpowers-html5" }).click();
    const pane = window.getByRole("tabpanel", { name: "#superpowers-html5" });
    await expect(pane.getByText("Making games together")).toBeVisible();
    const users = pane.getByRole("complementary", { name: "Users in #superpowers-html5" });
    await expect(users.getByRole("listitem")).toHaveText(["E2ETester", "@op", "+voiced"]);

    // Incoming messages, with links rendered as links (not HTML)
    irc.send(":friend!u@host PRIVMSG #superpowers-html5 :hi E2ETester, see https://example.com <b>bold</b>");
    const log = pane.getByRole("log");
    await expect(log.getByRole("link", { name: "https://example.com" })).toBeVisible();
    await expect(log.getByText("<b>bold</b>", { exact: false })).toBeVisible();

    // Sending a message
    const input = pane.getByRole("textbox", { name: "Message #superpowers-html5" });
    await input.fill("hello everyone");
    await input.press("Enter");
    await received("PRIVMSG #superpowers-html5 :hello everyone");
    await expect(log.getByText("hello everyone")).toBeVisible();

    // Nickname completion, from the channel's users
    await input.fill("voi");
    await input.press("Tab");
    await expect(input).toHaveValue("voiced: ");
    await input.fill("");

    // A private message opens a tab for the conversation
    irc.send(":friend!u@host PRIVMSG E2ETester :psst");
    await window.getByRole("tab", { name: "friend" }).click();
    await expect(window.getByRole("tabpanel", { name: "friend" }).getByRole("log").getByText("psst")).toBeVisible();
    await window.screenshot({ path: "test-results/screens/05-chat.png" });

    // Going offline disconnects
    await window.getByRole("combobox", { name: "Chat presence" }).selectOption("offline");
    await expect.poll(() => irc.received.some((line) => line.startsWith("QUIT")), { timeout: 10_000 }).toBe(true);
  } finally {
    await cleanup();
    await irc.close();
  }
});
