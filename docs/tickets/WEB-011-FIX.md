# WEB-011-FIX — EmptyState UI 验收 P1 回修

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-16
**触发**：Claude2 对 WEB-011 的 UI 视觉验收（2026-05-16）
**关联**：WEB-011 ✅ 结构通过 / 视觉有条件通过

---

## 背景

WEB-011 的 `EmptyState` 组件和 6 处迁移结构完整、token 合规、文案语气一致。Claude2 UI 验收发现两处 P1 视觉问题需回修才能正式关闭。两项 P2 不在本票（留给下一轮 polish）。

---

## P1-1：TranscriptPanel 错用 `kind="error"`

### 问题
当前 TranscriptPanel 在视频无字幕时渲染：
```tsx
<EmptyState
  description="Esponal 只能在有字幕的视频上工作"
  kind="error"
  title="这个视频暂时没有字幕"
/>
```

`kind="error"` 触发橙色叹号警告图标，但「视频没字幕」是中性常态（很多 YouTube 视频本来就没字幕），不是系统异常。橙色警告会让用户误以为出错。

### 改法
```tsx
<EmptyState
  description="Esponal 只能在有字幕的视频上工作"
  kind="empty"
  title="这个视频没有字幕"
/>
```

两处改动：
1. `kind="error"` → `kind="empty"`
2. title 去掉「暂时」二字（避免暗示稍后会有字幕，与实际不符）

文件：`src/app/watch/TranscriptPanel.tsx`

---

## P1-2：EmptyIcon 三档 strokeWidth 不一致

### 问题
`src/app/components/ui/EmptyState.tsx` 的三个 SVG 图标 strokeWidth 各不相同：
- `kind="empty"`：strokeWidth="3"
- `kind="error"`：strokeWidth="5"（部分 7）
- `kind="loading-failed"`：strokeWidth="5"

三个图标在不同页面切换时视觉重量差异明显，破坏组件一致性。

### 改法
统一所有 SVG 描边为 `strokeWidth="3"`。包括 error 图标里那个 `strokeWidth="7"` 的感叹号点也降到 `3`（如果点变得太小，可用 `<circle cx="48" cy="68" r="3" fill="currentColor" />` 替代）。

文件：`src/app/components/ui/EmptyState.tsx`，约 33-67 行。

---

## 文件清单

**修改**：
- `src/app/watch/TranscriptPanel.tsx`（一处 EmptyState props 改两字段）
- `src/app/components/ui/EmptyState.tsx`（三个 SVG 描边统一）

**测试**：本票无需新增测试，跑现有 `tests/web011.test.mjs` 通过即可。

---

## 验收（Claude2）

1. `npm test` 通过
2. `npm run build` 通过
3. TranscriptPanel 在无字幕视频上渲染灰色书本图标（非橙色叹号）+ 文案「这个视频没有字幕」
4. EmptyState 三个 kind 描边粗细一致

---

## 不在本票

- **P2-1**：empty icon viewBox 比例（128×96 vs 96×96）适配 → 留下轮 polish
- **P2-2**：LookupCard 内 EmptyState 视觉过重，需要 xs size 变体 → 留下轮 polish
