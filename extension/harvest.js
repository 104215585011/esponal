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

function isSpanishLang(code) {
  return code === "es" || (typeof code === "string" && code.startsWith("es-"));
}

async function getPlayerCaptionTracks() {
  // The classic bridge pattern (injecting an inline <script> tag and using
  // window.postMessage to hop back to the isolated world) is dead on
  // youtube.com — their CSP refuses 'unsafe-inline' and Trusted Types
  // blocks string-to-script assignment. Delegate to the service worker,
  // which can run a function in the MAIN world via chrome.scripting.
  return new Promise((resolve) => {
    let settled = false;

    chrome.runtime.sendMessage({ type: "esponal-get-player-tracks" }, (response) => {
      if (settled) return;
      settled = true;
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      const tracks = response?.tracks;
      resolve(Array.isArray(tracks) ? tracks : []);
    });

    // Defensive timeout — if the service worker is asleep and never
    // responds, don't leave harvest hanging forever.
    setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve([]);
    }, 5000);
  });
}

function showHarvestBadge() {
  chrome.runtime.sendMessage({ type: "subtitle-harvested" }).catch(() => {});
}

async function ingestCues(videoId, lang, cues) {
  if (cues.length < MIN_HARVEST_CUES) {
    return;
  }

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

async function installTimedtextHook() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "esponal-install-hook" }, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

async function handleCapturedTimedtext(url, body) {
  const videoId = getVideoId();
  if (!videoId || typeof url !== "string" || typeof body !== "string") {
    return;
  }

  const captureKey = `${videoId}:${url}`;
  window.__esponalCapturedTimedtext ||= new Set();
  if (window.__esponalCapturedTimedtext.has(captureKey)) {
    return;
  }
  window.__esponalCapturedTimedtext.add(captureKey);

  const params = new URL(url, location.origin).searchParams;
  const capturedVideoId = params.get("v") ?? "";
  if (capturedVideoId !== videoId) {
    return;
  }

  const langParam = params.get("lang") ?? "";
  if (!isSpanishLang(langParam)) {
    return;
  }
  const lang = langParam;

  let cues;
  try {
    cues = parseJson3ToCues(JSON.parse(body));
  } catch {
    return;
  }

  await ingestCues(videoId, lang, cues);
}

function listenForTimedtextCaptures() {
  if (window.__esponalTimedtextListenerInstalled) {
    return;
  }
  window.__esponalTimedtextListenerInstalled = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "esponal-captured-timedtext") return;

    handleCapturedTimedtext(event.data.url, event.data.body).catch((error) => {
      console.warn("[esponal harvest]", error);
    });
  });
}

async function startHarvest() {
  const videoId = getVideoId();

  if (!videoId || window.__esponalHarvested === videoId) {
    return;
  }

  window.__esponalHarvested = videoId;

  const tracks = await getPlayerCaptionTracks();
  const spanishTracks = tracks.filter((track) => track?.languageCode?.startsWith("es"));

  if (spanishTracks.length === 0) {
    return;
  }

  listenForTimedtextCaptures();
  await installTimedtextHook();
}

startHarvest().catch((error) => {
  console.warn("[esponal harvest]", error);
});
