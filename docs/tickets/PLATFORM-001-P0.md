# PLATFORM-001-P0 — 双通道鉴权与 Token 体系【已实现】

> 2026-11-13 · 实现:Codex(本机) · 验收:`npm test` 529/529 + `scripts/verify-mobile-auth.mjs` 23/23
> 父票:`PLATFORM-001-native-app.md`(架构方案)· 前置:`PLATFORM-000`(隔离与上架)

---

## 一、这一刀解决了什么

**核心问题**:47 个 API 全靠 NextAuth 的 HttpOnly cookie 认人,**原生 App 没有 cookie,直接调会全部 401**。这是 Expo/RN 迁移的第一道墙。

**解法**:不动 NextAuth 配置,在 API 侧加双通道。App 拿到的 JWT 就是 NextAuth 自己用同一个 `NEXTAUTH_SECRET` 签的,**两条通道解出同一个 userId,账号体系不分叉**。

---

## 二、新增文件

| 文件 | 作用 |
|---|---|
| `src/lib/api-auth.ts` | 双通道鉴权 helper:`getAuthedUserId` / `getOptionalUserId` / `verifyBearerToken` |
| `src/lib/mobile-token.ts` | accessToken 签发(15min)、refreshToken 签发/轮换/吊销(30 天,Redis) |
| `src/app/api/mobile/auth/login/route.ts` | 登录,复用 bcrypt 校验,限流 5 次/分钟 |
| `src/app/api/mobile/auth/refresh/route.ts` | 轮换 refreshToken |
| `src/app/api/mobile/auth/logout/route.ts` | 吊销 refreshToken |
| `scripts/verify-mobile-auth.mjs` | 23 条断言的回归脚本,带退出码可接 CI |
| `docs/api-contract.md` | API 契约(App 端施工依据) |

### 改造文件

| 文件 | 改动 |
|---|---|
| `src/lib/ratelimit.ts` | 新增 `loginLimiter`(5 次/分钟) |
| `src/app/api/vocab/review/route.ts` | `getServerSession` → `getAuthedUserId`(必需登录范式) |
| `src/app/api/subtitle/route.ts` | → `getOptionalUserId`(可选登录范式) |
| `src/app/api/translate/route.ts` | → `getOptionalUserId`(限流 key) |
| `tests/vocab006.test.mjs` | 断言从「必须用 getServerSession」改为「必须有鉴权(cookie 或 Bearer)」 |
| `tests/credits-phase2.test.mjs` | 同上 |

---

## 三、关键设计决策

### 1. refreshToken 存 Redis,不新建 Prisma 表
- **理由**:一期零 schema 变更 = 零生产迁移风险。这是"稳妥版"的核心诉求。
- **代价**:Redis 重启会丢 token,已登录用户需重新登录(可接受)。
- **二期**:若需强持久化,新建 `MobileRefreshToken` 表即可,接口签名不变。

### 2. rotation(轮换)而非固定 refreshToken
每次 refresh 立刻删旧 key、发新 token。同一 token 第二次用必然失败。
- **收益**:泄漏的 token 被用过一次就失效,攻击窗口极小。
- **代价**:App 端**必须做单飞(single-flight)**,否则并发 401 会触发两次 refresh,第二次失败误踢登录态。这条已写进 `api-contract.md` 第五节参考代码。

### 3. 带 Bearer 就不回退 cookie
避免"过期 Bearer + 陈旧 cookie"混用导致身份串味。语义是:声明用哪个通道,就只认哪个。

### 4. 不区分「token 过期」与「token 伪造」
NextAuth 的 `decode` 对过期 JWT 会抛错,无法可靠区分。两者统一返回 `401`,
App 端标准做法就是「401 → 试 refresh」,不需要知道原因。这比造 `TOKEN_EXPIRED` code 更简单可靠。

### 5. 登录失败不暴露「邮箱是否存在」
邮箱不存在与密码错误返回完全相同的 `401 INVALID_CREDENTIALS`,防用户枚举。

---

## 四、证据

### 静态
- `npx tsc --noEmit` → 通过
- `node scripts/check-encoding.mjs` → 通过

### 单元测试
- `npm test` → **529 tests / 529 pass / 0 fail**
- 2 条测试有意改写(见上表):它们断言的是「必须用 getServerSession」这个实现细节,双通道后应断言「必须有鉴权」

### 端到端(真实数据库 + 真实 Redis)
`node scripts/verify-mobile-auth.mjs` → **23/23 通过**,覆盖:

1. 登录 200 + 双 token + 正确 TTL
2. 错误密码 401 `INVALID_CREDENTIALS`
3. 业务接口:无 token 401 / 坏 token 401 / 好 token 200 且返回真实生词数据
4. 字幕:匿名 200 / Bearer 200(可选登录范式)
5. 翻译:Bearer 200 且返回真实译文「你好」
6. refresh 轮换成功
7. **旧 refreshToken 重放 → 401**(rotation 生效)
8. 新 accessToken 可继续用
9. logout 后 refresh → 401(吊销生效)

### 实测样本

```bash
# 登录
curl -X POST http://127.0.0.1:3017/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@esponal.test","password":"test-e2e-password-2026"}'

# 用 Bearer 拿生词
curl http://127.0.0.1:3017/api/vocab/review \
  -H "Authorization: Bearer <accessToken>"
→ 200 {"dueWords":[{"id":"cmpnsuv4u...","lemma":"calor","translation":"热量；热",...}],"totalDue":...}
```

---

## 五、遗留与下一步

### 剩余工作
1. **44 个路由批量改造**(纯机械):
   - `GET()` → `GET(request: Request)`
   - `getServerSession(...)` → `getAuthedUserId` / `getOptionalUserId`
   - 每批改完跑 `npm test` + `verify-mobile-auth.mjs`
2. **6 个页面级聚合接口**(见 `api-contract.md` 第四节)
3. **错误格式与分页统一**(新接口直接遵守,老接口渐进)

### 已知限制
1. refreshToken 存 Redis,重启丢失 → 用户重新登录(非致命)。
2. accessToken 无法主动吊销(无状态 JWT),最长 15 分钟窗口。
3. 暂未加「设备管理 / 踢下线」能力,多设备登录各自持有独立 refreshToken,互不影响。
4. 测试账号 `e2e@esponal.test` 已写入生产库(与 Playwright e2e 共用),密码在 `scripts/seed-e2e-user.mjs` 里是公开默认值 —— **上架前必须改密码或删除该账号**。

---

## 六、给 App 端的三条硬约束

1. **token 存 `expo-secure-store`**,不许 AsyncStorage 明文。
2. **refresh 必须单飞**,否则 rotation 会误踢登录态。
3. **401 只重放一次**,避免死循环。
