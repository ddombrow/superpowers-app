import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { LocalServerStatus } from "../shared/types";
import { forkServerProcess, type ServerMessage } from "./serverProcess";

export interface LocalServerEvents {
  status: [status: LocalServerStatus];
  log: [text: string];
}

export class LocalServer extends EventEmitter<LocalServerEvents> {
  private process: ChildProcess | null = null;
  private _status: LocalServerStatus = "stopped";

  constructor(
    private corePath: string,
    private userDataPath: string
  ) {
    super();
  }

  get status() {
    return this._status;
  }

  private setStatus(status: LocalServerStatus) {
    this._status = status;
    this.emit("status", status);
  }

  start() {
    if (this.process != null) return;

    this.setStatus("starting");
    const child = forkServerProcess(this.corePath, this.userDataPath, ["start"]);
    this.process = child;

    child.stdout?.on("data", (data) => this.emit("log", String(data)));
    child.stderr?.on("data", (data) => this.emit("log", String(data)));
    child.on("message", (message: ServerMessage) => {
      if (message?.type === "started") this.setStatus("started");
    });
    child.on("error", (err) => this.emit("log", `${err.stack ?? err.message}\n`));
    child.on("exit", () => {
      this.process = null;
      this.emit("log", "\n");
      this.setStatus("stopped");
    });
  }

  /** Asks the server to stop, then kills it if it hasn't exited after `timeout` ms */
  stop(timeout = 10_000): Promise<void> {
    const child = this.process;
    if (child == null) return Promise.resolve();

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => child.kill(), timeout);
      child.once("exit", () => {
        clearTimeout(killTimeout);
        resolve();
      });

      if (this._status !== "stopping") {
        this.setStatus("stopping");
        child.send("stop");
      }
    });
  }
}
