function decodeHtmlEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'");
}

export function parseJson3ToCues(json) {
  const events = Array.isArray(json?.events) ? json.events : [];
  const cues = [];

  for (const event of events) {
    const startMs = Number(event?.tStartMs);
    const durMs = Number(event?.dDurationMs);
    const segs = Array.isArray(event?.segs) ? event.segs : [];
    const text = decodeHtmlEntities(
      segs
        .map((seg) => (typeof seg?.utf8 === "string" ? seg.utf8 : ""))
        .join("")
        .replace(/\s+/g, " ")
        .trim()
    );

    if (!Number.isFinite(startMs) || !Number.isFinite(durMs) || durMs <= 0 || !text) {
      continue;
    }

    cues.push({
      start: startMs / 1000,
      dur: durMs / 1000,
      text
    });
  }

  return cues;
}
