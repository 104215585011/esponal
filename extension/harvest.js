import { parseJson3ToCues } from "./parseJson3.js";

const ESPONAL_APP_ORIGIN =
  typeof __ESPONAL_APP_ORIGIN__ === "string"
    ? __ESPONAL_APP_ORIGIN__
    : "http://localhost:3000";
const ESPONAL_INGEST_TOKEN =
  typeof __EXT_INGEST_TOKEN__ === "string" ? __EXT_INGEST_TOKEN__ : "";
const MIN_HARVEST_CUES = 5;

function getVideoId() {
  return new URLSearchParams(location.search).get("v")?.trim() || "";
}

function normalizeLang(languageCode) {
  return languageCode?.startsWith("es-") ? languageCode : "es";
}

function postPlayerResponseBridge() {
  const script = document.createElement("script");
  script.textContent = `
    window.postMessage({
      type: "esponal-player-response",
      data: window.ytInitialPlayerResponse?.captions
        ?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    }, "*");
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function showHarvestBadge() {
  chrome.runtime.sendMessage({ type: "subtitle-harvested" }).catch(() => {});
}

async function ingestTrack(videoId, track) {
  const subtitleUrl = `${track.baseUrl}${track.baseUrl.includes("?") ? "&" : "?"}fmt=json3`;
  const subtitleResponse = await fetch(subtitleUrl, { credentials: "include" });

  if (!subtitleResponse.ok) {
    return;
  }

  const cues = parseJson3ToCues(await subtitleResponse.json());

  if (cues.length < MIN_HARVEST_CUES) {
    return;
  }

  const lang = normalizeLang(track.languageCode);
  const ingestResponse = await fetch(`${ESPONAL_APP_ORIGIN}/api/subtitle/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Esponal-Ingest-Token": ESPONAL_INGEST_TOKEN
    },
    body: JSON.stringify({ videoId, lang, cues })
  });

  if (!ingestResponse.ok) {
    return;
  }

  const payload = await ingestResponse.json().catch(() => null);

  if (!payload?.written) {
    return;
  }

  const lastCue = cues.at(-1);
  const durationSec = lastCue ? lastCue.start + lastCue.dur : 0;

  chrome.storage.local.set({
    lastSubtitleHarvest: {
      videoTitle: document.title.replace(/ - YouTube$/, ""),
      durationSec,
      harvestedAt: new Date().toISOString()
    }
  });
  showHarvestBadge();
}

function startHarvest() {
  const videoId = getVideoId();

  if (!videoId || window.__esponalHarvested === videoId) {
    return;
  }

  window.__esponalHarvested = videoId;
  window.addEventListener(
    "message",
    (event) => {
      if (event.source !== window || event.data?.type !== "esponal-player-response") {
        return;
      }

      const tracks = Array.isArray(event.data.data) ? event.data.data : [];
      const spanishTracks = tracks.filter((track) => track?.languageCode?.startsWith("es"));

      for (const track of spanishTracks) {
        if (typeof track?.baseUrl !== "string") {
          continue;
        }

        ingestTrack(videoId, track).catch((error) => {
          console.warn("[esponal harvest]", error);
        });
      }
    },
    { once: true }
  );

  postPlayerResponseBridge();
}

try {
  startHarvest();
} catch (error) {
  console.warn("[esponal harvest]", error);
}
