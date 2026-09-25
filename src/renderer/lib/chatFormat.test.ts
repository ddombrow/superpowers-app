import { describe, expect, it } from "vitest";
import { linkify, mentions, nicknameColor, nicknamePattern, nicknamePatternString } from "./chatFormat";

describe("linkify", () => {
  it("finds every link and channel, not just the first", () => {
    expect(linkify("see https://a.com and #chan, or http://b.org/x?y=1 #other")).toEqual([
      { type: "text", text: "see " },
      { type: "link", url: "https://a.com" },
      { type: "text", text: " and " },
      { type: "channel", name: "#chan" },
      { type: "text", text: ", or " },
      { type: "link", url: "http://b.org/x?y=1" },
      { type: "text", text: " " },
      { type: "channel", name: "#other" }
    ]);
  });

  it("leaves HTML as plain text", () => {
    expect(linkify("<img src=x onerror=alert(1)>")).toEqual([{ type: "text", text: "<img src=x onerror=alert(1)>" }]);
  });

  it("doesn't treat hashes inside words as channels", () => {
    expect(linkify("C# and F#")).toEqual([{ type: "text", text: "C# and F#" }]);
    expect(linkify("#superpowers-html5-fr")).toEqual([{ type: "channel", name: "#superpowers-html5-fr" }]);
  });

  it("handles empty messages", () => {
    expect(linkify("")).toEqual([]);
  });
});

describe("mentions", () => {
  it("matches the nickname as a whole word, ignoring case", () => {
    expect(mentions("hey elisee, look", "Elisee")).toBe(true);
    expect(mentions("Elisee: hi", "Elisee")).toBe(true);
    expect(mentions("Eliseeee", "Elisee")).toBe(false);
    expect(mentions("not-Elisee", "Elisee")).toBe(false);
  });

  it("treats regex characters in nicknames literally", () => {
    expect(mentions("hi a_b", "a.b")).toBe(false);
    expect(mentions("hi a.b", "a.b")).toBe(true);
  });
});

describe("nicknames", () => {
  it("gives each nickname a stable color", () => {
    expect(nicknameColor("alice")).toBe(nicknameColor("alice"));
    expect(nicknameColor("alice")).not.toBe(nicknameColor("bob"));
    expect(nicknameColor("alice")).toMatch(/^rgba\(\d+, \d+, \d+, 0\.25\)$/);
  });

  it("validates nicknames like IRC servers do", () => {
    expect(nicknamePattern.test("E2ETester")).toBe(true);
    expect(nicknamePattern.test("1abc")).toBe(false);
    expect(nicknamePattern.test("a")).toBe(false);
    expect(nicknamePattern.test("way_too_long_nickname")).toBe(false);
    expect(nicknamePattern.test("with-dash_ok")).toBe(true);
  });

  it("works as an <input pattern>, which is compiled with the v flag", () => {
    const inputPattern = new RegExp(`^(?:${nicknamePatternString})$`, "v");
    expect(inputPattern.test("with-dash_ok")).toBe(true);
    expect(inputPattern.test("1abc")).toBe(false);
  });
});
