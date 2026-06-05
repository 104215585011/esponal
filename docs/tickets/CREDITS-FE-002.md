# CREDITS-FE-002 — 积分使用记录(流水)页

**优先级**:P1(补 CREDITS-FE-001 漏做的 C 项)
**实现**:Codex1(前端 + 列流水 API)· **测试**:Codex2 + 真机 · **验收**:Gemini1 视觉 + PM
**依赖**:`CreditTransaction` 模型已存在(reason: grant/refill/spend;refType;deltaMinor;balanceAfterMinor;createdAt;`@@index([userId,createdAt])`)
**设计模型**:`docs/tickets/CREDITS-history-mockup.html`(干净现代)
**预估**:1 天

## 背景
CREDITS-FE-001 关单时漏了"账户/积分页含用量流水"(C 项)。本票补齐:让用户能看到配额余额 + 每笔消耗/补充记录。web + 移动。

## 要做
### A. 列流水 API
- **`GET /api/credits/transactions?cursor=<id>&limit=20`**(登录用户)。
- 游标分页(按 `createdAt desc, id`)。返回每条:`{ id, deltaDisplay(=deltaMinor/100), reason, refType, balanceAfterDisplay, createdAt }` + `nextCursor`。
- 用 `@@index([userId,createdAt])`,只查当前用户。

### B. 积分账户页 `/account/credits`(或 `/credits`)
- 顶部**汇总卡**:当前余额(⚡)、等级、本月配额额度 + 下次刷新日(订阅档)/无到期(终身)、「管理会员」入口跳 `/membership`。
- **流水列表**:按日期分组(今天/具体日期/更早),每行 = 动作图标 + 动作名 + 时间 +(±配额,红=扣/绿=增)+ 当时余额。
- **加载更多**(游标分页)。**空态**:"还没有配额记录"。
- 照模型 `CREDITS-history-mockup.html`;web 桌面端也要(响应式,桌面可窄列居中或并入个人中心)。

### C. 入口
- 移动端:MobileNav 侧边栏已有"Esponal 积分"项 → 指到本页。
- web 顶栏余额 → 点击进本页。

## 动作标签映射(reason + refType → 中文)
| reason | refType | 显示 |
|---|---|---|
| grant | (signup) | 注册赠送 |
| refill | — | 月度配额补充 |
| spend | talk_turn | AI 对话 |
| spend | tts | 发音朗读 |
| spend | lookup_fallback | 查词(AI 回落) |
| spend | phrase_extract* | 短语提取 |
| spend | video_unlock_* | 视频字幕解锁(短/中/长片) |
| spend | (其他/未知) | 配额消耗 |
> 标签集中在一个 map,未知 refType 兜底为"配额消耗",别崩。

## 验收标准
- [ ] `GET /api/credits/transactions` 游标分页正常,只返回本人记录,金额为展示值(÷100)。
- [ ] 账户页正确分组、±配额配色、余额、加载更多、空态;web+移动响应式。
- [ ] 入口(移动侧边栏 + web 顶栏)可达。
- [ ] 强调色翡翠绿、禁 sky;触摸≥44px;UTF-8;真机/桌面打开不崩不乱码。
- [ ] `npm test` 全绿 + lint:encoding。

## 不在范围
- ❌ 支付/购买记录单独展示(等 PAY;购买履约的 grant/refill 会自然出现在流水里)。

## 流程
Claude1(本票+模型)→ 用户批准模型 → Codex1 实现 → Codex2 真机 → Gemini1 视觉 → PM 验收关单。
