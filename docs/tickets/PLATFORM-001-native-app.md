# PLATFORM-001 — 原生 App 架构方案(Expo / React Native)【决策票】

> 2026-11-13 · PM 与用户对齐 · 前置票:`PLATFORM-000`(隔离与 Play 上架)、`MOBILE-R2-epic`(移动 Web 重构)
> 背景:用户明确诉求「要正式的软件,不要借用 web 端的套壳,因为 web 端始终无法占满屏幕」,目标平台 **Android + iOS 双端**。
> 本票结论会推翻 `PLATFORM-000` 里「Capacitor 套壳」的一期方案,但**保留其"后端零分叉"的核心原则**。

---

## 一、结论(四句话)

1. **选 Expo(React Native),不选纯原生双端** —— 双端 + 单人 + 现有 TypeScript 资产,Expo 是唯一现实解;纯原生 Swift+Kotlin 需要两套代码、8-14 个月,不可行。
2. **Web 不停、后端不分叉** —— Web 与 App 共用同一套 API、同一个 Neon 数据库、同一套账号。前端两套,后端一套。
3. **除视频画面外全部真原生** —— 视频必须走 YouTube iframe(平台规则限制,见第五节),但字幕、查词、生词、复习、阅读、AI 对话、导入全部是原生控件,不做 WebView。
4. **先补 API 再做 UI** —— 11 个页面直接查库,原生拿不到,必须先抽接口;这一步对现有 Web 也有收益(可缓存、可复用)。

---

## 二、方案对比:为什么不是纯原生,也不是 Capacitor

| 维度 | A. Capacitor 套壳 | **B. Expo / RN(选定)** | C. 纯原生 Swift+Kotlin |
|---|---|---|---|
| 渲染 | WebView 渲染网页 | **原生控件**(UIView / ViewGroup) | 原生控件 |
| 代码复用 | 100% | ~35%(类型、API 封装、数据结构) | ≈0 |
| 双端成本 | 1 份 | **1 份** | **2 份** |
| 到可用版本 | 2-3 周 | **3-4 个月** | 8-14 个月 |
| 屏幕利用率 | 受浏览器 chrome 限制 | **完全可控**(安全区利用、系统手势、键盘) | 完全可控 |
| Play 审核 | 易被判「仅网页」拒绝 | **通过**(有原生功能) | 通过 |
| 维护成本 | 低(跟 Web 同步) | 中(UI 双份,逻辑复用) | 高(三份) |
| 用户核心诉求 | ❌ 仍是套壳 | ✅ 正式 App | ✅ 但做不完 |

**用户明确排除 A。C 因人力不可行被排除。选 B。**

> RN 的边界要说清楚:RN 渲染的是原生控件,但它由 JS 线程驱动,复杂动画/超大列表不如纯原生丝滑。对「视频 + 文本列表 + 表单」这类场景,RN 完全够用——这也是 Instagram、Shopify、Discord 的生产选择。

---

## 三、目标架构

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Web (Next.js) │   │ App (Expo/RN)   │   │  未来:平板/桌面  │
│   浏览器          │   │  Android + iOS  │   │                 │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         │  cookie session     │  Bearer JWT         │
         └──────────┬──────────┴─────────────────────┘
                    ▼
        ┌───────────────────────────┐
        │  API 层 (Next.js Route)    │  47 个现有路由 + P0 新增 5-6 个
        │  统一鉴权: cookie | Bearer │  ← 本次要改的关键点
        └───────────┬───────────────┘
                    ▼
        ┌───────────────────────────┐
        │  Prisma → Neon Postgres   │  15 个模型,零改动
        │  Upstash Redis(限流/缓存)│
        └───────────────────────────┘
```

**三条硬原则**

1. **后端零分叉** —— 不新建 BFF、不复制业务逻辑。App 调的就是现有 `/api/*`。
2. **Web 不降级** —— 任何为 App 做的改动,不能让 Web 变差。API 化反而让 Web 更快。
3. **先契约后 UI** —— 每个屏开始做之前,它的 API 必须先用 curl 跑通并写进契约表。

---

## 四、鉴权方案(最关键的改造点)

### 现状
- NextAuth v4,`strategy: "jwt"`,会话存在 **HttpOnly cookie**。
- 47 个 API 路由全部用 `getServerSession(getAuthOptions())` 取用户。
- **原生 App 没有 cookie**,直接调会全部 401。

### 方案:同一套 JWT,cookie 与 Bearer 双通道

不动 NextAuth 配置,只在 API 侧统一入口。**核心思路:App 端拿到的 token 就是 NextAuth 自己签发的 JWT**,服务端用同一个 `NEXTAUTH_SECRET` 解开,身份体系完全统一,不引入第二套账号系统。

**新增接口**

| 接口 | 方法 | 作用 |
|---|---|---|
| `/api/mobile/auth/login` | POST | email + password → `{ accessToken, refreshToken, user }` |
| `/api/mobile/auth/refresh` | POST | refreshToken → 新 accessToken |
| `/api/mobile/auth/logout` | POST | 吊销 refreshToken |

`login` 内部复用现有 credentials 校验逻辑(不重写密码校验),成功后:

```ts
// src/app/api/mobile/auth/login/route.ts
import { encode } from "next-auth/jwt";

const accessToken = await encode({
  token: { sub: user.id, id: user.id, email: user.email, name: user.name },
  secret: process.env.NEXTAUTH_SECRET!,
  maxAge: 60 * 15          // 15 分钟
});
```

**统一鉴权 helper(替换 47 处的机械改造)**

```ts
// src/lib/api-auth.ts(新增)
import { getServerSession } from "next-auth";
import { decode } from "next-auth/jwt";
import { getAuthOptions } from "@/lib/auth";

/** 先看 cookie(Web),再看 Authorization: Bearer(App)。两条通道返回同一个 userId。 */
export async function getAuthedUserId(req: Request): Promise<string | null> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    const token = await decode({ token: bearer, secret: process.env.NEXTAUTH_SECRET! });
    const id = (token as { id?: string; sub?: string } | null)?.id ?? (token as { sub?: string } | null)?.sub;
    if (id) return id;
  }
  const session = await getServerSession(getAuthOptions());
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ?? null;
}
```

改造模式统一:

```ts
// 改造前
const session = await getServerSession(getAuthOptions());
if (!session?.user || typeof (session.user as any).id !== "string") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = (session.user as any).id;

// 改造后
const userId = await getAuthedUserId(req);
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

> 注意:GET 路由签名要从 `GET()` 改成 `GET(req: Request)`。这是纯机械改动,但涉及 47 个文件,**必须一次性做完并有测试兜底**(现有 133 个测试文件里对 API 的断言会兜住回归)。

**Token 存储**:App 端用 `expo-secure-store`(iOS Keychain / Android Keystore),不用 AsyncStorage 明文。

**refresh token 存哪**:新增 Prisma 模型 `MobileRefreshToken`(tokenHash、userId、expiresAt、revokedAt、deviceInfo)。不存明文,存 sha256。

---

## 五、视频播放:唯一逃不掉 iframe 的地方

**这是必须提前对齐的预期,否则做完会失望。**

| 事实 | 说明 |
|---|---|
| YouTube 不允许第三方播放器直接拉流 | 任何 App(含纯原生)都拿不到裸视频流 |
| Android 官方 Player API **已于 2022 年废弃** | Google 官方推荐改用 iframe / WebView 内嵌 |
| iOS 的 `youtube-ios-player-helper` 本质也是 WKWebView | 同样不是原生解码 |

**结论**:视频画面必须用一个 WebView 承载 YouTube iframe,**这是 YouTube 官方唯一支持的路径,不是我们的技术选择**。

**但影响范围极小**:

```
播放页布局
┌──────────────────────────┐
│  [YouTube iframe 区域]     │ ← 唯一的 WebView,且只负责画面
│   controls=0, 不带任何 UI  │    (播放/暂停/进度/倍速自己画)
├──────────────────────────┤
│  原生字幕列表 (FlashList)  │ ← 原生
│  当前句高亮 / 点击查词      │ ← 原生
│  原生查词 sheet            │ ← 原生
├──────────────────────────┤
│  原生控制条(进度/倍速/上下句)│ ← 原生
└──────────────────────────┘
```

对比现在:整页都是网页 → 只有视频那一块是 WebView。播放控制、字幕滚动、点词查词全走原生,帧率与手感是 App 级的。

**技术选型**:`react-native-youtube-iframe`(内部 WebView + YouTube IFrame API,提供 `seekTo`/`play`/`pause`/`getCurrentTime`)
> 备选:`expo-web-view` 手写 iframe postMessage 桥。若前者维护状态不佳则降级自研,接口一样。

---

## 六、P0:API 补齐清单(可立即开工)

现有 47 个路由已覆盖:**字幕、查词、生词、复习、翻译、TTS、AI 对话、导入、积分**。真正缺的是「页面级聚合接口」——因为 Next.js 服务端组件习惯在服务端直接拼好数据。

### 需要新增的接口

| # | 接口 | 服务的屏幕 | 现状 | 说明 |
|---|---|---|---|---|
| 1 | `GET /api/home/summary` | 首页 | ❌ 无 | 词数、已读篇数、连续天数、继续学习目标 |
| 2 | `GET /api/lectura/stories` | 阅读 tab | ⚠️ 部分 | 现在 `lectura/reads` 是记录已读,缺分级列表 |
| 3 | `GET /api/vocab/list` | 语料库 | ❌ 无 | 分页 + 筛选(状态/词性/来源) |
| 4 | `GET /api/membership/status` | 会员页 | ❌ 无 | 当前套餐、额度、到期时间 |
| 5 | `GET /api/account/summary` | 我的 | ❌ 无 | 用户信息 + 积分 + 学习统计聚合 |
| 6 | `GET /api/review/summary` | 复习 tab | ⚠️ 部分 | 已有 `vocab/review`,补「今日待复习数 / 进度」聚合 |

### 需要改造的接口

- **全部 47 个**:加 Bearer 支持(统一走 `getAuthedUserId(req)`)
- **错误格式统一**:`{ error: string, code?: string }`,否则 App 端没法做统一提示
- **分页统一**:`?cursor=<id>&limit=<n>`,返回 `{ items, nextCursor }`

### 验收标准

- [ ] `curl -H "Authorization: Bearer <token>" /api/home/summary` → 200 且字段稳定
- [ ] 不带 token 调 → 401
- [ ] 带过期 token → 401 且 `code: "TOKEN_EXPIRED"`(App 据此静默刷新)
- [ ] Web 端 cookie 通道回归通过(`npm test` 529 全绿)
- [ ] 输出 `docs/api-contract.md`(每个接口的请求/响应示例)

---

## 七、Expo 项目结构与页面映射

### 目录结构

```
esponal-mobile/                    ← 独立仓库或 monorepo 子目录(建议先独立仓库)
├── app/                           ← expo-router 文件路由
│   ├── (tabs)/
│   │   ├── index.tsx              ← 首页    ← GET /api/home/summary
│   │   ├── watch.tsx              ← 视频    ← /api/youtube/*
│   │   ├── lectura.tsx            ← 阅读    ← /api/lectura/stories
│   │   ├── review.tsx             ← 复习    ← /api/review/summary
│   │   └── me.tsx                 ← 我的    ← /api/account/summary
│   ├── watch/[videoId].tsx        ← 播放页(沉浸,原生字幕)
│   ├── lectura/[slug].tsx         ← 阅读器
│   ├── vocab/index.tsx            ← 语料库
│   ├── settings.tsx
│   ├── membership.tsx
│   ├── _layout.tsx                ← 根布局:鉴权守卫 + QueryClient
│   └── sign-in.tsx                ← 登录(原生表单)
├── src/
│   ├── api/                       ← 与 Web 共享的 fetch 封装(从 src/lib 移植)
│   │   ├── client.ts              ← Bearer 注入 + 401 自动刷新
│   │   ├── home.ts  vocab.ts  ...
│   ├── components/                ← 原生 UI 组件
│   │   ├── ui/                    ← Button / Card / Sheet / Skeleton
│   │   ├── transcript/            ← 字幕行、当前句高亮、词高亮
│   │   └── player/                ← YouTube 容器 + 原生控制条
│   ├── theme/                     ← 设计 token(白 / #10b981 / 22px padding / 20px 圆角)
│   └── hooks/
├── app.json                       ← Expo 配置
└── eas.json                       ← 构建配置
```

### 与现有页面的映射(31 个页面 → App 侧取舍)

| Web 页面 | App | 说明 |
|---|---|---|
| `/` 首页 | ✅ tab | 重做原生布局 |
| `/watch` + `/watch?v=` | ✅ tab + push | 核心屏 |
| `/lectura` + `/lectura/[slug]` | ✅ tab + push | 核心屏 |
| `/review` + `/vocab/review` | ✅ tab + push | 核心屏 |
| `/me` `/settings` `/membership` `/account/credits` | ✅ | 常规设置类 |
| `/vocab` | ✅ push | 语料库 |
| `/talk` `/talk/[characterId]` | ✅ 二期 | AI 对话,原生输入体验更好 |
| `/import` `/import/library` `/import/[id]` | ✅ 三期 | 导入 |
| `/learn/*` `/grammar/*` `/phonics` `/dissect` | ✅ 三期 | 学习工具 |
| `/search` | ✅ 三期 | 全局搜索 |
| `/extension` | ❌ 不上 | 浏览器扩展说明页,App 无意义 |
| `/auth/*` | ❌ 替换 | App 用原生登录页 |

### 技术选型

| 需求 | 选型 | 理由 |
|---|---|---|
| 路由 | `expo-router` | 文件路由,和 Next App Router 心智一致 |
| 数据请求 | `@tanstack/react-query` | 缓存、重试、离线优先、乐观更新 |
| 长列表(字幕) | `@shopify/flash-list` | 原生复用,10k 行不卡 |
| 动画 | `react-native-reanimated` | UI 线程动画,手势流畅 |
| Token 存储 | `expo-secure-store` | Keychain / Keystore |
| 视频 | `react-native-youtube-iframe` | 唯一可行路径(见第五节) |
| 音频(TTS) | `expo-audio` | 服务端已生成 mp3,直接播 |
| 状态 | `zustand` | 轻量,只放全局播放状态 |
| 字体 | `expo-font` + Plus Jakarta Sans / Noto Sans SC | 复用现有设计 |
| 构建 | EAS Build(云) | **Windows 无 Mac 也能出 iOS 包** |
| OTA 更新 | EAS Update | JS 层热更,不必每次走商店审核 |

---

## 八、分阶段计划与验收

| 阶段 | 工期 | 交付物 | 验收(硬指标) |
|---|---|---|---|
| **P0 API 化** | 1-2 周 | 6 个新接口 + 47 个改造 + `api-contract.md` | curl 全绿;`npm test` 529 全绿;Web 无回归 |
| **P1 骨架** | 1 周 | Expo 工程 + 5 tab + 登录 + 主题 token | 双端真机跑起,能登录,tab 切换不闪 |
| **P2 核心三屏** | 3-4 周 | 播放页(iframe+原生字幕+查词)、复习、语料库 | 字幕滚动 60fps;点词 300ms 内出卡;真机日常可用 |
| **P3 补齐** | 3-4 周 | 阅读器、AI 对话、导入、我的 | 功能对齐 Web 主要路径;出 APK 内测包 |
| **P4 上架** | 2-4 周 | Play 封闭测试(12 人×14 天)、iOS 包 | 商店可下载;崩溃率 <1% |

**累计:到「自己能日常用」约 2.5-3.5 个月;到上架 4-5 个月。**(按业余时间投入估,投入减半则时间翻倍)

---

## 九、成本清单(把话说明白)

| 项目 | 费用 | 必要性 |
|---|---|---|
| Apple Developer Program | **$99/年(约 700 元)** | iOS 上架必须,可推迟到 P4 |
| Google Play 开发者账号 | $25 一次性 | 上架必须 |
| EAS Build | 免费额度够个人用;超了 $99/月 | 免费档可用,优先级低 |
| Neon / Upstash | 现有配置够用 | 无需追加 |
| **合计首年** | **约 750-900 元** | |

**非金钱成本(更重要)**:

- Web 和 App 的 UI 从此双份维护。加一个功能 = 写两次 UI(逻辑可复用)。
- 每次大改版要做两遍设计。
- 你要同时具备 RN 的调试能力(真机、Metro、原生日志)。

> 这不是劝退,是让你在知道总账的前提下决定。

---

## 十、风险清单

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| `react-native-youtube-iframe` 失效/停止维护 | 中 | 播放页重做 | 抽象成 `PlayerAdapter` 接口,可换成自研 WebView 桥 |
| Play 判定「功能不足」拒绝 | 中 | 上架延期 | App 要有原生独有能力(离线字幕、本地生词卡、系统级后台播放) |
| Expo SDK 升级破坏兼容 | 中 | 返工 | 锁版本,不追新;升级单独开票 |
| iOS 审核被拒(内容/账号删除) | 中 | 延期 | 必须有「注销账号」入口 + 隐私政策页(Web 已有) |
| 双份 UI 维护拖慢迭代 | 高 | 长期 | 先只做 3 个核心屏,其余用 WebView 兜底过渡(可接受的折中) |
| 业余时间不足导致烂尾 | **中高** | 全盘 | **P2 结束后设决策点**:真机自用一周,确认手感再决定是否继续 P3/P4 |

---

## 十一、需要用户拍板的决策点

| # | 决策 | 选项 | 建议 |
|---|---|---|---|
| 1 | 仓库形态 | 独立仓库 / monorepo | **独立仓库**(Expo 工具链和 Next 冲突少,CI 简单) |
| 2 | 一期范围 | 全功能 / 只做核心三屏 | **只做核心三屏**,验证后再扩 |
| 3 | iOS 是否同步 | 同步 / 先 Android | **先 Android**,iOS 在 P4 前再决定(省 700 元/年) |
| 4 | 会员/支付 | App 内卖 / 只看不卖 | **只看不卖**(Play 数字商品必须走 Billing,抽成 15-30%,一期不做) |
| 5 | 是否保留 Web | 保留 / 只做 App | **保留**(PC 学习体验、隐私政策页、上架必需) |

---

## 十二、下一步(等你点头就开工)

**P0 第一刀**(1-2 天可见):

1. 新增 `src/lib/api-auth.ts`(双通道鉴权 helper)
2. 新增 `/api/mobile/auth/login` `/refresh` `/logout` + `MobileRefreshToken` 模型
3. 改造 3 个代表性路由做样板(`vocab/review`、`subtitle`、`translate`),curl 验证 Bearer 通过
4. 样板确认后批量改剩余 44 个

**为什么先做这一步**:它对 Web 零风险、可回滚、且是后面所有工作的地基。做完你就能用 curl 验证「App 能不能拿到数据」这个最根本的问题。
