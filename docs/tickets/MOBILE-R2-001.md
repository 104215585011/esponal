# MOBILE-R2-001 — P0 持久壳 + 下线旧导航【已实现,待真机验收】

> 2026-11-13 · 实现:Codex(本机) · 验收:用户真机 + `npm test` + `npm run test:e2e`
> 关联:`MOBILE-R2-epic.md`(总纲)、`PLATFORM-000`(隔离与上架)

## 一、做了什么

### 1. 壳从"每页包一层"改成"根 layout 挂一次"
- 新增 `src/app/components/shell/useIsMobile.ts`:`matchMedia(max-width:767px)`,**JS 层隔离**(不是 CSS 藏),桌面端不挂载壳 DOM。
- 重写 `src/app/components/shell/AppShell.tsx`:改为**纯 chrome 组件**(顶栏 + 底栏 + 导入浮层),不再包 `children`。
- 根 `layout.tsx`:`<BottomTabBar />` → `<AppShell />`(包在 `Suspense` 里,因为它读 `searchParams`)。
- 内容让位改由 CSS 统一:`AppShell` 写 `document.body.dataset.shell = tab|push|immersive`,`globals.css` 按 52px 顶栏 / 74px+safe-area 底栏给 padding。壳因此不需要包 children,登录页等流程页也不会被撑开。

### 2. 路由表成为唯一导航来源
- 重写 `shell/routes.ts`:5 个 tab + 20 条推入页 + 隐藏前缀(`/auth`、`/offline`),新增 `isShellHiddenPath()` / `isImmersivePath()` / `getParentTabForPath()`。
- 修掉旧表里的错误:同一路径 `/watch` 同时被声明成 tab 和 push。

### 3. 三层导航落地
| 层 | 判定 | 表现 |
|---|---|---|
| tab | 路由表 `level: "tab"` | 顶栏(首页=logo)+ 底栏 5 tab 高亮 |
| push | 其它已登记路由 | 返回箭头 + 标题,底栏隐藏 |
| 沉浸 | `/watch?v=<id>` | 顶栏底栏全部退场 |
| 无壳 | `/auth/*`、`/offline` | 不渲染任何 chrome |

### 4. 旧导航物理下线
- **删除** `src/app/components/web/BottomTabBar.tsx`(旧 4 tab + 中央 `+` fan-out)。
- **删除** `src/app/components/web/MobileTopBar.tsx`(旧移动顶栏 + 抽屉入口)。
- `SiteHeader.tsx`:去掉 `MobileTopBar`,桌面 header 改为 `hidden md:block`(移动端不再渲染)。
- `src/app/talk/page.tsx`:去掉自挂的 `MobileTopBar`。
- 保留 `web/MobileNav.tsx`(桌面 `SiteNav` 的头像菜单在用它,不是移动抽屉)。
- **导入入口不丢**:`+` 从底栏中央移到顶栏右侧,浮层仍是"视频链接 / EPUB·PDF"两列,`data-testid="mobile-import-trigger"` 保留(旧 e2e 断言因而不失效)。

### 5. 三个 tab 页去掉包装、给出可用内容
- `/home`、`/me`、`/review` 不再 `<AppShell>` 包一层;`/home` 从"首页建设中"换成**临时可用版**(复习/视频/阅读三个主入口 + 6 个工具格),P1 再换成正式设计。
- 目的:P0 阶段任何功能都不能变成黑户——旧底栏删除后,`/learn`、`/vocab`、`/talk` 等入口必须还有地方可达。

## 二、证据

### 类型 / 静态
- `npx tsc --noEmit` → 通过
- `npx next lint --quiet` → 0 warning / 0 error

### 单测(契约变更,以下测试被有意改写为 MOBILE-R2 契约)
| 文件 | 变更理由 |
|---|---|
| `tests/mobile_r001.test.mjs` | 壳不再由页面包;layout 挂 `<AppShell />`,旧底栏断言作废 |
| `tests/mobile009.test.mjs` | `BottomTabBar` / `MobileTopBar` 已删除;断言改为"文件必须不存在 + 壳承担 chrome" |
| `tests/mobile003.test.mjs` | 毛玻璃视觉断言从旧两文件迁到 `AppShell.tsx`(视觉 token 未变) |
| `tests/mobile006.test.mjs` | talk 页不再自挂移动顶栏,改为壳提供 |
| `tests/corpus001-ui.test.mjs` | 语料库从底栏 tab 降为推入页(父 tab=首页) |
| `tests/import022.test.mjs` | 导入 fan-out 从底栏中央移到顶栏右侧,两入口均保留 |
| `tests/web013.test.mjs` | SiteHeader 不再含 MobileTopBar |
| `tests/web004.test.mjs` | **非本次改动**:翻译缓存逻辑早已迁到 `TranscriptPanel.tsx`,测试仍读 `SubtitlePanel.tsx`,已修正断言目标文件 |

- `npm test` → **529 tests,529 pass,0 fail**(最终复跑)

### e2e(`npm run test:e2e`,mobile + desktop 双 project)
- 公开页 8 条路由无白屏 / 无 console error(新增 `/home`、`/review`、`/me`)
- 5 个 tab 在移动端全部可见可点
- **底栏 DOM 不重建**:切 tab 前在节点上打 `__shellMark`,切到 `/watch` 后标记仍在
- 桌面端 3 条路由都找不到 `mobile-app-shell` / `mobile-shell-tabbar`
- 推入页(`/membership`)有返回箭头、无底栏
- `npx playwright test tests/e2e/smoke.spec.ts` → **9 pass / 5 skip(桌面跳过 mobile-only)/ 0 fail**
- 全量 `npm run test:e2e` 6 pass / 11 fail,**11 条失败全部与本次改动无关**(详见"四、遗留的非本次问题")

### 测试基建顺带修正
- `playwright.config.ts`:`webServer.reuseExistingServer` 改为 `!process.env.CI`——本地复用已运行的 dev server,避免 Next 冷启动 30s 编译超时;CI 行为不变。

## 三、已知限制(进 P1/P2 再处理)
1. 壳的 chrome 依赖 `useIsMobile`,**首帧(SSR)不渲染、水合后出现**,移动端会有一次 ≤1 帧的顶栏出现/内容位移。彻底解法是把视口判断下沉成 CSS-only(用 CSS 变量 + inline script 预置),留到 P4 性能期。
2. 滚动记忆用 `sessionStorage + requestAnimationFrame`,只在壳可见时生效;沉浸页不记忆滚动。
3. 推入页目前是整页跳转(无滑入动画),`view-transition` 在 P3 做。
4. `/home` 是临时内容,P1 换正式设计。

## 四、遗留的非本次问题(e2e 全量跑出的 11 条失败,均为存量)

排查结论:全部与 Mobile-R2 无关,属"规格过期 + 本机缺 e2e 数据"两类。

| spec | 失败点 | 根因 |
|---|---|---|
| `anon-home-to-watch` #1 | 首页找不到文案「真实的西语视频」 | **规格过期**:文案早已改为「西班牙语,…」,spec 没跟上 |
| `anon-home-to-watch` #2 / `anon-save-prompts-login` | `[data-testid='transcript-cue']` 20s 不出现 | 缺数据:`E2E_TEST_VIDEO_ID` 未配置,兜底视频 dQw4w9WgXcQ 没有西语字幕 |
| `login-lookup-save` ×2 | 登录后 URL 不跳转 | `.env` 缺 `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`(且未跑 `scripts/seed-e2e-user.mjs`) |
| `smoke` 公开页 / 导入 sheet | 偶发 `ERR_ABORTED` / `useContext of null` | dev server 在全量并发下 HMR 热更新竞态,**单独重跑全绿**(9/0),非产品代码问题 |

待办(可开一张独立票据,如 `INFRA-E2E-DATA`):
1. 更新 `anon-home-to-watch` 的 hero 文案断言;
2. `.env` 补 `E2E_USER_*` + `E2E_TEST_VIDEO_ID`(选一部有西语字幕的视频)并 seed;
3. 补 seed 脚本进 `predev` 或 e2e 前置。
