import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: {}, dialog: {}, ipcMain: {} }));

const { authorizeFile, authorizeFolder, checkPathAuthorization, resetAuthorizations } =
  await import("./authorizations");

const projects = resolve("/home/me/projects");
const origin = "http://127.0.0.1:4237";

describe("checkPathAuthorization", () => {
  beforeEach(() => {
    resetAuthorizations();
    authorizeFolder(origin, projects);
  });

  it("allows read/write inside an authorized folder", () => {
    expect(checkPathAuthorization(origin, join(projects, "game/index.html"))).toBe("readWrite");
  });

  it("does not grant access to the folder's siblings", () => {
    expect(checkPathAuthorization(origin, `${projects}-secret/file.txt`)).toBeNull();
    expect(checkPathAuthorization(origin, resolve(projects, "../other.txt"))).toBeNull();
  });

  it("normalizes paths before checking", () => {
    expect(checkPathAuthorization(origin, `${projects}/game/../../escape.txt`)).toBeNull();
    expect(checkPathAuthorization(origin, `${projects}/game/./../game/a.txt`)).toBe("readWrite");
  });

  it("keeps authorizations per origin", () => {
    expect(checkPathAuthorization("http://evil.example", join(projects, "game/index.html"))).toBeNull();
  });

  it("requires execution to be authorized per file", () => {
    const love = resolve("/usr/bin/love");
    expect(checkPathAuthorization(origin, love)).toBeNull();
    authorizeFile(origin, love, "execute");
    expect(checkPathAuthorization(origin, love)).toBe("execute");
  });
});
