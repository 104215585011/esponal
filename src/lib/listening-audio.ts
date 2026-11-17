// Timestamp: 2026-11-17 15:05
const ALLOWED_PODCAST_HOST_SUFFIXES = [
  "blubrry.com",
  "blubrry.net",
  "libsyn.com",
  "anchor.fm",
  "cloudfront.net",
  "megaphone.fm",
  "buzzsprout.com",
  "podbean.com",
  "simplecast.com",
  "acast.com",
  "spreaker.com",
  "rfi.fr",
  "bbc.co.uk",
  "bbci.co.uk",
  "ivoox.com",
  "hoyhablamos.com",
  "1001reasonstolearnspanish.com",
  "slowgerman.com",
  "svmaudio.com",
  "mzstatic.com",
  "traffic.megaphone.fm"
];

export type PodcastCue = {
  start: number;
  dur: number;
  text: string;
  zh: string;
};

export function isAllowedPodcastAudioUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.endsWith(".local")
    ) {
      return null;
    }
    const allowed = ALLOWED_PODCAST_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
    return allowed ? url : null;
  } catch {
    return null;
  }
}
