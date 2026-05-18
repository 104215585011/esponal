const { parseJson3ToCues } = require("./parseJson3.js");

const ESPONAL_APP_ORIGIN = process.env.ESPONAL_APP_ORIGIN || "http://localhost:3000";
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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ videoId, lang, cues })
  });

  if (!ingestResponse.ok) {
    return;
  }

  chrome.storage.local.set({
    lastSubtitleHarvest: {
      videoId,
      lang,
      cueCount: cues.length,
      harvestedAt: new Date().toISOString()
    }
  });
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
      const spanishTracks = tracks.filter((track) =>
        track?.languageCode?.startsWith("es")
      );

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
