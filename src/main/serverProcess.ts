import { type ChildProcess, fork } from "node:child_process";

const runningProcesses = new Set<ChildProcess>();

/** Runs a superpowers-core server command (`start`, `registry`, `install`...) */
export function forkServerProcess(corePath: string, userDataPath: string, args: string[]) {
  // NOTE: Copying all environment variables used to prevent the server from
  // starting (Electron 0.35), so only pass the ones it needs.
  const env: NodeJS.ProcessEnv = { ELECTRON_RUN_AS_NODE: "1", ELECTRON_NO_ATTACH_CONSOLE: "1" };
  for (const name of ["NODE_ENV", "APPDATA", "HOME", "XDG_DATA_HOME", "PATH", "SystemRoot"]) {
    if (process.env[name] != null) env[name] = process.env[name];
  }

  const child = fork(`${corePath}/server/index.js`, [`--data-path=${userDataPath}`, ...args], {
    silent: true,
    env,
    // NOTE: Core listens on "localhost" and the app connects to 127.0.0.1.
    // Since Node 17, "localhost" may resolve to ::1 first, so force IPv4.
    execArgv: ["--dns-result-order=ipv4first"]
  });

  runningProcesses.add(child);
  child.on("exit", () => runningProcesses.delete(child));
  return child;
}

/** Last resort, when the app exits without shutting down cleanly */
export function killAllServerProcesses() {
  for (const child of runningProcesses) child.kill();
}

export interface ServerMessage {
  type: string;
  [key: string]: unknown;
}
