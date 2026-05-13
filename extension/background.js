chrome.runtime.onInstalled.addListener(() => {
  console.info("Esponal extension service worker started");
});

chrome.runtime.onStartup.addListener(() => {
  console.info("Esponal extension service worker started");
});
