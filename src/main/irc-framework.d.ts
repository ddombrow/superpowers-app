// Minimal typings for the parts of irc-framework used in irc.ts
declare module "irc-framework" {
  import { EventEmitter } from "node:events";

  export interface ConnectOptions {
    host: string;
    port: number;
    tls?: boolean;
    nick: string;
    username?: string;
    gecos?: string;
    auto_reconnect?: boolean;
  }

  export class Client extends EventEmitter {
    constructor(options?: Partial<ConnectOptions>);
    user: { nick: string };
    connected: boolean;
    connect(options: ConnectOptions): void;
    quit(message?: string): void;
    raw(line: string): void;
    changeNick(nick: string): void;
    join(channel: string, key?: string): void;
    part(channel: string, message?: string): void;
    say(target: string, message: string): void;
  }
}
