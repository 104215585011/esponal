# MOBILE-000 — 移动端地基：查词卡抽屉化 + 设计 Token + 导航打磨设计稿

本设计稿规范了 `LookupCard` 共享查词组件在移动端的底部抽屉（Bottom Sheet）形态、全站移动端设计 Token 规范以及 `MobileNav` 和 `SiteHeader` 的移动端体验打磨细节。此为移动端重构的“地基”，供 Codex1 直接实施。

---

## 1. 查词卡移动端形态：底部抽屉 (Bottom Sheet Drawer)

在桌面端，查词卡保持现有的绝对定位浮动卡片形态（或侧边 Dock 形态）。在移动端，当视口宽度小于 `768px` 时，查词卡应自动转化为从屏幕底部滑出的抽屉式卡片。

### 1.1 手机端底部抽屉 ASCII 布局 (Mobile Drawer Layout)

```text
+---------------------------------------------+
|                                             |
|              点击外部/背景关闭                 |
|                                             |
+---------------------------------------------+  <- 视口上部，可见原正文内容
|                                             |
|  +---------------------------------------+  |  <- 底部抽屉开始
|  |                ======                 |  |  <- 拖拽/关闭手柄 (Drag Handle)
|  |  [单词/短语]   [词性]          [🔊] [关闭] |  |  <- 头部 (Word, POS, Pronounce, Close)
|  |  /phonetic/                              |  |  <- 发音音标
|  |  变形/形态分析                             |  |  <- 变形信息
|  |  -------------------------------------  |  |  <- 分隔线
|  |  1. 释义 1                              |  |  <- 释义列表
|  |  2. 释义 2                              |  |  <- 滚动区域限制 max-h-[60vh]
|  |  [ 用法提示：这里有用法细节 ]            |  |  <- 用法卡片 (Usage Note)
|  |  +-----------------------------------+  |  |  <- 例句卡片
|  |  | "Es un buen ejemplo."         [🔊] |  |  |  <- 西语例句 (支持点词)
|  |  | "这是一个很好的例子。"                |  |  |  <- 中文翻译
|  |  +-----------------------------------+  |  |
|  |  相关搭配：                               |  |  <- 相关搭配列表 (LEX-003)
|  |  - hablar de (谈论)                     |  |  
|  |  -------------------------------------  |  |  <- 分隔线
|  |  [          保存至我的生词本          ]  |  |  <- 核心操作按钮 (Min-height 44px)
|  |  [       第 N 次遇到 · 已自动记录      ]  |  |  <- 自动遭遇次数徽章
|  |                                         |  |  <- 适配 iOS 底部安全区 (pb-safe)
|  +---------------------------------------+  |
+---------------------------------------------+
```

### 1.2 响应式架构设计与 TSX 骨架

为了避免在多个业务页面产生 clipping (元素被父级 `overflow: hidden` 截断) 风险，移动端抽屉应使用 **React Portal** 直接挂载至 `document.body`，同时维持与原有桌面端 Props 的 100% 兼容。

```jsx
import { createPortal } from "react-dom";

export function LookupCardStack({ cards, onCloseCard }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 1. 获取顶层卡片
  const activeCard = cards[cards.length - 1];
  
  if (!activeCard) return null;

  // 2. 移动端渲染分支 (通过 Tailwind md 断点进行条件呈现，或配合 window 匹配)
  if (mounted) {
    return (
      <>
        {/* 移动端 Portal 抽屉 */}
        <MobilePortalWrapper activeCard={activeCard} onClose={() => onCloseCard(activeCard.id)} />
        
        {/* 桌面端堆叠卡片 (md:block hidden) */}
        <div className="hidden md:block relative w-full min-h-[360px]">
          {/* 现有的桌面端 visibleCards 堆叠逻辑 */}
        </div>
      </>
    );
  }
  return null;
}
```

### 1.3 底部抽屉 TSX 骨架与 Tailwind 样式

```jsx
function MobilePortalWrapper({ activeCard, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      {/* 1. 半透明背景遮罩 Backdrop */}
      <div 
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ease-out" 
        onClick={onClose} 
      />

      {/* 2. 滑动抽屉容器 Drawer Panel */}
      <div 
        className="relative w-full max-h-[75vh] bg-white dark:bg-zinc-900 rounded-t-2xl shadow-hero flex flex-col transition-transform duration-300 ease-out translate-y-0 pb-[calc(env(safe-area-inset-bottom)+12px)] animate-slide-up"
      >
        {/* 3. 拖拽手柄指示器 Drag Handle */}
        <div 
          className="w-12 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto my-3 cursor-pointer shrink-0" 
          onClick={onClose}
        />

        {/* 4. 滚动内容区域 Scroll Container */}
        <div className="overflow-y-auto px-5 pb-4 space-y-4">
          <LookupCard 
            {...activeCard} 
            useStaticLayout={true} // 强行使用静态无定位布局，铺满抽屉
            onClose={onClose}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
```

---

## 2. 交互细节与状态联动

1. **查词时视频/朗读暂停**：
   - 移动端查词弹出底部抽屉时，现有的“点词暂停，关闭恢复”逻辑应无缝衔接。
   - 用户点击遮罩层、点击“关闭”按钮或点击拖拽手柄时，触发 `onClose` 进而恢复视频/朗读播放。
2. **手势关闭支持（可选/渐进增强）**：
   - 用户在抽屉容器上向下滑动（Swipe Down）可直接触发关闭。
3. **安全区域保护**：
   - 抽屉底部内边距必须使用 `pb-[calc(env(safe-area-inset-bottom)+12px)]`，确保在无边框手机（如 iPhone）上，操作按钮不被系统 Home Indicator 条遮挡或干扰。

---

## 3. 全站移动端设计 Token 规范 (Mobile Token Spec)

为保障手指操作的顺畅性，移动端的所有 UI 组件必须遵循以下 Token 阶梯：

### 3.1 触摸目标 (Touch Targets)

* **核心操作目标**：所有可点按元素（按钮、导航链接、切换 Tabs、词表栏目）的物理点击范围**必须 $\ge 44\text{px} \times 44\text{px}$**。
* **实现方式**：文字较小时，必须通过补白（如 `py-2.5 px-4` 或 `min-h-[44px]`）拉大触摸边界，而不仅是视觉尺寸。

### 3.2 移动端排版 Token (Mobile Typography)

为防止小屏下文本溢出及保持阅读舒适度，字号和行高在小屏幕下微调：

| Token | 小屏大小 (Mobile) | 桌面大小 (Desktop) | 用途 |
|---|---|---|---|
| `text-page-title` | `text-xl leading-7` | `text-2xl leading-8` | 移动端页面主标题 |
| `text-card-title` | `text-base leading-6` | `text-lg leading-7` | 查词卡单词/卡片标题 |
| `text-body` | `text-sm leading-6` | `text-base leading-relaxed` | 释义、例句与正文 |
| `text-helper` | `text-xs leading-5` | `text-sm leading-normal` | 时间戳、变位辅助等 |

### 3.3 布局与安全区 Token (Mobile Spacing)

* **屏幕左右内边距**：移动端容器统一使用 `px-4`（16px）或 `px-5`（20px），不使用桌面端的 `px-8`。
* **底部安全区适配**：
  * 底部固定浮动元素（如 TabBar、底部操作栏）：使用 `pb-safe` 或者是 `pb-[env(safe-area-inset-bottom)]`。
  * 滚动页面的底部 Padding：追加 `pb-24`，保证滚到底部时内容能完全呈现在安全区内。

---

## 4. 导航与顶栏移动端打磨 (`MobileNav.tsx` / `SiteHeader.tsx`)

### 4.1 SiteHeader 移动端表现规范

* 保持 `h-16` 高度，两侧为 **左Logo/右汉堡菜单**。
* 桌面端全局搜索框及普通链接应在移动端隐藏，搜索图标收进 Header 右侧作为二级按钮（点击唤起 SearchOverlay）。
* 汉堡菜单触摸区域设置在 `w-11 h-11`，内部使用标准的 Lucide `Menu` 图标。

### 4.2 MobileNav 移动端抽屉精化

* 宽度定为 `w-72` (288px)，位于屏幕右侧。
* 弹出过渡：`translate-x-full` 到 `translate-x-0`，动画持续 `duration-300`，配合 `ease-out`。
* 抽屉遮罩层使用 `bg-black/35 backdrop-blur-[1px]`，增强层次感。
* 抽屉内部菜单项字体设置为 `text-base font-semibold text-zinc-800 dark:text-zinc-200 py-3.5 px-6`，垂直触摸间距完全满足大于 `44px` 规范。

---

## 5. UI 设计审查核对表 (MOBILE-000 Checklist)

* [ ] **双端不干涉**：桌面端 `LookupCard` 维持浮动卡片或 Dock 状态（无回退）；移动端渲染为完整的底部抽屉 Portal。
* [ ] **触控区域安全**：查词卡底部“加入生词本”及 Mobile 导航栏所有按钮的点击响应高度 $\ge 44\text{px}$。
* [ ] **安全适配**：抽屉面板在 iOS Safari/微信浏览器中拉起时，底部完全避让 Home 指示线。
* [ ] **关闭体验顺畅**：点击遮罩层、右上角关闭字样或向下滑动，均能正常关闭抽屉并恢复音频/视频播放。
* [ ] **暗色模式完好**：抽屉在暗色模式下背景色为 `#18181b`，文字对比度良好，分界线分明。
