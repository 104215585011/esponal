# 视频播放页（/watch）设计规格

> 用途：照此在 Figma 重建为可编辑元素（配合 `html.to.design` 插件抓取实时页面更佳）。
> 来源：从代码提取（`tailwind.config.ts` / `globals.css` / `WatchClient` / `SubtitlePanel` / `TranscriptPanel`），2026-05-30。
> 字号/间距单位均为 px（Tailwind 1 = 4px）。

---

## 1. 全局 Design Tokens

### 字体
| 用途 | 字体 | 说明 |
|---|---|---|
| 正文 / 字幕 | **Inter**（300/400/500）| `font-sans` |
| 标题 / UI 标签 | **Outfit** | `font-display` |

### 配色（品牌绿系）
| Token | Hex | 用途 |
|---|---|---|
| brand-50 | `#ecfdf5` | 激活行极淡底 |
| brand-400 | `#34d399` | 暗色模式强调字 |
| brand-500 | `#10b981` | 主品牌色 / spinner |
| brand-600 | `#059669` | 激活字 / 绿色左条 / 已学词 |
| brand-700 | `#047857` | |
| brand-ink | `#1f2933` | 正文深色 |
| brand-gold | `#f4b942` | 固定搭配高亮（琥珀系）|
| brand-red | `#c2413b` | 警示 |

### 中性色
| Token | Light | Dark |
|---|---|---|
| 页面底 app | `#FAF9F6`（暖白）| `#09090B` |
| 卡面 surface | `#FFFFFF` | `#18181B` |
| muted | `#F3F4F6` | `#27272A` |
| 正文 | `#1f2933` (zinc-800) | `#f4f4f5` |
| 次要文字 | zinc-400/500 | zinc-400/500 |
| 边框 | gray-100 / zinc-200 | zinc-800 |

### 圆角 / 阴影
| 圆角 | 值 |   | 阴影 | 值 |
|---|---|---|---|---|
| card | 12px |   | card | `0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.06)` |
| surface | 16px |   | elevated | `0 4px 12px rgba(0,0,0,.07), 0 8px 24px rgba(0,0,0,.08)` |
| hero | 24px |   | hero | `0 4px 6px -1px rgba(0,0,0,.07), 0 24px 60px -8px rgba(0,0,0,.12)` |

毛玻璃：`backdrop-blur 12–16px` + 半透明底（header `rgba(255,255,255,.75)`）。

---

## 2. 页面布局

- 最大宽度容器 `app-shell = 96rem (1536px)`，水平居中。
- 桌面：**左主区（视频 + 同步框 + 标题/章节）** ｜ **右栏 transcript（约 37vw 宽，固定高滚动）**。
- 顶部固定毛玻璃导航条。

---

## 3. 顶部导航 Header
- 毛玻璃白底（`rgba(255,255,255,.75)` + blur 16px），底部 1px 边框 gray-100。
- 左：Logo「Esponal」(Outfit, 加粗)。
- 中：导航项（首页/字母/视频/课程/阅读/对话/语法/拆解/词库），当前项绿色下划线（brand-500），字号 ~14px。
- 右：搜索框（圆角、浅灰底）、语速下拉、主题切换、头像圆形。

---

## 4. 视频播放器（左主区）
- 16:9 视频帧，圆角 `surface(16px)`，`shadow-elevated`。
- 播放器内底部叠 YouTube 原生 CC（半透明黑底白字）。

---

## 5. 视频下方「同步字幕框」(SubtitlePanel)
当前句的对照显示框。
- 容器：`min-height 120px`，flex 垂直居中，圆角 **16px(surface)**，边框 `1px zinc-200/80`，底 `rgba(255,255,255,.7)` + blur，`shadow-sm`，内边距 **24px(p-6)**。
- 西语行：居中，字号约 **18–20px**，深色 zinc-800；可点词。
- 中文译文：居中，次要灰 zinc-500，字号 ~14px，行下方。
- 无台词态：居中斜体灰字「(无台词)」(zinc-400, italic, 14px)。
- 加载态：脉冲斜体「（字幕加载中…）」。
- 右上角齿轮设置按钮：32×32 圆形，hover 浅灰底。

---

## 6. 右栏逐字稿 Transcript Panel（截图重点）

### 6.1 栏头
- 一行：左侧三段式 **Tab 胶囊**（圆角全圆 `bg-gray-150/70`，内距 2px，字号 **11px** 加粗，灰字）：`ES + 中` / `仅西语` / `仅中文`，选中项白底。
- 右侧：「点击字幕跳转」提示，**11.5px**，zinc-400。
- 栏头底部 1px 分隔线 gray-100；内距 `px-20 py-16`(px-5 py-4)。

### 6.2 字幕行卡片（核心可复用元素）
每条字幕一张可点的行卡，结构：左侧 3px 竖条 + 西语行 + 中文译文。

| 状态 | 左竖条 | 西语文字 | 中文译文 | 底色 |
|---|---|---|---|---|
| **激活（当前句）** | `3px` 实心 **brand-600 `#059669`** | **加粗 brand-600**，15px | zinc-500，13px，medium | 极淡绿 `brand-50/10` |
| 普通 | 3px 透明 | medium zinc-800，15px | zinc-400，13px | 无 |

- 西语行：字号 **15px**，行高 28px(leading-7)，字距 0.05px，`font-sans`。
- 中文译文：字号 **13px**，行高 24px，距西语行上方 6px(mt-1.5)。
- 整卡可点（点击跳转到该时间）。

### 6.3 词级高亮（西语词）
逐词可点，三种态：
- **普通词**：hover 时 `bg-zinc-100` + 圆角 2px + 内距 2px。
- **已学课程词(course)**：绿色字 **brand-600 `#059669`**（暗色 brand-400）。
- **已收藏词(saved)**：**点状下划线**（dotted, 1px, zinc-450）。
- **固定搭配/短语**：琥珀系底高亮（brand-gold `#f4b942` 家族，淡底）——见截图「tengo que / Voy a / a la」。

### 6.4 自动跟随回钮
- 用户手动滚动后出现的浮动按钮：右下角固定，全圆角，白底 + 1px zinc-200 边框，`px-16 py-8`，字号 12px 加粗，绿字 brand-600，`shadow-md`。

---

## 7. 标题区（视频下方）
- 「A1 入门级」徽章：淡绿底圆角小标签（brand-50 底 / brand-700 字）。
- 视频标题：Outfit，加粗，~18–20px，深色。
- 频道行：圆形频道角标(ES) + 频道名 zinc-500；右侧「刷新字幕」「登录 YouTube」描边小按钮。

## 8. 章节列表
- 「章节」标题（小灰标签）。
- 每行：时间码（zinc-400, 等宽感）+ 中文章节标题，行距舒展。

---

## 9. 暗色模式要点
- 页面底 `#09090B`（带极淡绿/蓝径向光晕）；卡面 `#18181B`；muted `#27272A`。
- 文字主色 `#f4f4f5`；边框 zinc-800；激活绿字转 brand-400。

---

## 重建建议
1. 先在 Figma 建 **Color Styles**（上面 brand + 中性色）和 **Text Styles**（Inter/Outfit × 11/13/15/18px）。
2. 把「字幕行卡片」做成 **Component**，激活/普通用 Variant；词高亮用 Boolean 属性（course/saved/phrase）。
3. 右栏整体做成 Auto-layout（垂直，行间距 0，卡片内 padding 用上面的值）。
4. 配合 `html.to.design` 抓实时页面，再用本 spec 校准 token 命名与状态，效率最高。
