# EXT-008-FIX — 字幕采集器拿不到字幕（PO Token 缺失）

**优先级**：P0（EXT-008 上线即破，需立即修）
**类型**：FIX
**触发**：PM 端到端测试发现，2026-05-21

---

## 病症（已端到端确认）

PM 装上 EXT-008 重新打包的扩展（带正确的 `ESPONAL_APP_ORIGIN=https://esponalsssssss.vercel.app` 和 `EXT_INGEST_TOKEN`），在 YouTube `https://www.youtube.com/watch?v=1A9kpjdYJUg` 看西语视频，console 报错：

```
[esponal harvest] SyntaxError: Failed to execute 'json' on 'Response': Unexpected end of JSON input
    at ingestTrack (harvest.js:69:58)
```

排查路径：

1. **不是**我们后端返回空——console 报错点在 `parseJson3ToCues(await subtitleResponse.json())` 这一行，是从 YouTube 拿字幕那一步崩
2. Network 标签显示我们扩展的 fetch 拿到 200 OK 但 body 只有 **75 字节**，不是真字幕（YouTube 给的是空壳 JSON `{"events":[],"wireMagic":"pb3"}` 之类）
3. 对比同时 YouTube player 自己的 timedtext 请求拿到了 54-432B 完整字幕数据

## 根因

**扩展 fetch 字幕时 URL 缺少 `pot=` 和 `potc=1` 两个 PO Token 参数。**

`captionTrack.baseUrl`（从 `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks[].baseUrl` 拿到的）**不包含 PO Token**。PO Token 是 YouTube BotGuard JS 在 player 实际 fetch 字幕的**那一刻**动态计算后追加到 URL 的。

对比 PM 抓的 HAR（西语助手成功请求）：
```
https://www.youtube.com/api/timedtext?v=...
   &signature=C49A...&key=yt8&kind=asr&lang=es
   &potc=1                           ← 关键
   &pot=MlPqZqPqO9gKwupasmsJR3PT...  ← 关键
   &fmt=json3...
```

vs 我们扩展请求（缺这两个）：
```
https://www.youtube.com/api/timedtext?v=...
   &signature=3B20E1FD...&key=yt8&kind=asr&lang=es
   &fmt=json3
```

YouTube 检测到没 PO Token，**软失败**——不返回 403，而是返回看起来"成功"的 75B 空壳，骗爬虫脚本以为字幕真没有。

## 西语助手怎么绕过去

它**完全不自己 fetch**，而是 hook YouTube 自家的 `fetch` / `XMLHttpRequest`，**拦截 YouTube player 自己的 timedtext 响应**（那时 PO Token 已经被 player 算好贴在 URL 上了），把响应 body 偷过来用。

PM 验证了这点：用户截图里能看到 `youtube.js` 发起的 timedtext xhr 请求，body 是完整字幕（432B+），证明 YouTube player 本身能拿到。我们要做的就是"截胡"这些响应。

---

## 修复方案

**整体策略换掉**：放弃"自己 fetch baseUrl"路径，改为"主世界 hook + 拦截"。

### 1. 改 `extension/harvest.js`

删除现有的 `ingestTrack(videoId, track)` 中所有自己 fetch YouTube timedtext 的代码（`fetch(track.baseUrl + "&fmt=json3", {credentials: "include"})` 那一坨）。

新逻辑：

- 不再读 `captionTracks` 用来 fetch（仅保留检测"有没有西语轨"用，避免在没字幕的视频上白拦截）
- 通过 service worker 用 `chrome.scripting.executeScript` 在 main world 注入一段 hook 代码（见步骤 2）
- 监听从 hook 来的 `window.postMessage`（type `esponal-captured-timedtext`），拿到 `{ url, body }` payload
- 解析 url querystring 的 `lang` 参数确认是 es-* 后，调 `parseJson3ToCues(JSON.parse(body))`
- 走原来 POST 到 `/api/subtitle/ingest` 的路径不变（含 token、written 检查、badge、`chrome.storage.local`）

### 2. 新增 hook 脚本 `extension/hook-timedtext.js`

主世界注入（通过 service worker 的 `chrome.scripting.executeScript` 调用，`world: "MAIN"`）。

```js
(() => {
  if (window.__esponalHookInstalled) return;
  window.__esponalHookInstalled = true;

  const TIMEDTEXT_RE = /\/api\/timedtext\?/;

  const postCaptured = (url, body) => {
    window.postMessage(
      { type: "esponal-captured-timedtext", url, body },
      window.origin
    );
  };

  // Hook window.fetch
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const response = await origFetch.call(this, input, init);
    try {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (TIMEDTEXT_RE.test(url) && response.ok) {
        // clone so the player still gets the original body
        response.clone().text().then((body) => {
          if (body && body.length > 200) postCaptured(url, body);
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  // Hook XMLHttpRequest
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
        if (this.status >= 200 && this.status < 300) {
          const body = this.responseText;
          if (body && body.length > 200) postCaptured(url, body);
        }
      });
    }
    return origSend.apply(this, args);
  };
})();
```

`body.length > 200` 是经验阈值——75B 那种空壳被排除，真字幕通常上 kB。

### 3. service worker 修改 `extension/background.js`

新增 `esponal-install-hook` 消息处理：

```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "esponal-install-hook" && sender.tab?.id) {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: "MAIN",
      files: ["hook-timedtext.js"]
    }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
  // ... 现有 esponal-get-player-tracks 和 subtitle-harvested 处理保留
});
```

### 4. content script 监听 hook 来的 postMessage

`harvest.js` 在 `startHarvest()` 开头加一段：

```js
chrome.runtime.sendMessage({ type: "esponal-install-hook" });

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "esponal-captured-timedtext") return;
  handleCapturedTimedtext(event.data.url, event.data.body);
});

async function handleCapturedTimedtext(url, body) {
  const videoId = getVideoId();
  if (!videoId || window.__esponalIngested?.has(videoId + url)) return;
  (window.__esponalIngested ||= new Set()).add(videoId + url);

  const urlParams = new URL(url, location.origin).searchParams;
  const lang = normalizeLang(urlParams.get("lang") ?? "");
  if (!lang.startsWith("es")) return;

  let cues;
  try {
    cues = parseJson3ToCues(JSON.parse(body));
  } catch {
    return;
  }
  if (cues.length < MIN_HARVEST_CUES) return;

  // ... 原 POST /api/subtitle/ingest 的代码，不变
}
```

去重用 `videoId + url` 因为同一视频可能多次触发同一 URL，但 url 完全相同时是 byte-identical 重复。

### 5. 更新 `extension/manifest.json`

确保 `web_accessible_resources` 或类似允许 hook-timedtext.js 被注入：

```json
"web_accessible_resources": [
  {
    "resources": ["hook-timedtext.js"],
    "matches": ["https://www.youtube.com/*"]
  }
]
```

`content_scripts` 注册不变（harvest.js 仍是 isolated world）。

### 6. 删除现已无用的代码

`harvest.js` 中：
- `getPlayerCaptionTracks()` 可以保留（用来快速判断"这视频有没有西语轨"，没的话直接 return 不装 hook）；但**不要**再用来构造 fetch URL
- `ingestTrack()` 不需要了，逻辑融合进 `handleCapturedTimedtext`

`background.js` 中 `esponal-get-player-tracks` 处理可保留（harvest.js 仍可能查"有没有 es 轨"）。

### 7. esbuild 入口更新

`extension/scripts/build.mjs` 的 `entryPoints` 加入 hook 脚本：

```js
entryPoints: {
  harvest: harvestEntry,
  "esponal-site": esponalSiteEntry,
  "hook-timedtext": path.join(extensionRoot, "hook-timedtext.js")
}
```

虽然 hook 脚本本身不需要打包（没 import），但走 esbuild 保持产物路径一致（`dist/hook-timedtext.js`），manifest 引用更整齐。如果不走 esbuild，确保 `extension/scripts/package.mjs` 把它包进 zip。

---

## 验收标准（**绝不接受光跑 npm test 就 PASS**）

| # | 检查项 |
|---|--------|
| 1 | `extension/hook-timedtext.js` 存在，含 fetch 和 XHR 双 hook |
| 2 | `extension/background.js` 含 `esponal-install-hook` 消息处理 + `chrome.scripting.executeScript` with `world: "MAIN"` 调用 |
| 3 | `extension/harvest.js` 含 `esponal-captured-timedtext` postMessage 监听 + `handleCapturedTimedtext` 处理函数 |
| 4 | `extension/harvest.js` **不再**含 `fetch(track.baseUrl` 这类自己拉字幕的代码 |
| 5 | `extension/manifest.json` 含 `web_accessible_resources` 暴露 `hook-timedtext.js`（或编译后的 `dist/hook-timedtext.js`）给 youtube.com |
| 6 | `extension/scripts/package.mjs` 打的 zip 含 `dist/hook-timedtext.js` 或 `hook-timedtext.js` |
| 7 | `npm test` 通过（结构层） |
| 8 | `npm run build` 通过 |
| 9 | **真装到 Chrome 端到端测**：build extension with PM 的 `ESPONAL_APP_ORIGIN=https://esponalsssssss.vercel.app` 和 `EXT_INGEST_TOKEN=kskblzdjdwczkbl28929282`；安装后打开 `https://www.youtube.com/watch?v=1A9kpjdYJUg`；DevTools Network 应看到对 `esponalsssssss.vercel.app/api/subtitle/ingest` 的 POST 请求**状态 200**；Response 含 `{success: true, written: true, cueCount: N (N>10)}`；扩展图标右下角出现绿 ✓ 3 秒 |

第 9 条是硬性要求。**Codex2 QA 时也必须真装真测**，不能只跑契约测试。如果环境不允许真装，必须在 evidence 字段明确写出"未做端到端测试"作为风险声明。

---

## 不在本票范围

- 反向修改 EXT-008 的 ticket 历史描述（保留以追溯方案演化）
- 优化 hook 性能（XHR/fetch 都监听一遍开销小，无需优化）
- 多语言扩展（仍只采 es-*）
- 西语助手等其他扩展可能也 hook 了 fetch 导致冲突——本票不处理（如果实测发现冲突再开新票）

---

## 文件触动清单

| 文件 | 变更 |
|------|------|
| `extension/hook-timedtext.js` | **新建** |
| `extension/harvest.js` | 重写 `ingestTrack` 流程为 hook-based |
| `extension/background.js` | 新增 `esponal-install-hook` 消息处理 |
| `extension/manifest.json` | 新增 `web_accessible_resources` |
| `extension/scripts/build.mjs` | 新增 hook-timedtext 入口 |
| `extension/scripts/package.mjs` | 确保 zip 含 hook-timedtext.js |
| `tests/ext008.test.mjs` | 加新契约：hook 文件存在、harvest.js 不含旧 fetch 模式 |
| `feature_list.json` | 不新增条目（这是 FIX），EXT-008 status 退回 `in_progress` |
| `session-handoff.md` | Dev Report + 必须包含端到端测试证据截图描述 |
