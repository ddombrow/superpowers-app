import type { ServerProbeResult } from "../shared/types";

/** Checks that `baseUrl` runs a compatible Superpowers server before loading it in a webview */
export async function probeServer(
  baseUrl: string,
  password: string,
  appApiVersion: number
): Promise<ServerProbeResult> {
  const headers: Record<string, string> = {};
  if (password.length > 0) headers.authorization = `Basic ${Buffer.from(`superpowers:${password}`).toString("base64")}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/superpowers.json`, { headers, signal: AbortSignal.timeout(10_000) });
  } catch {
    return { ok: false, error: "unreachable" };
  }

  if (response.status === 401) return { ok: false, error: "unauthorized" };
  if (!response.ok) return { ok: false, error: "unreachable" };

  let info: { appApiVersion?: unknown; buildPort?: unknown };
  try {
    info = await response.json();
  } catch {
    return { ok: false, error: "notSuperpowers" };
  }
  if (info == null || typeof info !== "object" || typeof info.appApiVersion !== "number") {
    return { ok: false, error: "notSuperpowers" };
  }
  if (info.appApiVersion !== appApiVersion) {
    return { ok: false, error: "incompatible", serverApiVersion: info.appApiVersion };
  }

  return { ok: true, buildPort: Number(info.buildPort) };
}
