# TALK-005 — 修复 LookupCard 在 talk 页面左边被裁

**优先级**：P1（点查词功能被破坏，影响 TALK-001 的视觉验收）
**区域**：talk / web / bugfix
**依赖**：TALK-001 ✅、TALK-002（page.tsx 改了整页 flex 后才暴露的）

---

## 背景

PM 截图 reproduce 路径：

1. `/talk/carlos?session=cmph7vhyn0001s8sfyd5vutsv` 已有一条 AI 回复
2. 点击 AI 气泡里的西语词（如 "Dime"）
3. **现象**：LookupCard 弹出，**左半部分被视口左边裁掉**，只能看到右侧约 1/2 内容（"关闭" 按钮可见，前半截内容看不到）

## 怀疑原因

TALK-002 重构 `page.tsx` 后，整页变成 `flex` 左 260px 侧栏 + 右 `mx-auto max-w-3xl` 消息流。
`LookupCard` 用 `position: fixed` + 计算 `left = Math.min(anchorX, window.innerWidth - 340)`
（见 `src/app/talk/[characterId]/TalkClient.tsx`，搜索 `activeLookup.anchorX`）。

`anchorX = rect.left` 是 **viewport 坐标**，理论上 ≥ 0。
但当被点的词靠近气泡左边、气泡又靠近消息流左边（消息流被 sidebar 推到 viewport 中后部）时，
`rect.left` 仍是几百 px——不该负数。

可能真实原因：
- 卡片内容内部有 `width: 320` 或 `min-width`，但容器实际只能放下 < 320 → 内容溢出到 left negative
- 或者父容器有 `overflow: hidden` 截掉了卡片左缘
- 或者 left 计算应该用 `Math.max(8, Math.min(anchorX, window.innerWidth - 340))`——下界没夹

## 范围

### 做

1. **复现 + 定位**：开发模式打开 `/talk/carlos`，点不同位置的词，看 DevTools 里 LookupCard 的 `left` 值和 `getBoundingClientRect` 实际位置
2. **修 left 边界**：保证 `left ≥ 8`（视口左边留 8px 间距）
3. **修 right 边界**：现有 `Math.min(anchorX, window.innerWidth - 340)` 在窄屏（侧栏 + max-w-3xl + 卡片）下要重新验算
4. **关键约束**：sidebar 264px 不要被卡片覆盖。卡片可以从右往左展开避开 sidebar（如果 anchorX 比侧栏右边界还小，强制 left = sidebar 右边界 + 8）
5. **同步检查 `/lectura` 不受影响**——那边没 sidebar，逻辑不要回归坏

### 不做

- ❌ 重做 LookupCard 设计——只修位置算法
- ❌ 改卡片宽度（320px 是设计共识）

## 验收

- [ ] `/talk/carlos` 点最左边的词 → 卡片左边距 viewport ≥ 8px
- [ ] 点最右边的词 → 卡片右边距 viewport ≥ 8px
- [ ] 窄屏（lg 以下，无 sidebar）也不被裁
- [ ] 移动端（< lg，sidebar 是 80vw 抽屉关闭态）正常
- [ ] `/lectura` 点词功能不回归
- [ ] 200/210 测试通过（不应该影响测试）

## 技术草图

```ts
// 当前：只夹右边
const left = Math.min(activeLookup.anchorX, window.innerWidth - 340);

// 改成：上下界都夹，并避开 sidebar
const SIDEBAR_W_LG = 260;
const CARD_W = 320;
const PADDING = 8;
const isLg = window.innerWidth >= 1024;
const minLeft = isLg ? SIDEBAR_W_LG + PADDING : PADDING;
const maxLeft = window.innerWidth - CARD_W - PADDING;
const left = Math.max(minLeft, Math.min(activeLookup.anchorX, maxLeft));
```

## 成本估计

**2-4 小时**（复现 + 修算法 + 回归 `/lectura` 不坏 + 加一条测试覆盖 left 下界）
