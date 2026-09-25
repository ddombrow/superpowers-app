import { describe, expect, it } from "vitest";
import { getServerUrls } from "./serverUrl";

describe("getServerUrls", () => {
  it("defaults to http", () => {
    expect(getServerUrls("example.com", "4237")).toEqual({
      protocol: "http",
      hostname: "example.com",
      hostnameAndPort: "example.com:4237",
      baseUrl: "http://example.com:4237"
    });
  });

  it("keeps https and strips trailing slashes and spaces", () => {
    expect(getServerUrls(" https://example.com// ", 443).baseUrl).toBe("https://example.com:443");
    expect(getServerUrls("http://127.0.0.1/", 4237).hostnameAndPort).toBe("127.0.0.1:4237");
  });
});
