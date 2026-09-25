export type Segment =
  { type: "text"; text: string } | { type: "link"; url: string } | { type: "channel"; name: string };

const tokenRegex = /(https?:\/\/[^\s]+)|(?<=^|\s)(#[#\w-]+)/g;

/** Splits a chat message into text, links and channel names (rendered as elements, never as HTML) */
export function linkify(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(tokenRegex)) {
    if (match.index > lastIndex) segments.push({ type: "text", text: text.slice(lastIndex, match.index) });
    if (match[1] != null) segments.push({ type: "link", url: match[1] });
    else segments.push({ type: "channel", name: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) segments.push({ type: "text", text: text.slice(lastIndex) });
  return segments;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `message` mentions `nickname` as a whole word */
export function mentions(message: string, nickname: string) {
  return new RegExp(`(^|[^\\w-])${escapeRegex(nickname)}($|[^\\w-])`, "i").test(message);
}

/** A stable, translucent background color for a nickname's avatar */
export function nicknameColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  const r = (hash >> 16) & 0xff;
  const g = (hash >> 8) & 0xff;
  const b = hash & 0xff;
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
}

/**
 * For `<input pattern>`, which browsers compile with the `v` flag,
 * where "-" must be escaped inside character classes
 */
export const nicknamePatternString = "[A-Za-z][A-Za-z0-9_\\-]{1,15}";
export const nicknamePattern = new RegExp(`^${nicknamePatternString}$`);
