// Timestamp: 2026-06-08 20:45
const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function normalizeVideoId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return YOUTUBE_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function parseYouTubeVideoId(input: string) {
  const raw = input.trim();
  const directId = normalizeVideoId(raw);
  if (directId) return directId;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname === "youtu.be") {
    return normalizeVideoId(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (hostname !== "youtube.com" && hostname !== "m.youtube.com" && hostname !== "music.youtube.com") {
    return null;
  }

  if (url.pathname === "/watch") {
    return normalizeVideoId(url.searchParams.get("v"));
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") {
    return normalizeVideoId(segments[1]);
  }

  return null;
}

// Extract a `t=` start-time hint from a YouTube URL. Accepts the compact
// `1h2m3s` form YouTube uses in share links, plus a bare number of seconds.
export function parseYouTubeStartSeconds(input: string): number | null {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    hostname !== "youtu.be" &&
    hostname !== "youtube.com" &&
    hostname !== "m.youtube.com"
  ) {
    return null;
  }

  const raw = url.searchParams.get("t") ?? "";
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }

  const parts = raw.match(/(\d+h)?(\d+m)?(\d+s)?/);
  if (!parts || parts[0] === "") return null;

  const hours = Number.parseInt(parts[1] ?? "0", 10) || 0;
  const minutes = Number.parseInt(parts[2] ?? "0", 10) || 0;
  const seconds = Number.parseInt(parts[3] ?? "0", 10) || 0;

  return hours * 3600 + minutes * 60 + seconds;
}
