const showChineseKey = "showChineseSubtitles";
const toggleButton = document.getElementById("toggleChinese");

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
