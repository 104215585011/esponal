# EXT-008-FIX2 — ingest 路由加 CORS 头

**优先级**：P0（FIX 落地后端到端再次失败，CORS 拦截）
**类型**：FIX-of-FIX
**触发**：PM 端到端测试，2026-05-21

---

## 病症

FIX1（hook timedtext）实施后，PM 重新打包扩展、装到 Chrome、打开 YouTube 视频并开启 CC，DevTools Network 看到：

- ✅ Hook 拦截成功（initiator 显示 `hook-timedtext.js`）
- ✅ Preflight `OPTIONS` 返回 204
- ❌ 实际 `POST /api/subtitle/ingest` 失败，**0 字节、`net::ERR_FAILED`**

Console 报错：
```
Access to fetch at 'https://esponalsssssss.vercel.app/api/subtitle/ingest'
from origin 'https://www.youtube.com' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 根因

我们 ingest 路由是从扩展 content script 跨域调用（origin `https://www.youtube.com` → `https://esponalsssssss.vercel.app`），且发送了自定义 header `X-Esponal-Ingest-Token`，浏览器**必须**先做 CORS preflight `OPTIONS` 请求。

当前 `src/app/api/subtitle/ingest/route.ts`：
- **没**导出 `OPTIONS` handler → Next.js 默认 OPTIONS 响应 204 但**不含 CORS 头**
- POST 响应也**没**带 `Access-Control-Allow-Origin`

浏览器看不到合法的 CORS allow 头 → 拦截实际 POST。

注：扩展 manifest 的 `host_permissions: ["https://*.vercel.app/*"]` 在 MV3 下**不能**自动豁免自定义 header 触发的 CORS preflight。服务端必须显式回 CORS 头。

---

## 修复方案

### 改一个文件：`src/app/api/subtitle/ingest/route.ts`

在文件顶部加常量 + 新增 OPTIONS handler + 给所有 NextResponse.json 加 CORS 头。

```typescript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Esponal-Ingest-Token",
  "Access-Control-Max-Age": "86400"
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// 给所有 POST 中的 NextResponse.json(...) 加 headers
// 例如:
//   return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
```

建议抽个 helper 避免每条都贴：

```typescript
function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) }
  });
}
```

然后把所有 `NextResponse.json(...)` 替换成 `jsonResponse(...)`。

### CORS Origin 范围讨论

用 `"*"` 简单但接受**任意**来源 POST。本路由有 token 校验 + IP rate limit，安全模型已足够。`"*"` 完全够用。

如果想更严，可读 `request.headers.get("origin")`，仅允许 `https://www.youtube.com` 和 `https://*.youtube.com`。但**不推荐**——扩展从其他 YouTube 子域（如 `m.youtube.com`、`music.youtube.com`）抓字幕时会需要扩展白名单，徒增维护成本。

---

## 验收标准

| # | 检查项 |
|---|---|
| 1 | `src/app/api/subtitle/ingest/route.ts` 含 `OPTIONS` handler 返回 204 + 4 个 CORS headers |
| 2 | 所有 `NextResponse.json(...)` 响应都带 `Access-Control-Allow-Origin: *`（grep 验证或用 helper 统一） |
| 3 | `tests/ext008.test.mjs` 加契约测试：模拟 OPTIONS 请求返回 204 含 CORS headers；模拟 POST 200 响应也含 `Access-Control-Allow-Origin` header |
| 4 | `npm test` 通过 |
| 5 | `npm run build` 通过 |
| 6 | **端到端测试**：commit 后必须 push 到 Vercel 触发部署；PM 重新打开 YouTube 视频，Network 看到 POST 200 + `cueCount > 10` + 扩展图标绿 ✓ |

第 6 条**这次必须做**——FIX2 是修生产 bug，没有线上验证就是把皮球踢回 PM 再发现没好。Codex1 自己跑 npm test 不算端到端验证。

PM（Claude1）会在 Codex1 commit 后亲自 push 并验证。如果 Codex1 有 push 权限，可以自己 push。

---

## 文件触动清单

| 文件 | 变更 |
|------|---|
| `src/app/api/subtitle/ingest/route.ts` | 新增 OPTIONS handler + 所有 response 加 CORS headers |
| `tests/ext008.test.mjs` | 加 OPTIONS 契约 + POST 响应 CORS header 契约 |
| `session-handoff.md` | Dev Report |
| `feature_list.json` | EXT-008 status 维持 `ready_for_qa`，evidence 补充 FIX2 工作 |
