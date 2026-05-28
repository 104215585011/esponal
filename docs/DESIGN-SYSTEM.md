# Esponal 设计系统

> 整理：2026-05-28（NAV-001 / LECTURA-002 / WATCH-002 三连重构完成后）
> 维护：Claude1（PM）+ Gemini1（UI 设计师）
> 相关文档：[`UI-DESIGN-CONSTRAINTS.md`](./UI-DESIGN-CONSTRAINTS.md)（禁区清单）

---

## 0 设计语言定位

**一句话**：温暖、克制的现代学习工具，向 Apple 与高质量编辑出版物借鉴，避开主流语言 App 的游戏化语言。

**关键决策**：
- **不暗色优先**——Light 模式是默认体验，Dark 模式是优雅备选，二者都需打磨
- **不游戏化**——任何打卡、XP、进度环都进入禁区清单
- **中文母语者第一**——文案中文优先，西语作为学习目标语言出现
- **玻璃质感而非扁平**——通过 `backdrop-blur` 制造空间层次，不堆砌阴影

---

## 1 设计 Token

所有 Token 定义在 `tailwind.config.ts`，**禁止在组件里写死颜色十六进制**。

### 1.1 配色

#### 品牌主色（emerald）

| Token | 值 | 用途 |
|---|---|---|
| `brand-50` | `#ecfdf5` | 浅色背景标签 |
| `brand-100` | `#d1fae5` | 标签底色 |
| `brand-500` | `#10b981` | **主操作 / Logo / 链接 hover** |
| `brand-600` | `#059669` | 按钮 hover 加深 |
| `brand-700` | `#047857` | 深色 mode 中的强调 |

#### 中性色（直接用 Tailwind `zinc-*`，不要用 `slate` / `gray`）

| 用途 | Light | Dark |
|---|---|---|
| 主体文字 | `text-zinc-900` | `dark:text-zinc-50` |
| 次级文字 | `text-zinc-700` | `dark:text-zinc-300` |
| 辅助文字 | `text-zinc-500` | `dark:text-zinc-400` |
| 极淡文字 | `text-zinc-400` | `dark:text-zinc-500` |
| 边框 | `border-zinc-200/50` | `dark:border-zinc-800/50` |
| 分隔线 | `border-zinc-100` | `dark:border-zinc-900` |

#### 语义色

| Token | 值 | 用途 |
|---|---|---|
| `app` | `#F9FAFB` | 应用主背景（Light） |
| Dark app bg | `#09090B` | 应用主背景（Dark） |
| `surface` | `#FFFFFF` | 卡片白底 |
| `muted` | `#F3F4F6` | 弱化区块 |
| `brand-red` | `#c2413b` | 仅用于错误 / 警告 |
| `brand-gold` | `#f4b942` | 仅用于已完成 / 收藏标识 |

### 1.2 字体

`src/app/layout.tsx` 通过 `next/font/google` 加载：

| 字体 | CSS 变量 | utility | 用途 |
|---|---|---|---|
| Inter | `--font-inter` | `font-sans`（默认） | 正文 / UI 文字 |
| Outfit | `--font-outfit` | `font-display` | 大标题 / 数字 / Logo |

**字号阶梯**（不要发明新尺寸）：

```
text-xs    12px  辅助说明 / 标签
text-sm    14px  次要正文 / nav 链接
text-base  16px  默认正文
text-lg    18px  突出说明
text-xl    20px  小标题
text-2xl   24px  卡片标题
text-3xl   30px  区块标题
text-4xl   36px  Hero 副标题
text-5xl   48px  Hero 标题
text-6xl   60px  Hero 大标题
```

### 1.3 圆角

| Token | 值 | 用途 |
|---|---|---|
| `rounded-card` | 12px | 普通卡片 |
| `rounded-surface` | 16px | 较大面板 |
| `rounded-hero` | 24px | Hero / 主视觉容器 |
| `rounded-full` | 9999px | 按钮 / 标签 / 头像 |

**Tailwind 默认 `rounded-md` / `rounded-lg` / `rounded-xl` / `rounded-2xl` 都可用**，但优先用三个语义 token。

### 1.4 阴影

| Token | 用途 |
|---|---|
| `shadow-card` | 普通卡片静态 |
| `shadow-elevated` | 卡片 hover 抬升后 |
| `shadow-hero` | Hero 区主视觉 |

**禁止**在组件里写 `shadow-2xl` / `shadow-3xl` 这类未定义的预设。

### 1.5 容器宽度

| Token | 值 | 用途 |
|---|---|---|
| `max-w-app-shell` | 96rem (1536px) | 整站主容器最大宽度 |
| `max-w-7xl` | 80rem | 默认页面容器 |
| `max-w-3xl` | 48rem | 阅读类页面 |
| `max-w-prose` | 65ch | 长文阅读最佳宽度 |

---

## 2 核心 Utility Classes

定义在 `src/app/globals.css`，全站复用。

### 2.1 `.glass-card`

毛玻璃卡片，背景半透明 + `backdrop-blur(12px)`。

```jsx
<div className="glass-card rounded-card border border-zinc-200/50 dark:border-zinc-800/50 p-6">
  内容
</div>
```

- Light：`bg-white/70`
- Dark：`bg-zinc-900/70`
- 过渡：`all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`

### 2.2 `.glass-header`

比 `.glass-card` 模糊更强（16px），用于 sticky header。

```jsx
<header className="glass-header sticky top-0 z-40 border-b border-zinc-200/50 dark:border-zinc-800/50">
```

### 2.3 `.card-hover-lift`

卡片 hover 时上移 4px + emerald 微光 + border 染色。

```jsx
<div className="glass-card card-hover-lift rounded-card border border-zinc-200/50 p-6">
```

**只用在可点击的整卡链接上**。普通展示卡片不要用。

### 2.4 `.saved-word`

已收藏词在正文中的视觉标识——细虚线下划线，**不是删除线**。

```jsx
<span className="saved-word">hablar</span>
```

⚠️ 禁止给"已掌握"词加删除线（见禁区清单 §3）

### 2.5 `.animate-shimmer`

Loading 骨架屏的微光动画，1.6s 线性循环。

```jsx
<div className="animate-shimmer h-4 w-32 rounded" />
```

---

## 3 重复出现的 UI 模式

### 3.1 Sticky Glass Header

参考实现：`src/app/components/web/SiteHeader.tsx`

```
<header className="glass-header sticky top-0 z-40 border-b border-zinc-200/50 dark:border-zinc-800/50">
  <div className="max-w-app-shell mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
    Logo + 主导航 + 工具 + 用户菜单
  </div>
</header>
```

**约束**：
- 高度永远 `h-16` (64px)
- z-index `z-40`，移动抽屉 `z-50`，全屏覆盖层 `z-50`
- border-bottom 必须有，依赖玻璃效果时它是层次的关键

### 3.2 移动端抽屉

参考实现：`src/app/components/web/MobileNav.tsx`

- 触发：汉堡按钮
- 关闭：点击遮罩 / 点击导航项 / 按 ESC
- 宽度：`w-72` (288px)
- 滑入动画：`translate-x-full → 0`，`duration-300 ease-out`
- 遮罩：`bg-black/40 backdrop-blur-sm`

### 3.3 全局搜索覆盖层

参考实现：`src/app/components/web/GlobalSearchOverlay.tsx`

- 触发：搜索图标或 `Cmd/Ctrl + K`
- 关闭：ESC / 点击遮罩
- 居中容器：`max-w-2xl` 居中浮动

### 3.4 学习入口卡片

参考实现：`src/app/page.tsx` `LearningStepCard`

```jsx
<div className="group glass-card card-hover-lift min-w-0 flex-1 rounded-card border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 p-6 shadow-sm">
  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold font-display group-hover:scale-110 transition-transform">
    0{step}
  </div>
  <h3 className="mt-5 text-base font-semibold font-display text-zinc-800 dark:text-zinc-200">{title}</h3>
  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
</div>
```

### 3.5 LookupCard（查词卡）

参考实现：`src/app/watch/LookupCard.tsx`

桌面端：右侧 Dock 形态
移动端：底部抽屉形态
两种形态共享同一组件，通过 props 切换。

**自动 +1 encounter** 已经在 LookupCard 内部实现（VOCAB-012-FE），新增使用 LookupCard 的页面无需重复实现。

---

## 4 暗色模式规则

### 4.1 切换方式

通过 `<html className="dark">` 切换（`darkMode: "class"` 在 tailwind config）。
用户偏好存 localStorage，组件：`src/app/components/web/ThemeToggle.tsx`

### 4.2 文字色对应表

| Light | Dark | 用途 |
|---|---|---|
| `text-zinc-900` | `dark:text-zinc-50` | 主文字 |
| `text-zinc-700` | `dark:text-zinc-300` | 次文字 |
| `text-zinc-500` | `dark:text-zinc-400` | 辅助文字 |
| `text-brand-600` | `dark:text-brand-400` | 主操作色 |

### 4.3 暗色背景层次

Dark 模式不是简单"反色"，而是有自己的层次：

```
最底层 bg     #09090B  body
卡片层 surface #18181B  zinc-900
弱化层 muted   #27272A  zinc-800
```

暗色主页背景还叠了两个 radial-gradient（见 globals.css `.dark .bg-app`），制造氛围光。

### 4.4 暗色禁忌

- 不要纯白文字（用 `zinc-50` 不用 `white`）——避免灼眼
- 不要纯黑背景（用 `#09090B` 不用 `#000`）——保留材质感
- 边框透明度比 Light 模式更低（`/50` 而不是 `/100`）

---

## 5 图标体系

**全站统一使用 `lucide-react`**，不混用其他图标库。

```jsx
import { ArrowLeft, Play, BookOpen } from "lucide-react";

<ArrowLeft className="w-5 h-5" />
```

**尺寸阶梯**：
- `w-3.5 h-3.5` (14px) — 小标签内
- `w-4 h-4` (16px) — nav / 按钮内
- `w-5 h-5` (20px) — 默认
- `w-6 h-6` (24px) — 主操作按钮

---

## 6 动效原则

### 6.1 时长

| 场景 | duration | 缓动 |
|---|---|---|
| hover / focus | `duration-150` | `ease-out` |
| 卡片抬升 / hover lift | `duration-300` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 抽屉 / 弹层 | `duration-300` | `ease-out` |
| 大区块切换 | `duration-500` | `ease-in-out` |

### 6.2 不允许的动效

- ❌ 反弹（`ease-out-back` / spring）—— 显得幼稚
- ❌ 旋转入场（除非视觉刻意需要）
- ❌ confetti / 庆祝粒子（见禁区清单 §6）
- ❌ 自动循环呼吸 / 闪烁（除非用于 loading 状态）

### 6.3 允许的微动效

- ✅ `card-hover-lift` 抬升 4px
- ✅ 数字 / Logo 在 group-hover 时 `scale-110`
- ✅ `animate-shimmer` loading 微光
- ✅ ParticleBackground 粒子在 hero（首页独有）

---

## 7 文案规范

- 主体语言：**中文**
- 西语词出现时不加引号，斜体可选
- **不要**带感叹号的促销式文案（"立即开始！"、"快来学习！"）
- 错误提示用中文，避免出现英文 / 西文 stack trace 给用户看

---

## 8 设计审查 Checklist

每张 UI ticket 关闭前对照本清单：

- [ ] 颜色全部用 token，无写死 `#hex`
- [ ] 字号用预设阶梯，无随意 `text-[17px]`
- [ ] 圆角用三个 token（`card` / `surface` / `hero`）或 `full`
- [ ] 阴影用三个 token（`card` / `elevated` / `hero`）
- [ ] 暗色模式所有文字 / 边框 / 背景都有对应
- [ ] 图标全用 `lucide-react`
- [ ] 通过禁区清单七条核查
- [ ] 三种视口（375 / 768 / 1280）截图存档

---

## 9 未来扩展的边界

如果未来需要新增 token，先在此文档登记原因，再加进 `tailwind.config.ts`：

- 新增颜色：是不是已有色板（brand / zinc）能覆盖？
- 新增字体：是不是真的需要？衬线体（Playfair / EB Garamond）目前只在 `design-preview` 实验用，未进入生产
- 新增圆角 / 阴影：是不是已有 token 够用？

**保持设计语言收敛，不为新功能轻易扩张。**
