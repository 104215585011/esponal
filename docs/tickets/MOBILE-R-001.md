# MOBILE-R-001 — App 壳实现(Shell + 路由表 + 过渡 + 回退)【工程票·Codex1】

**优先级**:P0(MOBILE-R epic 地基)
**实现**:Codex1 · **测试**:Codex2 + 真机 · **验收**:PM 对照 `MOBILE-R-000-design.md` + mockup
**依赖**:方案已批准(2026-06-11);建议 INFRA-PW(Playwright 冒烟)先行落地护航
**范围**:只建壳和规则,**不迁任何业务页**(迁入是 R-003)。本票完成后壳与旧导航共存(壳先空跑挂占位 tab 页)。

## 要做
### 1. Shell 组件(`src/app/components/shell/`)
- `AppShell.tssx`:底部 5 tab 栏 + 顶栏 + 页面容器;**壳只渲染一次**,tab 切换不重建壳。仅移动端(`md:hidden` 思路沿用,桌面零变化)。
- 5 tab:首页 `/home`(占位页)/ 视频 `/watch`(暂指现 watch 首页)/ 阅读 `/lectura` / 复习 `/review`(占位)/ 我的 `/me`(占位)。占位页本票只需骨架(标题+"建设中"),内容是 R-002/R-003 的事。
- 顶栏(tab 级):左标题(首页=logo),右 搜索 + `+` 导入(复用 IMPORT-4 的 Popover/ImportSheet,从底栏迁到顶栏)。

### 2. 路由表(`src/app/components/shell/routes.ts`)
- 每个页面声明:`{ path, level: "tab"|"push"|"sheet", parentTab }`。推入页(watch?v、/import/[id]、lectura/[slug]、/account/credits、/membership、设置…)全部登记 parentTab。
- 单一真源:壳、返回逻辑、tab 高亮都从这张表读。

### 3. 三种过渡(全站唯一允许的三种)
- tab 切换:内容淡入 ≤150ms,无滑动;
- 推入页:右滑入/返回左滑出 250ms(CSS transform,推入时隐藏 tab 栏);
- sheet:上滑/下拉关(复用 MOBILE-000 框架,不重做)。

### 4. 回退四规则(design.md §三)
- tab 页无返回箭头;Android/浏览器 back:非首页 tab→首页,首页→默认行为;
- 推入页返回箭头=`router.back()`;**深链直达(无历史)→ 回 parentTab**(从路由表读);
- sheet:返回/下拉=关 sheet 不退页;
- 提供 `useShellBack()` hook 封装上述,推入页统一用。

### 5. 壳层杂项
- tab 页**滚动位置记忆**(切走再回不丢);安全区 env(safe-area-inset);单 player:推入 watch 时通知暂停其他播放(沿用现约束)。

## 验收
- [ ] 壳在移动端可用:5 tab 可切(淡入)、占位页就位、顶栏 `+` 导入可用;
- [ ] 推入一个现有页(如 /account/credits)走滑入+返回箭头+深链回 parentTab,全链路符合四规则;
- [ ] 滚动记忆生效;桌面端零变化;旧导航暂不动(R-003 下线);
- [ ] `npm test` 全绿 + lint:encoding;Playwright 冒烟(若已落地)通过;真机(安卓优先)过渡流畅。
> 戒:不迁业务页、不改桌面、不发明第四种过渡、UTF-8、勿带临时文件。
