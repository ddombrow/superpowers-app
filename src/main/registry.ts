import { EventEmitter } from "node:events";
import type { Registry, RegistryCommand } from "../shared/types";
import { forkServerProcess, type ServerMessage } from "./serverProcess";

export interface RegistryEvents {
  progress: [id: string, percent: number];
}

/** Systems, plugins and core updates, all delegated to core's server commands */
export class RegistryService extends EventEmitter<RegistryEvents> {
  private pendingFetch: Promise<Registry | null> | null = null;

  constructor(
    private corePath: string,
    private userDataPath: string
  ) {
    super();
  }

  /**
   * Resolves with null if the registry can't be fetched, including when it takes longer than
   * `timeout` ms: startup waits for it, so a stalled network must not hang the app.
   */
  fetch(timeout = 20_000): Promise<Registry | null> {
    this.pendingFetch ??= new Promise<Registry | null>((resolve) => {
      let registry: Registry | null = null;
      const child = forkServerProcess(this.corePath, this.userDataPath, ["registry"]);
      const killTimeout = setTimeout(() => {
        console.log(`Fetching the registry took more than ${timeout}ms, giving up.`);
        child.kill();
      }, timeout);
      child.stdout?.resume();
      child.on("message", (message: ServerMessage) => {
        if (message?.type === "registry" && message.error == null) registry = message.registry as Registry;
        else console.log("Unexpected registry message", message);
      });
      child.on("error", () => {
        clearTimeout(killTimeout);
        resolve(null);
      });
      child.on("exit", () => {
        clearTimeout(killTimeout);
        resolve(registry);
      });
    }).finally(() => {
      this.pendingFetch = null;
    });

    return this.pendingFetch;
  }

  /** `id` is "core", a system ID or "systemId:author/plugin" */
  run(command: RegistryCommand, id: string, downloadURL: string): Promise<{ ok: boolean; error: string | null }> {
    return new Promise((resolve) => {
      let error: string | null = null;
      const child = forkServerProcess(this.corePath, this.userDataPath, [
        command,
        id,
        "--force",
        `--download-url=${downloadURL}`
      ]);

      // Drain stdout, otherwise the process gets stuck
      child.stdout?.resume();
      child.on("message", (message: ServerMessage) => {
        if (message?.type === "error") error = String(message.message);
        else if (message?.type === "progress") this.emit("progress", id, Number(message.value));
        else console.log("Unexpected registry message", message);
      });
      child.on("error", (err) => {
        error = err.message;
      });
      child.on("exit", (code) => {
        resolve({ ok: code === 0, error: code === 0 ? null : (error ?? `Exited with code ${code}`) });
      });
    });
  }
}
