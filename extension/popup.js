const showChineseKey = "showChineseSubtitles";
const toggleButton = document.getElementById("toggleChinese");
const recentHarvestMeta = document.getElementById("recentHarvestMeta");
const relativeTimeFormatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

function truncateTitle(value) {
  return value.length > 30 ? `${value.slice(0, 30)}...` : value;
}

function formatHarvestAge(isoDate) {
  const timestamp = Date.parse(isoDate);

  if (!Number.isFinite(timestamp)) {
    return "刚刚";
  }

  const diffMs = timestamp - Date.now();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const absDiff = Math.abs(diffMs);

  if (absDiff < minuteMs) {
    return "刚刚";
  }

  if (absDiff < hourMs) {
    return relativeTimeFormatter.format(Math.round(diffMs / minuteMs), "minute");
  }

  if (absDiff < dayMs) {
    return relativeTimeFormatter.format(Math.round(diffMs / hourMs), "hour");
  }

  return relativeTimeFormatter.format(Math.round(diffMs / dayMs), "day");
}

function formatDuration(durationSec) {
  if (durationSec < 60) {
    return "不到 1 分钟字幕";
  }

  return `约 ${Math.round(durationSec / 60)} 分钟字幕`;
}

function renderRecentHarvest(harvest) {
  if (!recentHarvestMeta) {
    return;
  }

  if (!harvest?.videoTitle || !harvest?.harvestedAt) {
    recentHarvestMeta.textContent =
      "尚未采集任何字幕，去 YouTube 看几个西语视频试试。";
    return;
  }

  const title = truncateTitle(harvest.videoTitle);
  const durationText = formatDuration(Number(harvest.durationSec) || 0);
  const relativeText = formatHarvestAge(harvest.harvestedAt);
  recentHarvestMeta.textContent = `${title} · ${durationText} · ${relativeText}`;
}

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
  renderRecentHarvest(values.lastSubtitleHarvest);
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
