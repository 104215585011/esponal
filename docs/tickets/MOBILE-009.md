# MOBILE-009 — 移动端 app 外壳:底部 tab 导航 + 精简顶栏

**优先级**：P0(用户要求"尽快";跨全站基础,先于剩余单页)
**区域**：全局 —— `src/app/layout.tsx` + `SiteHeader.tsx` / `SiteNav.tsx` / `MobileNav.tsx` + 各页面底部留白适配
**设计**：PM 派 design 子 agent(产出 `docs/tickets/MOBILE-009-design.md`)
**实现**：Codex1
**依赖**：MOBILE-000 地基(token/绿)
**预估**：1.5 天

## 背景
用户反馈:现在的移动端"还是太像个网站,不像 app"。决策(用户已选):**底部 tab 栏 + 精简顶栏**——主流原生 app 范式。这是跨全站基础改造,优先做(其它单页要适配它的底部空间)。

## 目标
- **底部 tab 栏**(移动端常驻,`md:hidden`):一排图标 tab,随时切换主区。候选(设计 agent 提案 4-5 个,PM/用户定):首页 / 视频(watch) / 阅读(lectura) / 词库(vocab) / 我的(更多)。watch + lectura 是 T1 核心,优先占位。
- **精简顶栏**:顶部只留上下文按需内容(返回 / 标题 / 搜索),去掉"网站感"的大 header。
- 整体观感"像 app"。

## 设计要点(待 design agent 出 MOBILE-009-design.md)
- 底部 tab 栏:容器(毛玻璃/安全区 `pb-safe`)、图标(lucide)、选中态(翡翠绿 brand)、≥44px、当前路由高亮、tab 项目与路由映射。
- 顶栏精简形态:首页 vs 详情页(返回)不同上下文。
- **与各页面底部控件协调**(关键):watch 的播放控制条、lectura 的阅读控制条都在底部——明确"阅读/看视频沉浸时是否隐藏 tab 栏 / 控件叠在 tab 栏之上"的规则,避免底部打架。
- 复用 MOBILE-000 token + 翡翠绿;桌面端导航不动(`md:hidden`/`hidden md:flex` 隔离)。
- 现有 `MobileNav`(汉堡抽屉)是否保留/弱化,由设计定(底部 tab 后汉堡可能多余)。

## 验收
- [ ] 移动端底部 tab 栏常驻、切换顺畅、当前页高亮、≥44px、安全区适配。
- [ ] 顶栏精简、像 app。
- [ ] 与 watch/lectura 底部控件不打架(有明确规则)。
- [ ] 桌面端导航无回退。
- [ ] **真机/设备模式实际打开多个页面切 tab 不崩**(error boundary 不触发)。
- [ ] npm test 全绿 + build + lint:encoding。

## 血泪三戒
① 改全局导航/共享组件只换该改的,桌面不准动;② Codex2+验收必须真机实际切 tab/打开页面不崩(单测查源码字符串测不出崩溃);③ 勿带 scratch 文件入仓。

## 流程
Claude1(本票)→ design 子 agent 设计 → Codex1 → Codex2 真机 → 用户真机 → Claude1 验收。
