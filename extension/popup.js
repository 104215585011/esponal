document.getElementById("openApp")?.addEventListener("click", () => {
  chrome.tabs.create({
    url: "https://localhost:3000/"
  });
});
