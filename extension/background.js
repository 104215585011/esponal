chrome.runtime.onInstalled.addListener(() => {
  console.info("Esponal extension service worker started");
});

chrome.runtime.onStartup.addListener(() => {
  console.info("Esponal extension service worker started");
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "subtitle-harvested") {
    return;
  }

  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
});
