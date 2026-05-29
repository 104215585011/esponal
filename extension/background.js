chrome.runtime.onInstalled.addListener(() => {
  console.info("Esponal extension service worker started");
});

chrome.runtime.onStartup.addListener(() => {
  console.info("Esponal extension service worker started");
});

function readPlayerCaptionTracks() {
  const tracks = window.ytInitialPlayerResponse
    ?.captions
    ?.playerCaptionsTracklistRenderer
    ?.captionTracks;
  return Array.isArray(tracks) ? tracks : [];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "subtitle-harvested") {
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
    return;
  }

  if (message?.type === "esponal-install-hook") {
    const tabId = sender.tab?.id;

    if (typeof tabId !== "number") {
      sendResponse({ ok: false });
      return;
    }

    chrome.scripting
      .executeScript({
        target: {
          tabId,
          frameIds: sender.frameId !== undefined ? [sender.frameId] : [0]
        },
        world: "MAIN",
        files: ["dist/hook-timedtext.js"]
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.warn("[esponal harvest] install hook failed", error);
        sendResponse({ ok: false });
      });

    return true;
  }

  if (message?.type === "esponal-get-player-tracks") {
    const tabId = sender.tab?.id;

    if (typeof tabId !== "number") {
      sendResponse({ tracks: [] });
      return;
    }

    // Run in MAIN world so we can read window.ytInitialPlayerResponse
    // directly. Inline-script bridging via <script> tags is blocked by
    // YouTube's CSP + Trusted Types since 2025.
    chrome.scripting
      .executeScript({
        target: {
          tabId,
          frameIds: sender.frameId !== undefined ? [sender.frameId] : [0]
        },
        world: "MAIN",
        func: readPlayerCaptionTracks
      })
      .then((results) => {
        const tracks = Array.isArray(results) && results[0]?.result;
        sendResponse({ tracks: Array.isArray(tracks) ? tracks : [] });
      })
      .catch((error) => {
        console.warn("[esponal harvest] executeScript failed", error);
        sendResponse({ tracks: [] });
      });

    return true; // keep the response channel open for the async sendResponse
  }
});

// Reliable injection into cross-origin YouTube embed iframes.
// Declarative all_frames content scripts proved unreliable for the embedded
// player iframe in some browsers (Edge), so the service worker injects the
// timedtext hook (MAIN world) + harvest (isolated world) directly when an
// embed sub-frame commits navigation. frameId !== 0 means it's a sub-frame.
const ESPONAL_EMBED_FRAME_RE = /^https:\/\/www\.youtube\.com\/embed\//;

async function injectHarvestIntoEmbedFrame(tabId, frameId, url) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      files: ["dist/hook-timedtext.js"]
    });
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "ISOLATED",
      files: ["dist/harvest.js"]
    });
    console.log("[esponal bg] injected harvest into embed frame", url);
  } catch (error) {
    console.warn("[esponal bg] embed inject failed", url, error);
  }
}

if (chrome.webNavigation?.onCommitted) {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) return;
    if (!ESPONAL_EMBED_FRAME_RE.test(details.url)) return;
    injectHarvestIntoEmbedFrame(details.tabId, details.frameId, details.url);
  });
}
