const showChineseKey = "showChineseSubtitles";
const toggleButton = document.getElementById("toggleChinese");
const lastHarvest = document.getElementById("lastHarvest");

function updateBadge(showChineseSubtitles) {
  chrome.action.setBadgeText({
    text: showChineseSubtitles ? "" : "中"
  });
  chrome.action.setBadgeBackgroundColor({
    color: "#9CA3AF"
  });
}

function updateToggleLabel(showChineseSubtitles) {
  if (toggleButton) {
    toggleButton.textContent = showChineseSubtitles ? "隐藏中文翻译" : "显示中文翻译";
  }
}

chrome.storage.local.get({ [showChineseKey]: true }, (values) => {
  updateToggleLabel(values[showChineseKey]);
  updateBadge(values[showChineseKey]);
});

chrome.storage.local.get({ lastSubtitleHarvest: null }, (values) => {
  const harvest = values.lastSubtitleHarvest;

  if (!lastHarvest || !harvest?.videoId || !harvest?.harvestedAt) {
    return;
  }

  const harvestedAt = new Date(harvest.harvestedAt);
  const label = Number.isNaN(harvestedAt.getTime())
    ? harvest.harvestedAt
    : harvestedAt.toLocaleString("zh-CN", {
        hour12: false,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });

  lastHarvest.textContent = `最近收割：${label}, videoId=${harvest.videoId}`;
});

toggleButton?.addEventListener("click", () => {
  chrome.storage.local.get({ [showChineseKey]: true }, (values) => {
    const showChineseSubtitles = !values[showChineseKey];
    chrome.storage.local.set({ [showChineseKey]: showChineseSubtitles }, () => {
      updateToggleLabel(showChineseSubtitles);
      updateBadge(showChineseSubtitles);
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: "TOGGLE_CHINESE_SUBTITLES",
            showChineseSubtitles
          });
        }
      });
    });
  });
});

document.getElementById("openApp")?.addEventListener("click", () => {
  chrome.tabs.create({
    url: "http://localhost:3000/"
  });
});
