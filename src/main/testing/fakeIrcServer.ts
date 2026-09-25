import { createServer, type AddressInfo, type Server, type Socket } from "node:net";

/** A tiny IRC server: enough of the protocol to exercise IrcService */
export class FakeIrcServer {
  server: Server;
  socket: Socket | null = null;
  received: string[] = [];
  private nick = "";

  constructor() {
    this.server = createServer((socket) => {
      this.socket = socket;
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\r\n");
        buffer = lines.pop()!;
        for (const line of lines) this.onLine(line);
      });
    });
  }

  listen() {
    return new Promise<number>((resolve) =>
      this.server.listen(0, "127.0.0.1", () => resolve((this.server.address() as AddressInfo).port))
    );
  }

  close() {
    this.socket?.destroy();
    return new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  send(line: string) {
    this.socket!.write(`${line}\r\n`);
  }

  private onLine(line: string) {
    this.received.push(line);
    const [command, ...params] = line.split(" ");

    switch (command) {
      case "CAP":
        if (params[0] === "LS") this.send(":fake CAP * LS :");
        break;
      case "NICK":
        this.nick = params[0];
        break;
      case "USER":
        this.send(`:fake 001 ${this.nick} :Welcome to the fake network`);
        this.send(`:fake 375 ${this.nick} :- fake Message of the Day -`);
        this.send(`:fake 372 ${this.nick} :- Be nice`);
        this.send(`:fake 376 ${this.nick} :End of /MOTD command.`);
        break;
      case "JOIN":
        this.send(`:${this.nick}!u@host JOIN ${params[0]}`);
        this.send(`:fake 332 ${this.nick} ${params[0]} :Making games together`);
        this.send(`:fake 353 ${this.nick} = ${params[0]} :@op +voiced ${this.nick}`);
        this.send(`:fake 366 ${this.nick} ${params[0]} :End of /NAMES list.`);
        break;
    }
  }
}
