# WATCH-005 — 禁用 YouTube 原生字幕自动加载 UI 设计稿

本设计稿规定了 `WatchClient.tsx` 中嵌入的 YouTube 播放器的 URL 参数调整细节，以解决自定义悬浮字幕与原生字幕重叠的冲突。

---

## 1. 播放器嵌入配置调整

定位到 `src/app/watch/WatchClient.tsx` 中的 `iframe` 元素：

### 1.1 修改前 (Current)

```jsx
<iframe
  allow="autoplay; encrypted-media; fullscreen"
  allowFullScreen
  className="h-full w-full border-0"
  id={PLAYER_IFRAME_ID}
  src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&fs=0&cc_load_policy=1&hl=es&cc_lang_pref=es`}
  title={videoInfo.title}
/>
```

### 1.2 修改后 (Target Spec)

修改嵌入参数，将 `cc_load_policy=1` 改为 `cc_load_policy=0` 并移除字幕语言强制偏好 `&hl=es&cc_lang_pref=es`，从而阻止 YouTube 默认加载并显示原生字幕轨道：

```jsx
<iframe
  allow="autoplay; encrypted-media; fullscreen"
  allowFullScreen
  className="h-full w-full border-0"
  id={PLAYER_IFRAME_ID}
  src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&fs=0&cc_load_policy=0`}
  title={videoInfo.title}
/>
```

---

## 2. 界面排版验收点

- **无原文字幕干扰**：播放带有原生/自动生成字幕的 YouTube 视频时，视频画面底部应当保持清爽，YouTube 播放器自身的字幕默认处于隐藏状态。
- **自定义悬浮字幕**：我们的自定义双语字幕（`SubtitlePanel`）依然正常在画面下缘（非全屏模式）或播放器内侧（全屏模式）悬浮显示，两者互不重叠。
