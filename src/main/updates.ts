import { appReleases } from "../shared/endpoints";
import type { AppUpdate } from "../shared/types";

/** Returns the latest release if it differs from `currentVersion` ("v1.2.3"). Never throws. */
export async function checkForAppUpdate(currentVersion: string): Promise<AppUpdate | null> {
  try {
    const response = await fetch(appReleases.latestAPI, {
      headers: { "user-agent": "Superpowers", accept: "application/vnd.github+json" }
    });
    if (!response.ok) return null;

    const release = (await response.json()) as { tag_name?: string };
    if (release.tag_name == null || release.tag_name === currentVersion) return null;
    return { latest: release.tag_name, current: currentVersion, downloadURL: appReleases.latestPage };
  } catch (err) {
    console.log(`Could not check for app updates: ${(err as Error).message}`);
    return null;
  }
}
