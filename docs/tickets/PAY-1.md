# PAY-1 — 支付核心(provider 无关 + sandbox 跑通)

**优先级**:P1(C 变现落地)
**依赖**:积分引擎 Phase 1 ✅;计费 spec + 支付 spec(`docs/superpowers/specs/2026-06-05-payment-system-design.md`)
**不依赖**:商户号资质(本票用 mock/sandbox provider,真渠道走 PAY-2/3)
**实现**:Codex1 · **测试**:Codex2 · **验收**:PM
**预估**:2–3 天

## 范围
照 spec §3–§6、§10 的 PAY-1:
1. **Prisma 模型** `PaymentOrder` + 枚举 `BillingCycle/PaymentProvider/OrderStatus`(spec §3)。
2. **下单** `POST /api/pay/order`:服务端**按 spec §2 表锁定金额**(不信前端价),建 pending 订单 + idempotencyKey,返回 `{orderId, payload}`(mock provider 返回假支付句柄)。
3. **履约**(spec §4/§5):mock webhook/标记支付 → 幂等履约(以 providerTxnId + fulfilledAt 双保险)→ `prisma.$transaction` 内:Order→fulfilled + User(plan/creditSource/planExpiresAt/lastRefillAt)+ 调积分引擎发配额 + `CreditTransaction(reason=purchase)`。
   - 月/年=subscription 覆盖 + 延长到期;终身=lifetime 累加、无到期。
4. **查单** `GET /api/pay/order/:id`。
5. **provider 适配器接口** `{createCharge, verifyWebhook, parseTxn}` + 一个 `mock` 实现(为 PAY-2/3 留位)。
6. **到期回落**:在 `requireCredits/requirePlan` 读取路径加 `planExpiresAt < now → free` 惰性降级(与 Phase 2 P0 一并)。

## 验收标准
- [ ] 下单金额服务端锁定,篡改前端价无效(测试覆盖)。
- [ ] 履约幂等:同一 providerTxnId 重复回调**只发一次配额、只升一次级**(测试覆盖重放)。
- [ ] 月订阅履约后:plan/creditSource=subscription、planExpiresAt≈+30天、配额到账、流水 reason=purchase。
- [ ] 终身履约后:creditSource=lifetime、无到期、配额累加。
- [ ] 到期后惰性降级 free(测试覆盖)。
- [ ] 全程事务,失败回滚不产生半履约。
- [ ] `npm test` 全绿 + lint:encoding;密钥不进 git(本票 mock 无真密钥)。

## 不在范围
- ❌ 微信/支付宝/Stripe 真接入(PAY-2/3)。
- ❌ 前端购买 UI(PAY-4,接 CREDITS-FE-001)。
- ❌ 试用、退款追扣、优惠券(spec 标 backlog/v2)。

## 流程
Claude1(本票)→ Codex1(TDD 实现)→ Codex2 测试 → PM 验收。
> 戒:金额服务端锁、履约幂等、事务、密钥只进 .env、勿带临时文件/worktree 污染。
