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
        target: { tabId },
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
        target: { tabId },
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
