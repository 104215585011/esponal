# 支付系统设计 spec (PAY)

> 2026-06-05 · Claude1(PM)起草 · 配合积分引擎(`src/lib/credits/`)+ 计费 spec(`2026-06-01-credits-billing-design.md`)

## 0. 前提与决策(已与产品确认)
- **主体**:有营业执照/公司 → 可开通微信支付、支付宝**企业商户号**(走正规网页支付 + API 回调)。
- **渠道**:国内(微信支付 + 支付宝)+ 海外(Stripe)**都要** → **provider 可插拔**设计。
- **v1 不做自动续费(委托代扣)**:月/年 = 购买一段有效期,终身 = 买断;到期前**站内提醒手动再购**。理由:代扣资质门槛高、我们的"有效期 + 配额"模型本就适合一次性下单。
- 一切商户密钥/私钥**只进 `.env`,不进 git**。

## 0b. 部署拓扑(2026-06-05 定)
- **国内用户全部自带 VPN**(目标=认真学习者),主站可留 **Vercel**(用户能访问 + 服务器能抓 YouTube/Google API)。
- **矛盾**:阿里云大陆节点访问不了 YouTube/Google;但国内支付(微信/支付宝)商户号要求**备案域名 + 大陆托管**。
- **方案=混合部署**:
  - **境外(Vercel)**:主站 + watch/字幕/YouTube 抓取 + 海外支付适配器(Paddle/PayPal)。
  - **大陆备案站(阿里云大陆,轻量)**:微信/支付宝**收银台 + 回调**,持商户号,跑国内支付适配器;**不碰 YouTube**。
  - 两边**共享同一 DB + 积分引擎**;主站"立即购买"→ 调大陆备案域名收银台 → 用户付款 → 回调打大陆站 → 写同库履约。
  - 靠字幕 30 天 Redis 缓存把跨境调用压到最低。
- 备案:用营业执照办,约 1–3 周;只需备案"轻量大陆站"那个域名/子域。

## 1. 范围
做:下单 → 拉起支付 → 支付回调 → 履约(开通/续期会员 + 发配额 + 记流水)→ 查单/对账 → 退款(后台手动)。
不做(v1):自动续费扣款、发票系统、优惠券/促销码(留 v2)、分销。

## 2. 商品(来自计费 spec,价格分为单位 ×100)
| plan | cycle | 价格 | 履约:配额 | 有效期 | creditSource |
|---|---|---|---|---|---|
| pro | month | ¥38 | 每月 500 | +30 天 | subscription(月度覆盖) |
| pro | year | ¥365 | 每月 500 | +365 天 | subscription |
| ultra | month | ¥48 | 每月 1000 | +30 天 | subscription |
| ultra | year | ¥458 | 每月 1000 | +365 天 | subscription |
| pro | lifetime | ¥1498 | 每月 500 累加 | 永久 | lifetime(累加) |
| ultra | lifetime | ¥1998 | 每月 1000 累加 | 永久 | lifetime |
> 付费档含 3 天试用(试用逻辑单列,见 §7)。终身限量 500(库存计数,见 §8)。

## 3. 数据模型(Prisma 新增)
```prisma
model PaymentOrder {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields:[userId], references:[id])
  plan           Plan                       // pro | ultra
  cycle          BillingCycle               // month | year | lifetime
  provider       PaymentProvider            // wechat | alipay | stripe
  amountMinor    Int                        // 实付(分),下单时锁定
  currency       String   @default("CNY")   // CNY | USD
  status         OrderStatus @default(pending)
  providerTxnId  String?  @unique           // 渠道流水号(履约幂等键)
  idempotencyKey String   @unique           // 防重复下单
  createdAt      DateTime @default(now())
  paidAt         DateTime?
  fulfilledAt    DateTime?                  // 履约完成时间(二次幂等)
  refundedAt     DateTime?
  rawCallback    Json?                      // 存回调原文便于对账/排查
}
enum BillingCycle { month year lifetime }
enum PaymentProvider { wechat alipay stripe }
enum OrderStatus { pending paid fulfilled failed expired refunded }
```
- User 已有 `plan/creditSource/planExpiresAt/lastRefillAt`(积分引擎已建)。续期 = 延长 `planExpiresAt`。

## 4. 订单状态机
```
pending ──(回调:支付成功+验签)──> paid ──(履约成功)──> fulfilled
   │                                  
   ├─(超时未支付/回调失败)──> expired / failed
   └─(已 fulfilled 后退款)──> refunded(撤销会员)
```
- **履约幂等**:以 `providerTxnId` 为键;`fulfilledAt` 已有则直接返回成功,**绝不重复发配额/重复升级**。
- 履约在 `prisma.$transaction` 内:写 Order.fulfilled + 更新 User(plan/creditSource/planExpiresAt/lastRefillAt)+ 调积分引擎发配额 + 写 `CreditTransaction(reason=purchase)`。

## 5. 履约逻辑(与积分引擎衔接)
- **月/年订阅**:`creditSource=subscription`,`planExpiresAt = max(now, 现有到期) + 周期`,本月配额按档**覆盖**(subscription 月度覆盖不结转,沿用 `applyMonthlyRefill`),`lastRefillAt=now`。
- **终身**:`creditSource=lifetime`,无 `planExpiresAt`,当月发一档配额,之后每月**累加**(`refreshCreditsIfDue` 已支持 lifetime 累加)。
- **升级**(低档→高档,同周期内):v1 简单做 = 直接新下单覆盖为高档(不退差价);v2 再做按比例补差价。**降级**:不支持即时,到期自然回落。
- **到期回落**:惰性 —— 任意受 `requireCredits`/`requirePlan` 的动作里,若 `planExpiresAt < now` 则降为 free(沿用引擎读取路径加判断;Phase 2 补此判断)。

## 6. 接口(provider 无关外层 + 适配器内层)
- `POST /api/pay/order` — 入参 `{plan,cycle,provider}`,服务端**按 §2 表锁定金额**(绝不信前端价),建 pending 订单,返回 `{orderId, payload}`(微信=二维码/JSAPI 参数;支付宝=跳转 url;Stripe=Checkout Session url)。
- `POST /api/pay/webhook/wechat` `/alipay` `/stripe` — 各自**验签** → 幂等履约 → 按渠道要求回 ACK。
- `GET /api/pay/order/:id` — 前端轮询/回跳后查状态。
- 适配器接口 `PaymentProvider { createCharge(order), verifyWebhook(req), parseTxn(req) }`,三家各实现一份;外层逻辑共用。

## 7. 试用(3 天)
- 付费档首次订阅给 3 天试用:下单即开通会员有效期但**支付为 0 元试用单或先授权后扣**——v1 简化:试用 = 不下单直接给 3 天 pro/ultra 权限 + 一次性试用配额额度,到期需购买。试用资格 `User.trialUsedAt` 防重复。**(细节 v1 可先不接,标 backlog)**

## 8. 终身限量
- `lifetime` 库存计数(配置 500/档 或共享)。下单前校验剩余,履约时原子扣减。售罄则该卡片 CTA 置灰"已售罄"。

## 9. 安全与对账
- 回调**必须验签**(微信 V3 证书/平台公钥、支付宝 RSA2、Stripe webhook secret),验签失败拒绝。
- 幂等:`providerTxnId` 唯一 + `fulfilledAt` 双保险,防回调重放/重复到账。
- **主动对账**:定时任务查 pending 超时订单 → 反查渠道真实状态 → 补履约或置 expired;每日对账金额。
- 金额服务端锁定,前端只传商品标识。
- 退款:后台手动发起 → 渠道退款 API → 回调置 refunded → 撤销/降级会员(配额处理策略需定:扣回未用?v1 简单不扣回,标注)。

## 10. 分期实施
- **PAY-1 provider 无关核心**(现在可做,不依赖资质):Prisma 模型 + 订单状态机 + 履约(接积分引擎)+ 幂等/事务 + `GET 查单`;用 **mock/sandbox provider** 跑通"下单→标记支付→履约→会员开通+配额到账"。TDD。
- **PAY-2 微信支付 + 支付宝**:企业商户号、验签、二维码/跳转、回调、对账。需 `.env` 配商户密钥。
- **PAY-3 海外**:**优先 MoR(Paddle / Lemon Squeezy)或 PayPal**(无需海外公司实体,提现可走 Wise/Payoneer);Stripe 待有海外/香港主体再说。部署在 Vercel 境外站。
- **PAY-4 前端**:`/membership` 购买按钮接 `POST /api/pay/order` + 支付 UI(二维码弹层/跳转)+ 回跳查单 + 成功态;与 CREDITS-FE-001 的状态显隐对接。

## 11. 风险
- 资质/商户号开通有审核周期 → PAY-1 先行不阻塞。
- 自动续费缺失 → 靠到期提醒 + 手动续费的留存运营弥补(v2 再评估代扣)。
- 退款后配额已消费 → v1 政策:不追扣,文档写明。
