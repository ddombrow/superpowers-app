import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveEntryPath } from "./coreInstaller";

const target = resolve("/data/core");

describe("resolveEntryPath", () => {
  it("strips the root folder", () => {
    expect(resolveEntryPath(target, "superpowers-core-v5.0.0", "superpowers-core-v5.0.0/server/index.js")).toBe(
      join(target, "server/index.js")
    );
  });

  it("ignores the root folder entry itself", () => {
    expect(resolveEntryPath(target, "root", "root")).toBeNull();
  });

  it("rejects entries outside of the root folder", () => {
    expect(() => resolveEntryPath(target, "root", "other/file.js")).toThrow(/outside of root folder/);
    // A sibling folder whose name merely starts with the root folder's name
    expect(() => resolveEntryPath(target, "root", "root-evil/file.js")).toThrow(/outside of root folder/);
  });

  it("rejects path traversal", () => {
    expect(() => resolveEntryPath(target, "root", "root/../../etc/passwd")).toThrow(/outside of the target folder/);
    expect(() => resolveEntryPath(target, "root", "root/server/../../../x")).toThrow(/outside of the target folder/);
    expect(() => resolveEntryPath(target, "root", "root/..")).toThrow(/outside of the target folder/);
  });

  it("allows file names that contain dots", () => {
    expect(resolveEntryPath(target, "root", "root/..hidden/file..js")).toBe(join(target, "..hidden/file..js"));
  });
});
