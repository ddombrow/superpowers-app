import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RegistryService } from "./registry";

let corePath: string;

/** A stand-in for core's server: `script` runs as server/index.js */
function fakeCore(script: string) {
  mkdirSync(join(corePath, "server"), { recursive: true });
  writeFileSync(join(corePath, "server/index.js"), script);
}

beforeEach(() => {
  corePath = mkdtempSync(join(tmpdir(), "superpowers-registry-"));
});
afterEach(() => {
  rmSync(corePath, { recursive: true, force: true });
});

describe("RegistryService.fetch", () => {
  it("returns the registry sent by core", async () => {
    fakeCore(
      `process.send({ type: "registry", registry: { version: 1, core: {}, systems: {} } }, () => process.exit(0));`
    );
    const registry = await new RegistryService(corePath, corePath).fetch();
    expect(registry).toEqual({ version: 1, core: {}, systems: {} });
  });

  it("gives up when core takes too long", async () => {
    fakeCore(`setInterval(() => {}, 1000);`);
    const started = Date.now();
    const registry = await new RegistryService(corePath, corePath).fetch(300);
    expect(registry).toBeNull();
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
