const ESPONAL_API_BASE_URL = "https://localhost:3000/api/";

function markPageReady() {
  document.documentElement.dataset.esponalExtensionReady = "true";
  document.documentElement.classList.add("esponal-extension-ready");
}

try {
  markPageReady();
  console.info("Esponal content script active", {
    apiBaseUrl: ESPONAL_API_BASE_URL,
    href: window.location.href
  });
} catch (error) {
  console.error("Esponal content script failed", error);
}
