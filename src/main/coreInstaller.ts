import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import * as yauzl from "yauzl";
import { registryURL } from "../shared/endpoints";

export type ProgressCallback = (value: number | null, max: number) => void;

export async function isCoreInstalled(corePath: string) {
  try {
    await access(join(corePath, "package.json"));
    return true;
  } catch {
    return false;
  }
}

async function fetchOK(url: string) {
  const response = await fetch(url, { headers: { "user-agent": "Superpowers" } });
  if (!response.ok) throw new Error(`Unexpected status code ${response.status} for ${url}`);
  return response;
}

/**
 * Maps a zip entry to its destination on disk, or returns null for the root folder itself.
 * Every entry must be inside `rootFolderName` and must not escape `targetPath` ("zip slip").
 */
export function resolveEntryPath(targetPath: string, rootFolderName: string, entryName: string): string | null {
  const parts = entryName.split("/");
  if (parts[0] !== rootFolderName) throw new Error(`Found file outside of root folder: ${entryName}`);

  const relativePath = parts.slice(1).join("/");
  if (relativePath === "") return null;

  const target = resolve(targetPath);
  const destination = resolve(target, relativePath);
  const relativeToTarget = relative(target, destination);
  if (
    relativeToTarget === "" ||
    relativeToTarget === ".." ||
    relativeToTarget.startsWith(`..${sep}`) ||
    isAbsolute(relativeToTarget)
  ) {
    throw new Error(`Refusing to extract outside of the target folder: ${entryName}`);
  }
  return destination;
}

/** Extracts a GitHub-style release zip (everything inside one root folder) into `targetPath` */
export async function extractZip(
  zipBuffer: Buffer,
  targetPath: string,
  rootFolderName: string,
  onEntry?: (index: number, count: number) => void
) {
  const zipFile = await yauzl.fromBufferPromise(zipBuffer, { lazyEntries: true });

  await new Promise<void>((resolvePromise, reject) => {
    let processed = 0;

    zipFile.on("error", reject);
    zipFile.on("end", () => resolvePromise());
    zipFile.on("entry", (entry: yauzl.Entry) => {
      void (async () => {
        const destination = resolveEntryPath(targetPath, rootFolderName, entry.fileName.replace(/\/$/, ""));

        if (destination != null) {
          if (entry.fileName.endsWith("/")) {
            await mkdir(destination, { recursive: true });
          } else {
            await mkdir(dirname(destination), { recursive: true });
            await pipeline(await zipFile.openReadStreamPromise(entry), createWriteStream(destination));
          }
        }

        processed++;
        onEntry?.(processed, zipFile.entryCount);
        zipFile.readEntry();
      })().catch((err) => {
        zipFile.close();
        reject(err);
      });
    });

    zipFile.readEntry();
  });
}

/** Downloads the latest core from the registry and extracts it into `corePath` */
export async function installCore(corePath: string, onProgress: ProgressCallback) {
  onProgress(null, 0);

  const registry = await (await fetchOK(registryURL)).json();
  const downloadURL: string = registry.core.downloadURL;
  const response = await fetchOK(downloadURL);

  // First half of the progress bar is the download, second half is the extraction
  const size = Number(response.headers.get("content-length") ?? 0);
  const chunks: Uint8Array[] = [];
  let downloaded = 0;
  onProgress(size > 0 ? 0 : null, size * 2);

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
    downloaded += chunk.length;
    if (size > 0) onProgress(downloaded, size * 2);
  }

  const rootFolderName = parse(new URL(downloadURL).pathname).name;
  await extractZip(Buffer.concat(chunks), corePath, rootFolderName, (index, count) => {
    onProgress(count + index, count * 2);
  });
}
