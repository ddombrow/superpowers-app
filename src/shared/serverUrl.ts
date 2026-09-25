/**
 * Turns what users type as a server hostname ("example.com", "https://example.com/")
 * and port into the URLs used to reach it.
 */
export function getServerUrls(hostnameInput: string, port: string | number) {
  let hostname = hostnameInput.trim();
  let protocol = "http";
  if (hostname.startsWith("https://")) {
    protocol = "https";
    hostname = hostname.slice("https://".length);
  } else if (hostname.startsWith("http://")) {
    hostname = hostname.slice("http://".length);
  }
  hostname = hostname.replace(/\/+$/, "");

  const hostnameAndPort = `${hostname}:${port}`;
  return { protocol, hostname, hostnameAndPort, baseUrl: `${protocol}://${hostnameAndPort}` };
}
