const ESPONAL_TRANSLATE_URL = "http://localhost:3000/api/translate";
const ESPONAL_LEMMATIZE_URL = "http://localhost:3000/api/lemmatize";
const ESPONAL_VOCAB_ADD_URL = "http://localhost:3000/api/vocab/add";
const ESPONAL_VOCAB_HIGHLIGHT_URL = "http://localhost:3000/api/vocab/highlight";
const ESPONAL_LOGIN_URL = "http://localhost:3000/api/auth/signin";
const SHOW_CHINESE_KEY = "showChineseSubtitles";
const WORD_HIGHLIGHT_COLORS = {
  course: "#86EFAC",
  saved: "#93C5FD",
  unknown: ""
};

let overlay;
let spanishLine;
let chineseLine;
let lookupCard;
let lookupCardBody;
let loginHint;
let addButton;
let lastSubtitleText = "";
let lastSubtitleTranslation = "";
let showChineseSubtitles = true;
let activeLookupToken = 0;
let activeLookupWord = "";
const localTranslationCache = new Map();
const localLemmaCache = new Map();
const localHighlightCache = new Map();
const savedLemmaSet = new Set();

function markPageReady() {
  document.documentElement.dataset.esponalExtensionReady = "true";
  document.documentElement.classList.add("esponal-extension-ready");
}

function normalizeWordToken(token) {
  return token
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, "");
}

function tokenizeCaptionText(text) {
  return text.match(/(\s+|[^\s]+)/gu) ?? [];
}

function getCurrentVideoTimestamp() {
  const video = document.querySelector("video");

  if (!video || Number.isNaN(video.currentTime)) {
    return 0;
  }

  return Math.max(0, Math.floor(video.currentTime));
}

function applyLineStyles() {
  Object.assign(overlay.style, {
    position: "absolute",
    zIndex: "2147483640",
    bottom: "60px",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "90%",
    textAlign: "center",
    backgroundColor: "transparent",
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    textShadow: "0 1px 4px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.6)",
    pointerEvents: "none"
  });

  Object.assign(spanishLine.style, {
    color: "rgba(255,255,255,0.75)",
    fontSize: "15px",
    fontWeight: "400",
    lineHeight: "1.5",
    letterSpacing: "0.02em",
    whiteSpace: "pre-wrap",
    pointerEvents: "auto",
    cursor: "default"
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
    whiteSpace: "pre-wrap",
    pointerEvents: "none"
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
  bindSpanishLineEvents();

  return true;
}

function bindSpanishLineEvents() {
  if (!spanishLine || spanishLine.dataset.wordEventsBound === "true") {
    return;
  }

  spanishLine.dataset.wordEventsBound = "true";
  spanishLine.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const wordElement = target.closest(".esponal-word");

    if (!(wordElement instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const word = wordElement.dataset.word ?? "";

    if (!word) {
      return;
    }

    void openLookupCard(wordElement, word);
  });
}

function renderSpanishWords(text) {
  spanishLine.replaceChildren();

  for (const token of tokenizeCaptionText(text)) {
    const normalized = normalizeWordToken(token);

    if (!normalized) {
      spanishLine.append(document.createTextNode(token));
      continue;
    }

    const word = document.createElement("span");
    word.className = "esponal-word";
    word.dataset.word = normalized;
    word.dataset.status = "unknown";
    word.setAttribute("data-word", normalized);
    word.setAttribute("data-status", "unknown");
    word.textContent = token;
    Object.assign(word.style, {
      cursor: "pointer",
      pointerEvents: "auto",
      color: WORD_HIGHLIGHT_COLORS.unknown
    });
    spanishLine.append(word);
  }
}

function collectUniqueCaptionWords(text) {
  return Array.from(
    new Set(
      tokenizeCaptionText(text)
        .map((token) => normalizeWordToken(token))
        .filter(Boolean)
    )
  );
}

function applyHighlightToWordElement(wordElement, status) {
  wordElement.dataset.status = status;
  wordElement.setAttribute("data-status", status);
  wordElement.style.color = WORD_HIGHLIGHT_COLORS[status];
}

async function fetchHighlightStatuses(words) {
  const uncachedWords = words.filter((word) => !localHighlightCache.has(word));

  if (uncachedWords.length > 0) {
    const response = await fetch(ESPONAL_VOCAB_HIGHLIGHT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ words: uncachedWords })
    });

    if (!response.ok) {
      throw new Error(`Highlight failed: ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];

    for (const item of items) {
      if (typeof item?.word !== "string") {
        continue;
      }

      const status =
        item.status === "saved" || item.status === "course" ? item.status : "unknown";
      localHighlightCache.set(item.word, status);
    }
  }

  return new Map(
    words.map((word) => [word, localHighlightCache.get(word) ?? "unknown"])
  );
}

async function updateSubtitleHighlights(text) {
  if (!spanishLine) {
    return;
  }

  const words = collectUniqueCaptionWords(text);

  if (words.length === 0) {
    return;
  }

  try {
    const statusByWord = await fetchHighlightStatuses(words);

    if (text !== lastSubtitleText || !spanishLine) {
      return;
    }

    for (const wordElement of spanishLine.querySelectorAll(".esponal-word")) {
      if (!(wordElement instanceof HTMLElement)) {
        continue;
      }

      const status = statusByWord.get(wordElement.dataset.word ?? "") ?? "unknown";
      applyHighlightToWordElement(wordElement, status);
    }
  } catch (error) {
    console.warn("Esponal subtitle highlight failed", error);
  }
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

function ensureLookupCard() {
  if (lookupCard && document.body.contains(lookupCard)) {
    return lookupCard;
  }

  lookupCard = document.createElement("div");
  lookupCard.className = "esponal-lookup-card";
  Object.assign(lookupCard.style, {
    position: "fixed",
    minWidth: "200px",
    maxWidth: "280px",
    background: "#FFFFFF",
    borderRadius: "12px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)",
    padding: "14px 16px",
    border: "1px solid rgba(0,0,0,0.06)",
    zIndex: "2147483644",
    opacity: "0",
    transform: "translateY(4px)",
    transition: "opacity 150ms ease-in, transform 150ms ease-in",
    pointerEvents: "auto"
  });

  lookupCardBody = document.createElement("div");
  loginHint = document.createElement("div");
  Object.assign(loginHint.style, {
    fontSize: "11px",
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: "10px",
    display: "none"
  });
  lookupCard.append(loginHint, lookupCardBody);
  document.body.append(lookupCard);

  return lookupCard;
}

function positionLookupCard(anchorElement) {
  const card = ensureLookupCard();
  const rect = anchorElement.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const spacing = 8;
  const sidePadding = 12;
  let left = rect.left + rect.width / 2 - cardRect.width / 2;
  let top = rect.top - cardRect.height - spacing;

  if (left < sidePadding) {
    left = sidePadding;
  }

  if (left + cardRect.width > viewportWidth - sidePadding) {
    left = viewportWidth - sidePadding - cardRect.width;
  }

  if (top < 8) {
    top = rect.bottom + spacing;
  }

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function closeLookupCard() {
  if (!lookupCard) {
    return;
  }

  lookupCard.style.opacity = "0";
  lookupCard.style.transform = "translateY(4px)";
  activeLookupWord = "";
}

function openCardElement(anchorElement) {
  positionLookupCard(anchorElement);
  requestAnimationFrame(() => {
    if (!lookupCard) {
      return;
    }

    lookupCard.style.opacity = "1";
    lookupCard.style.transform = "translateY(0)";
  });
}

function setButtonState(state) {
  if (!addButton) {
    return;
  }

  const baseStyle = {
    width: "100%",
    height: "32px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    border: "none"
  };

  Object.assign(addButton.style, baseStyle);

  if (state === "loading") {
    addButton.textContent = "保存中…";
    addButton.disabled = true;
    addButton.style.background = "#ECFDF5";
    addButton.style.color = "#059669";
    addButton.style.opacity = "0.7";
    addButton.style.cursor = "progress";
    return;
  }

  if (state === "success" || state === "saved") {
    addButton.textContent = "✓ 已加入词库";
    addButton.disabled = state === "saved";
    addButton.style.background = "#ECFDF5";
    addButton.style.color = "#059669";
    addButton.style.opacity = "1";
    addButton.style.cursor = state === "saved" ? "default" : "pointer";
    return;
  }

  if (state === "login") {
    addButton.textContent = "请先登录";
    addButton.disabled = true;
    addButton.style.background = "#F3F4F6";
    addButton.style.color = "#9CA3AF";
    addButton.style.opacity = "1";
    addButton.style.cursor = "default";
    return;
  }

  if (state === "disabled") {
    addButton.textContent = "无法查词";
    addButton.disabled = true;
    addButton.style.background = "#F3F4F6";
    addButton.style.color = "#9CA3AF";
    addButton.style.opacity = "1";
    addButton.style.cursor = "default";
    return;
  }

  addButton.textContent = "加入我的词库";
  addButton.disabled = false;
  addButton.style.background = "#ECFDF5";
  addButton.style.color = "#059669";
  addButton.style.opacity = "1";
  addButton.style.cursor = "pointer";
}

function renderLookupCardContent(payload) {
  ensureLookupCard();
  loginHint.style.display = "none";
  loginHint.replaceChildren();
  lookupCardBody.replaceChildren();

  const row1 = document.createElement("div");
  Object.assign(row1.style, {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap"
  });

  const lemmaText = document.createElement("div");
  lemmaText.textContent = payload.lemma;
  Object.assign(lemmaText.style, {
    fontSize: "17px",
    fontWeight: "700",
    color: "#111827"
  });
  row1.append(lemmaText);

  if (payload.partOfSpeech) {
    const badge = document.createElement("span");
    badge.textContent = payload.partOfSpeech;
    Object.assign(badge.style, {
      marginLeft: "6px",
      fontSize: "11px",
      background: "#F3F4F6",
      color: "#6B7280",
      borderRadius: "4px",
      padding: "1px 6px"
    });
    row1.append(badge);
  }

  lookupCardBody.append(row1);

  if (payload.morphInfo) {
    const row2 = document.createElement("div");
    row2.textContent = payload.morphInfo;
    Object.assign(row2.style, {
      fontSize: "12px",
      color: "#6B7280",
      marginTop: "4px"
    });
    lookupCardBody.append(row2);
  }

  const row3 = document.createElement("div");
  row3.textContent = payload.translation;
  Object.assign(row3.style, {
    fontSize: "14px",
    color: payload.translationMuted ? "#9CA3AF" : "#374151",
    marginTop: "8px"
  });
  lookupCardBody.append(row3);

  const divider = document.createElement("hr");
  Object.assign(divider.style, {
    margin: "10px 0",
    border: "none",
    borderTop: "1px solid #F3F4F6"
  });
  lookupCardBody.append(divider);

  addButton = document.createElement("button");
  addButton.type = "button";
  lookupCardBody.append(addButton);
  setButtonState(payload.buttonState);
}

function renderUnsupportedCard(anchorElement, form) {
  renderLookupCardContent({
    lemma: form,
    morphInfo: "",
    translation: "暂不支持该词",
    translationMuted: true,
    partOfSpeech: "",
    buttonState: "disabled"
  });
  openCardElement(anchorElement);
}

async function lookupLemma(form) {
  if (localLemmaCache.has(form)) {
    return localLemmaCache.get(form);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(ESPONAL_LEMMATIZE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ form }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Lemmatize failed: ${response.status}`);
    }

    const payload = await response.json();
    localLemmaCache.set(form, payload);

    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function saveWordToVocab(payload) {
  const response = await fetch(ESPONAL_VOCAB_ADD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 401) {
    return { ok: false, unauthorized: true };
  }

  if (!response.ok) {
    throw new Error(`Save failed: ${response.status}`);
  }

  return { ok: true };
}

function showLoginHint() {
  loginHint.style.display = "block";
  const link = document.createElement("a");
  link.href = ESPONAL_LOGIN_URL;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "前往 Esponal 登录";
  link.style.color = "#9CA3AF";
  loginHint.replaceChildren(link);
}

async function openLookupCard(anchorElement, form) {
  ensureOverlay();
  ensureLookupCard();
  activeLookupToken += 1;
  const lookupToken = activeLookupToken;
  activeLookupWord = form;

  try {
    const payload = await lookupLemma(form);

    if (lookupToken !== activeLookupToken || activeLookupWord !== form) {
      return;
    }

    if (!payload?.lemma || !payload?.translation) {
      renderUnsupportedCard(anchorElement, form);
      return;
    }

    const buttonState = savedLemmaSet.has(payload.lemma) ? "saved" : "default";
    renderLookupCardContent({
      lemma: payload.lemma,
      morphInfo: payload.morphInfo || "",
      translation: payload.translation,
      translationMuted: false,
      partOfSpeech: payload.partOfSpeech || "",
      buttonState
    });
    openCardElement(anchorElement);

    addButton.onclick = async () => {
      if (savedLemmaSet.has(payload.lemma)) {
        setButtonState("saved");
        return;
      }

      setButtonState("loading");

      try {
        const saveResult = await saveWordToVocab({
          lemma: payload.lemma,
          translation: payload.translation,
          form,
          sourceUrl: window.location.href,
          timestampSec: getCurrentVideoTimestamp(),
          originalSentence: lastSubtitleText,
          translatedSentence: lastSubtitleTranslation || payload.translation
        });

        if (saveResult.unauthorized) {
          showLoginHint();
          setButtonState("login");
          return;
        }

        savedLemmaSet.add(payload.lemma);
        setButtonState("success");
      } catch (error) {
        console.warn("Esponal save vocab failed", error);
        setButtonState("disabled");
      }
    };
  } catch (error) {
    console.warn("Esponal lemmatize failed", error);
    renderUnsupportedCard(anchorElement, form);
  }
}

function bindGlobalCardListeners() {
  if (document.documentElement.dataset.esponalCardEventsBound === "true") {
    return;
  }

  document.documentElement.dataset.esponalCardEventsBound = "true";

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;

    if (!(target instanceof Node) || !lookupCard) {
      return;
    }

    if (!lookupCard.contains(target) && !spanishLine?.contains(target)) {
      closeLookupCard();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLookupCard();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    closeLookupCard();
  });
}

async function renderSubtitle(text) {
  if (!ensureOverlay() || !text || text === lastSubtitleText) {
    return;
  }

  closeLookupCard();
  lastSubtitleText = text;
  renderSpanishWords(text);
  void updateSubtitleHighlights(text);
  chineseLine.textContent = "…";
  chineseLine.style.color = "rgba(255,255,255,0.4)";

  try {
    const translation = await translateSubtitle(text);

    if (text === lastSubtitleText) {
      lastSubtitleTranslation = translation;
      chineseLine.textContent = translation;
      chineseLine.style.color = "#FFFFFF";
    }
  } catch (error) {
    console.warn("Esponal subtitle translation failed", error);
    lastSubtitleTranslation = "";
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

if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get({ [SHOW_CHINESE_KEY]: true }, (values) => {
    showChineseSubtitles = values[SHOW_CHINESE_KEY];
    if (ensureOverlay()) {
      updateChineseVisibility();
    }
  });
}

if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "TOGGLE_CHINESE_SUBTITLES") {
      showChineseSubtitles = Boolean(message.showChineseSubtitles);
      chrome.storage.local.set({ [SHOW_CHINESE_KEY]: showChineseSubtitles });
      if (ensureOverlay()) {
        updateChineseVisibility();
      }
    }
  });
}

try {
  markPageReady();
  bindGlobalCardListeners();
  startCaptionObserver();
  console.info("Esponal content script active", {
    apiBaseUrl: ESPONAL_TRANSLATE_URL,
    href: window.location.href
  });
} catch (error) {
  console.error("Esponal content script failed", error);
}
