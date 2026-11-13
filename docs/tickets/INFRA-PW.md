# INFRA-PW — Playwright 真渲染冒烟测试【工程票·Codex1】

**优先级**:P0(MOBILE-R 重构护航,壳动工前落地)
**背景**:现有测试几乎全是"源码契约"(grep 源码),抓不住渲染崩溃(MOBILE-001 P0)、标签错配(FE-002 流水标签 bug)、乱码。重构这么大动作不能裸奔。

## 要做
1. 引入 Playwright(devDependency)+ `playwright.config.ts`(chromium 一个项目即可;移动视口 390×844 为主,加一个桌面 1280)。
2. 冒烟用例 `tests-e2e/smoke.spec.ts`(**广而浅**,只保"打开不崩 + 关键元素在"):
   - 未登录:首页 / /watch / /lectura / /import / /membership 各页 200 + 无 ErrorBoundary/白屏 + 无 console error(过滤已知噪音);
   - 移动视口:底部导航可见、查词 sheet 能开能关(任选一处);
   - 中文文案抽查不乱码(任取 2-3 处断言含正确中文)。
3. 脚本:`npm run test:e2e`(dev server 自动起,`webServer` 配置);**不并入 `npm test`**(保持单元秒级),CI/收尾前手动跑。
4. 登录态用例本票不做(后续票加 auth fixture)。

## 验收
- [ ] `npm run test:e2e` 本地一条命令全绿;任意页面渲染崩溃/中文乱码能被抓出(故意制造一次验证有效性后还原);
- [ ] 文档:README 或 ticket 内写明怎么跑;`npm test` 不受影响。
