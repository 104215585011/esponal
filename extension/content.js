const ESPONAL_TRANSLATE_URL = "http://localhost:3000/api/translate";
const SHOW_CHINESE_KEY = "showChineseSubtitles";

let overlay;
let spanishLine;
let chineseLine;
let lastSubtitleText = "";
let showChineseSubtitles = true;
const localTranslationCache = new Map();

function markPageReady() {
  document.documentElement.dataset.esponalExtensionReady = "true";
  document.documentElement.classList.add("esponal-extension-ready");
}

function applyLineStyles() {
  Object.assign(overlay.style, {
    position: "absolute",
    zIndex: "2147483640",
    bottom: "60px",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "90%",
    pointerEvents: "none",
    textAlign: "center",
    backgroundColor: "transparent",
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    textShadow: "0 1px 4px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.6)"
  });

  Object.assign(spanishLine.style, {
    color: "rgba(255,255,255,0.75)",
    fontSize: "15px",
    fontWeight: "400",
    lineHeight: "1.5",
    letterSpacing: "0.02em",
    whiteSpace: "pre-wrap"
  });

  Object.assign(chineseLine.style, {
    color: "#FFFFFF",
    fontSize: "18px",
    fontWeight: "500",
    lineHeight: "1.5",
    letterSpacing: "0.02em",
    marginTop: "6px",
    overflow: "hidden",
    transition: "opacity 200ms ease, max-height 200ms ease",
    whiteSpace: "pre-wrap"
  });
}

function updateChineseVisibility() {
  Object.assign(chineseLine.style, {
    opacity: showChineseSubtitles ? "1" : "0",
    maxHeight: showChineseSubtitles ? "2em" : "0"
  });
}

function ensureOverlay() {
  const player = document.querySelector(".html5-video-player");

  if (!player) {
    return false;
  }

  if (overlay && player.contains(overlay)) {
    return true;
  }

  overlay = document.createElement("div");
  overlay.className = "esponal-subtitle-overlay";
  spanishLine = document.createElement("div");
  spanishLine.className = "esponal-subtitle-overlay__spanish";
  chineseLine = document.createElement("div");
  chineseLine.className = "esponal-subtitle-overlay__chinese";
  overlay.append(spanishLine, chineseLine);
  player.append(overlay);
  applyLineStyles();
  updateChineseVisibility();

  return true;
}

function readCaptionText() {
  return Array.from(document.querySelectorAll(".ytp-caption-segment"))
    .map((segment) => segment.textContent?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateSubtitle(text) {
  if (localTranslationCache.has(text)) {
    return localTranslationCache.get(text);
  }

  const response = await fetch(ESPONAL_TRANSLATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error(`Translate failed: ${response.status}`);
  }

  const data = await response.json();
  const translation = data.translation || "";
  localTranslationCache.set(text, translation);

  return translation;
}

async function renderSubtitle(text) {
  if (!ensureOverlay() || !text || text === lastSubtitleText) {
    return;
  }

  lastSubtitleText = text;
  spanishLine.textContent = text;
  chineseLine.textContent = "…";
  chineseLine.style.color = "rgba(255,255,255,0.4)";

  try {
    const translation = await translateSubtitle(text);

    if (text === lastSubtitleText) {
      chineseLine.textContent = translation;
      chineseLine.style.color = "#FFFFFF";
    }
  } catch (error) {
    console.warn("Esponal subtitle translation failed", error);
    chineseLine.textContent = "";
  }
}

function handleCaptionMutation() {
  ensureOverlay();
  const text = readCaptionText();

  if (text) {
    void renderSubtitle(text);
  }
}

function startCaptionObserver() {
  const observer = new MutationObserver(handleCaptionMutation);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  handleCaptionMutation();
}

chrome.storage.local.get({ [SHOW_CHINESE_KEY]: true }, (values) => {
  showChineseSubtitles = values[SHOW_CHINESE_KEY];
  if (ensureOverlay()) {
    updateChineseVisibility();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "TOGGLE_CHINESE_SUBTITLES") {
    showChineseSubtitles = Boolean(message.showChineseSubtitles);
    chrome.storage.local.set({ [SHOW_CHINESE_KEY]: showChineseSubtitles });
    if (ensureOverlay()) {
      updateChineseVisibility();
    }
  }
});

try {
  markPageReady();
  startCaptionObserver();
  console.info("Esponal content script active", {
    apiBaseUrl: ESPONAL_TRANSLATE_URL,
    href: window.location.href
  });
} catch (error) {
  console.error("Esponal content script failed", error);
}
