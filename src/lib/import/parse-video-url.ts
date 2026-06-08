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
