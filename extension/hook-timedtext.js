(() => {
  if (window.__esponalHookInstalled) return;
  window.__esponalHookInstalled = true;

  const TIMEDTEXT_RE = /\/api\/timedtext\?/;

  const postCaptured = (url, body) => {
    window.postMessage(
      { type: "esponal-captured-timedtext", url, body },
      location.origin
    );
  };

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const response = await origFetch.call(this, input, init);

    try {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (TIMEDTEXT_RE.test(url) && response.ok) {
        response.clone().text().then((body) => {
          if (body && body.length > 200) postCaptured(url, body);
        }).catch(() => {});
      }
    } catch {
      // Keep YouTube's player fetch path untouched if capture fails.
    }

    return response;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__esponalUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this.__esponalUrl ?? "";

    if (TIMEDTEXT_RE.test(url)) {
      this.addEventListener("load", () => {
        try {
          if (this.status < 200 || this.status >= 300) return;
          const body = this.responseText;
          if (body && body.length > 200) postCaptured(url, body);
        } catch {
          // Some responseType values reject responseText reads; leave YouTube untouched.
        }
      });
    }

    return origSend.apply(this, args);
  };
})();
