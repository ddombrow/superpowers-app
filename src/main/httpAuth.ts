import { app } from "electron";

// HTTP basic auth for password-protected servers, keyed by "hostname:port"
const httpAuthByHost = new Map<string, { username: string; password: string }>();

export function setHttpAuth(hostnameAndPort: string, auth: { username: string; password: string }) {
  httpAuthByHost.set(hostnameAndPort, auth);
}

export function setupHttpAuth() {
  app.on("login", (event, _webContents, details, _authInfo, callback) => {
    event.preventDefault();

    const url = new URL(details.url);
    const port = url.port !== "" ? url.port : url.protocol === "https:" ? "443" : "80";
    const hostnameAndPort = `${url.hostname}:${port}`;

    const respond = () => {
      const auth = httpAuthByHost.get(hostnameAndPort);
      if (auth == null) callback();
      else callback(auth.username, auth.password);
    };

    // The renderer's "set-http-auth" message might race with the request, so give it a second
    if (httpAuthByHost.has(hostnameAndPort)) respond();
    else setTimeout(respond, 1000);
  });
}
