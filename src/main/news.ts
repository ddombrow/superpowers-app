import { newsURL } from "../shared/endpoints";

/** Fetches the news in the user's language, falling back to its base language and then English */
export async function fetchNews(languageCode: string): Promise<string | null> {
  const candidates = [...new Set([languageCode, languageCode.split("-")[0], "en"])];

  for (const candidate of candidates) {
    try {
      const response = await fetch(newsURL(candidate), { signal: AbortSignal.timeout(10_000) });
      if (response.ok) return await response.text();
    } catch {
      // Try the next language
    }
  }
  return null;
}
