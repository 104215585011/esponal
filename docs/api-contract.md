# Esponal API 契约(原生 App 视角)

> 2026-11-13 · PLATFORM-001 P0 产出 · 服务于 Expo / React Native 客户端
> 验证方式:`node scripts/verify-mobile-auth.mjs`(本地) / `BASE_URL=https://www.pcmuz.cn node scripts/verify-mobile-auth.mjs`(线上)

---

## 一、通用约定

### Base URL
| 环境 | 地址 |
|---|---|
| 生产 | `https://www.pcmuz.cn` |
| 本地 | `http://127.0.0.1:3017`(e2e)/ `http://localhost:3000`(dev) |

### 鉴权:双通道
所有业务接口同时接受两种凭证,**解出来的是同一个 userId**:

| 客户端 | 方式 | 示例 |
|---|---|---|
| Web | NextAuth HttpOnly cookie | 浏览器自动携带,无需处理 |
| **原生 App** | `Authorization: Bearer <accessToken>` | `Authorization: Bearer eyJhbGci...` |

**规则**
- 带了 `Authorization` 就只认它,不再回退 cookie(避免"过期 token + 陈旧 cookie"身份串味)。
- 未登录 / token 无效 / token 过期 → 统一 `401`,`{ error: "Unauthorized" }`。
- **App 端的处理**:收到 401 → 用 `refreshToken` 调 `/api/mobile/auth/refresh` → 换到新 token 后**重放原请求一次**。refresh 也 401 → 清本地 token,跳登录页。

### 错误格式
```json
{ "error": "人类可读描述", "code": "MACHINE_CODE" }
```

| code | 含义 | App 应对 |
|---|---|---|
| `INVALID_CREDENTIALS` | 邮箱或密码错 | 提示用户,不区分哪个错 |
| `INVALID_REFRESH_TOKEN` | refreshToken 无效/过期/已用过 | 清 token → 登录页 |
| `RATE_LIMITED` | 触发限流 | 按 `retryAfterSec` 倒计时 |
| `USER_NOT_FOUND` | token 有效但账号已删 | 清 token → 登录页 |

### 分页(统一,新接口必须遵守)
```
GET /api/xxx?cursor=<lastId>&limit=20
→ { items: [...], nextCursor: string | null }
```

---

## 二、认证接口(新增)

### POST /api/mobile/auth/login
App 唯一登录入口。密码校验与 Web 端 credentials provider 完全一致。

**请求**
```json
{ "email": "user@example.com", "password": "secret" }
```

**响应 200**
```json
{
  "accessToken": "eyJhbGciOiJkaXIi...",
  "refreshToken": "25aba58565ba4f9c...",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 2592000,
  "tokenType": "Bearer",
  "user": { "id": "cmpn...", "email": "...", "name": "...", "image": null, "plan": "free" }
}
```

**失败**
| 状态 | code | 场景 |
|---|---|---|
| 400 | `INVALID_INPUT` | 缺 email 或 password |
| 401 | `INVALID_CREDENTIALS` | 邮箱不存在 / 密码错(故意不区分) |
| 429 | `RATE_LIMITED` | 超 5 次/分钟(按 IP) |

> 限流:5 次/分钟。App 侧应在 429 时禁用提交按钮并显示倒计时。

### POST /api/mobile/auth/refresh
**轮换**:旧 refreshToken 立即作废,返回新的一对。

**请求**
```json
{ "refreshToken": "25aba..." }
```

**响应 200**
```json
{ "accessToken": "...", "refreshToken": "...", "accessTokenExpiresIn": 900, "refreshTokenExpiresIn": 2592000, "tokenType": "Bearer", "user": {...} }
```

**失败 401** `INVALID_REFRESH_TOKEN` —— 无效/过期/**已被使用过**(重放)

> App 端注意:**并发刷新要用单飞(single-flight)锁**。两个请求同时 401 会各自发起 refresh,第二个必然失败(rotation),导致误踢登录态。

### POST /api/mobile/auth/logout
吊销 refreshToken。accessToken 是无状态 JWT 无法吊销,但 15 分钟自然过期。

**请求** `{ "refreshToken": "..." }`(可选)
**响应** `{ "ok": true }`

---

## 三、Token 生命周期

```
login
  ├─ accessToken   15 分钟   → 放内存 / 短期存储
  └─ refreshToken  30 天     → expo-secure-store(Keychain / Keystore)

每次请求:Authorization: Bearer <accessToken>
  ├─ 200 → 正常
  └─ 401 → refresh(单飞)
        ├─ 200 → 存新 token,重放原请求 1 次
        └─ 401 → 清空 token,跳登录页
```

**安全约束**
- refreshToken 服务端只存 sha256(redis `mobile:rt:<sha256>`),泄漏 DB 也无法还原明文。
- **不要**把 accessToken 存 AsyncStorage 明文;用 `expo-secure-store`。
- 一期 refreshToken 存 Redis(零 schema 变更)。Redis 重启会导致已登录用户需重新登录,可接受;二期若要强持久化再落库。

---

## 四、已支持 Bearer 的业务接口

### ✅ 已完成(样板,可作为实现范式)
| 接口 | 鉴权模式 | 说明 |
|---|---|---|
| `GET /api/vocab/review` | **必需** | 待复习词列表 + totalDue |
| `GET /api/subtitle?v=&lang=` | **可选** | 公开资源,登录后限流 key 不同 |
| `POST /api/translate` | **可选** | 匿名也能翻,登录后按用户限流 |

**两种模式的实现差异**

```ts
// 必需登录
const userId = await getAuthedUserId(request);
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// 可选登录(匿名可用)
const userId = await getOptionalUserId(request);   // 永不抛错,无 token 返回 null
```

### ⏳ 待改造(剩余 44 个)
全部 `src/app/api/**/route.ts` 里仍在用 `getServerSession(getAuthOptions())` 的接口。
纯机械替换,但有三个坑:
1. `GET()` 无参的要改成 `GET(request: Request)`。
2. 只取 userId 用于限流的地方,用 `getOptionalUserId`。
3. 改造后跑 `npm test`(529 条)兜回归。

### 🔨 待新增(页面级聚合,给 App 首屏用)

| 接口 | 服务的屏幕 | 需要的字段 |
|---|---|---|
| `GET /api/home/summary` | 首页 | 收藏词数、已读篇数、连续天数、继续学习目标 |
| `GET /api/lectura/stories` | 阅读 tab | 分级列表(标题/难度/时长/封面/已读状态) |
| `GET /api/vocab/list` | 语料库 | 分页 + 筛选(状态/词性/来源) |
| `GET /api/membership/status` | 会员页 | 套餐、额度、到期时间 |
| `GET /api/account/summary` | 我的 | 用户信息 + 积分 + 学习统计 |
| `GET /api/review/summary` | 复习 tab | 今日待复习数、今日已完成、streak |

---

## 五、App 端请求封装参考

```ts
// src/api/client.ts
import * as SecureStore from "expo-secure-store";

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // 单飞:并发的 401 只会触发一次 refresh
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) return null;

      const res = await fetch(`${BASE}/api/mobile/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) {
        await SecureStore.deleteItemAsync("refreshToken");
        await SecureStore.deleteItemAsync("accessToken");
        return null;
      }

      const data = await res.json();
      await SecureStore.setItemAsync("accessToken", data.accessToken);
      await SecureStore.setItemAsync("refreshToken", data.refreshToken);
      return data.accessToken as string;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function apiFetch(path: string, init: RequestInit = {}, retry = true) {
  const token = await SecureStore.getItemAsync("accessToken");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (res.status === 401 && retry) {
    const next = await refreshAccessToken();
    if (next) return apiFetch(path, init, false);   // 只重放一次
  }
  return res;
}
```

---

## 六、验收清单(已全部通过,23/23)

| # | 断言 | 结果 |
|---|---|---|
| 1 | 登录返回 200 + 双 token | ✅ |
| 2 | accessToken TTL = 900s | ✅ |
| 3 | refreshToken TTL = 2592000s | ✅ |
| 4 | 错误密码 → 401 `INVALID_CREDENTIALS` | ✅ |
| 5 | 业务接口无 token → 401 | ✅ |
| 6 | 业务接口坏 token → 401 | ✅ |
| 7 | 业务接口 Bearer → 200 且返回真实数据 | ✅ |
| 8 | 字幕匿名 / Bearer 均可访问 | ✅ |
| 9 | 翻译 Bearer → 200 且返回译文 | ✅ |
| 10 | refresh → 新双 token | ✅ |
| 11 | 旧 refreshToken 重放 → 401 | ✅ |
| 12 | 新 accessToken 可用 | ✅ |
| 13 | logout → 200 | ✅ |
| 14 | 注销后 refresh → 401 | ✅ |

复跑命令:
```bash
npm run seed:e2e                       # 幂等创建测试账号
node scripts/verify-mobile-auth.mjs    # 23 条断言
```
