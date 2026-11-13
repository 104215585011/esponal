# PLATFORM-000 — 移动端/Web 端隔离策略 与 Google Play 上架路径【决策票】

> 2026-11-13 · PM 与用户对齐 · 结论性文档,后续 Capacitor/上架相关工作票都引用此票
> 背景:用户问"移动端和 web 端怎么隔离?要不要隔离?上谷歌商店是不是要单独弄?"
>
> ⚠️ **2026-11-13 更新:本票第三节的「Capacitor 套壳」方案已被 `PLATFORM-001-native-app.md` 推翻。**
> 用户明确要求「正式软件,不接受 WebView 套壳」,改走 Expo / React Native 原生渲染。
> **仍然有效的是**:第一节「隔离的是代码层不是仓库」、第三节「后端零分叉」、Play 支付红线。

---

## 一、结论(三句话)

1. **要隔离,但隔离的是"代码层",不是"仓库"** —— 一个仓库、一套部署,移动/桌面各自持有自己的壳和组件,共享数据层。
2. **上 Google Play 需要单独的"安装包"(AAB),不需要单独的"代码库"** —— Capacitor 工程放同仓库 `mobile/` 目录,CI 单独构建,WebView 指向线上站点。
3. **支付是最大的坑,不是技术** —— 会员/积分是数字商品,App 内直接复用网页支付会违反 Play 政策;一期建议 App 内"只看不卖"。

---

## 二、Web/移动隔离:三层切法

### 第 1 层:文件隔离(本次 MOBILE-R2 就在做)
```
src/app/(app)/components/shell/   ← 移动壳(只属于移动端)
src/app/components/web/           ← 桌面组件(SiteHeader 等)
src/lib/  src/app/api/            ← 共享:数据层、API、业务逻辑
```
规则:**移动文件里禁止出现桌面逻辑,桌面文件里禁止出现移动壳**。共享的只有 API 路由、lib、数据模型。这样任何一端的重构都碰不到另一端的文件。

### 第 2 层:渲染隔离(一个开关,不靠 CSS 碰运气)
- 壳的选择用 `useViewport()`(`matchMedia("(max-width: 767px)")`)在 JS 层决定:移动渲染 `(app)` 壳,桌面渲染 SiteHeader。
- 现状是 CSS `md:hidden` 双轨——两套 DOM 都挂载、只是藏起来。壳这种结构性组件必须改成 JS 分支,**桌面浏览器里移动壳的 JS 根本不运行**(单播放器约束也靠这个保证)。
- 判据:桌面 DevTools 里搜 `data-testid="mobile-app-shell"`,应该找不到(现在能找到,这就是要改的)。

### 第 3 层:URL/路由隔离(现在不做,记录边界)
- 不做 `m.esponal.com` 子域、不做 UA 分流到独立路由树。原因:两套页面树的维护成本远大于收益,SEO 还要处理 duplicate content。
- 未来若需要"移动端极致性能/离线优先",再评估。触发条件:移动端 LCP 持续 >2.5s 或离线成为核心需求。

---

## 三、Google Play 上架:要什么、不要什么

### 要的:一个独立的"包"
- Capacitor 工程,建议路径 `mobile/`(含 `capacitor.config.ts`),产物 AAB。
- **WebView 采用 server-driven(加载线上地址)**,原因:登录是 NextAuth cookie 会话、数据在 Prisma/Postgres、TTS/ASR 在服务端、YouTube iframe 播放——这些都不可能打进离线包。App 包 = 原生壳 + 原生增强,内容永远来自我们的部署。
- 版本节奏:**web 随时可发;App 只在原生能力变化(推送/权限/SDK 升级)时发新版**。内容更新不需要重新上架。

### 不要的:独立代码库/独立后端
- 后端零分叉。同一套 API、同一个数据库、同一套账号(cookie 在 WebView 里天然可用)。
- 什么时候才值得拆仓库:移动端需要独立发布节奏/独立团队,或 Capacitor 工程拖慢主仓库 CI。现在都不是。

### 上架前必须就绪的线上环境(2026-11-13 核实现状)
- 生产部署已存在:`https://esponalsssssss.vercel.app`(/api/health 与首页均 200)。**App 壳加载的就是这个地址,它挂了 = 审核被拒**,所以上架前要保证它稳定。
- **域名:用户已购 `pcmuz.cn`(阿里云注册;NS 早已切到 Cloudflare,用户 Google 账号可管;`whisper.pcmuz.cn` 是用户自建 Whisper STT 的 Cloudflare Tunnel,勿动)。绑定进度(2026-11-13):**
  - [x] Cloudflare 加两条 CNAME(`@` 与 `www` → 9a31f61b07449a02.vercel-dns-017.com,DNS only 灰云)
  - [x] Vercel 验证通过。**Primary = `www.pcmuz.cn`**,裸域 `pcmuz.cn` 308 → www;`https://www.pcmuz.cn/api/health` 200,SSL 有效(实测 2026-11-13)
  - [x] Vercel 环境变量 `NEXTAUTH_URL` → `https://www.pcmuz.cn` + redeploy(已核实:NextAuth providers 返回该域名回调,2026-11-13 13:20)
  - [x] Google OAuth:已补 `https://www.pcmuz.cn/api/auth/callback/google` 与 JS 来源 www/裸域(2026-11-13)
  - [ ] Chrome 扩展 `ESPONAL_APP_ORIGIN` 改新域名并重打包
  - [ ] (上架前)`assetlinks.json` 放 `https://www.pcmuz.cn/.well-known/`
  - 备注:代码无硬编码域名(全 env),CORS 为 `*`,绑域名零代码改动。`pcmuz.cn` 与 Esponal 品牌无关联,商店名/包名(如 com.esponal.app)与域名的一致性待用户拍板,不阻塞。另:实测 `whisper.pcmuz.cn` 返回 530(tunnel 源端离线,与本域名操作无关;whisper 只在用户本机 cloudflared 运行时可用)。
- "部署"≠ 买云主机:Vercel(serverless)+ 托管 Postgres(Neon/Supabase 类)+ 托管 Redis 即可,起步免费档够用。生产环境变量配在 Vercel 后台(与本地 `.env` 是两套;本地 `NEXTAUTH_URL` 仍是 localhost,属正常)。
- **上架前建议买自有域名**(约 ¥60–100/年):① 商店 listing 品牌;② Android App Links 深链验证要求把 `assetlinks.json` 放在自有域名下;③ `*.vercel.app` 默认域名在部分网络环境不稳定,审核员访问慢也影响通过。
- 开发/真机调试阶段:Capacitor 壳可先指向 localhost 或 Vercel preview,**不需要**等生产就绪;只有提交审核时必须用稳定线上地址。

### Play 政策硬约束(2026-11 核实,逐条是坑)

| # | 政策 | 要求 | 对我们的影响 |
|---|---|---|---|
| 1 | **最低功能性(4.3)** | 纯 WebView 套壳会被拒;必须有超越"浏览器打开网页"的 native 价值 | 必须做:推送(复习到期提醒,产品天然匹配)、离线兜底屏、原生启动屏、原生返回手势。MOBILE-R2 的回退模型正好是"native 返回行为",是加分项 |
| 2 | targetSdk | 2026-08-31 起新应用和更新必须 target API 36 (Android 16) | Capacitor 默认跟随,构建时确认 |
| 3 | 测试要求 | 新个人开发者账号:≥12 名测试者连续 14 天封闭测试,才能申请正式上架 | 上架计划要预留 2-3 周;或用组织账号 |
| 4 | 数据安全表单 | 申报内容必须与 SDK 实际行为一致,不符会下架 | Sentry/推送 SDK 都要申报;上架前过一遍 |
| 5 | 账号删除 | 可注册的 App 必须提供账号删除入口 | 检查现有账号页 |
| 6 | **支付(最大坑)** | 数字商品在 App 内销售必须走 Google Play Billing,或注册"外部支付计划"并按 API 上报交易(2026-10 起强制);订阅外部交易费 10%,其他数字商品 20%/前 $1M 10% | 见下节 |

### 支付的三条路(按推荐顺序)

1. **一期:App 内只看不卖(consumption-only)** — App 里隐藏积分购买/会员购买入口(网页端照常卖,已付费用户登录即用)。合规最快、零抽成、零上报负担。代价:App 渠道内不产生收入。
2. **二期(有收入后):接 Play Billing** — 走 Google 抽成(订阅类可享低档),对接 RevenueCat 之类可少写代码。
3. **备选:外部支付计划(External Offers/Content Links)** — 订阅 10% 费率,但要注册计划、集成外部支付 API、逐笔上报交易。规模小的时候不值得。

> **关键合规红线**:App 内露出网页版收银台买数字商品 = 政策违规,发现即下架。一期做"只看不卖"时要真的藏干净(定价页、升级按钮、积分充值入口全部判断 `isNativeApp` 隐藏)。

---

## 四、给 MOBILE-R2 补的两个约束(立即生效)

1. **壳的 JS 隔离**:MOBILE-R2-001 实现壳时,壳挂载必须包在 `useViewport()` 判断里,桌面不渲染、不加载移动壳代码(验收项加入 epic 九)。
2. **`isNativeApp` 旗标预留**:前端加一个统一的运行环境判断(Capacitor 注入的 UA/bridge 检测),所有"购买/充值/订阅"入口渲染处过这个旗标。现在不加逻辑,只留判断函数,避免二期返工。

## 五、后续工作票(待立,不在 MOBILE-R2 范围)

- [ ] PLATFORM-001:Capacitor 工程初始化 + WebView 加载线上站( feasibility spike,1 天)
- [ ] PLATFORM-002:推送(复习提醒)方案选型(FCM)
- [ ] PLATFORM-003:离线兜底屏 + 更新提示
- [ ] 上架清单:targetSdk 36 / 数据安全表单 / 测试者招募 / 账号删除入口
