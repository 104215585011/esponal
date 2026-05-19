# READ-001-FIX — Lectura 页面登录态丢失

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-19
**触发**：PM 在 Vercel 上线后测试发现 `/lectura` 和 `/lectura/[slug]` 不识别登录态
**关联**：READ-001 ✅ 结构功能通过 / 此 fix 修一个交付时遗漏的 SSR 配置

---

## Bug

`src/app/lectura/page.tsx` 和 `src/app/lectura/[slug]/page.tsx` 都写了：

```tsx
export const dynamic = "force-static";
```

但这两页都挂载了 `<SiteHeader />`，而 `SiteHeader` 内部调用 `getServerSession(getAuthOptions())` 读 cookie。`force-static` 让 Next.js 在 `npm run build` 阶段就把页面 HTML 烤好，此时**没有任何用户上下文**，session 永远是 null。

线上效果：
- 已登录用户进 `/lectura` 顶栏右上显示「登录」按钮（而不是自己的头像）
- 顶栏「词库」入口指向 `/auth/sign-in?callbackUrl=/vocab` 而不是直接到 `/vocab`
- 用户**已经登录但被当成游客**

`/watch`、`/vocab`、`/learn` 等页面都没踩这个坑，因为它们要么是 `force-dynamic`，要么没有 `dynamic` 配置（Next.js 自动按需 dynamic）。

---

## 修法

两个文件改一行：

`src/app/lectura/page.tsx`：

```ts
// 把
export const dynamic = "force-static";
// 改成
export const dynamic = "force-dynamic";
```

`src/app/lectura/[slug]/page.tsx`：同样改。

之所以不直接删 `dynamic = ...` 让 Next.js 自动判断——`getServerSession` 调用应该会自动强制 dynamic，**但**为了让代码意图明确（这页就是要读 cookie），显式 `force-dynamic` 更清楚，也跟 `/watch` 风格一致。

---

## 性能不必担心

- Lectura 内容本身是从 `content/lectura/*.ts` import 的 ES module 常量，不走数据库、不走外部 API
- 页面渲染只有 session 查询是动态的（几十毫秒）
- 不需要任何缓存策略调整

---

## 文件清单

**修改**：
- `src/app/lectura/page.tsx`（dynamic 改 force-dynamic）
- `src/app/lectura/[slug]/page.tsx`（同上）

**测试**：
- `tests/read001.test.mjs` 加两条断言：
  ```js
  assert.match(listPage, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(slugPage, /dynamic\s*=\s*"force-dynamic"/);
  ```
- 顺便加一条反断言（防回归）：
  ```js
  assert.doesNotMatch(listPage, /dynamic\s*=\s*"force-static"/);
  assert.doesNotMatch(slugPage, /dynamic\s*=\s*"force-static"/);
  ```

---

## 验收

1. `npm test` 通过（含新增的 4 条 dynamic 断言）
2. `npm run build` 通过——`/lectura` 和 `/lectura/[slug]` 在构建输出里应该是 **ƒ (Dynamic)** 标记，不是 **○ (Static)**
3. **PM 线上验**：登录后访问 Vercel 的 `/lectura`，顶栏右上看到自己的头像（不是登录按钮）；点「词库」直接进 `/vocab` 不绕登录页

---

## 不在本 ticket 范围内

- Lectura 阅读页本身的登录态使用（v1 阅读不需要登录、加入词库才需要）→ 现状已正确，不动
- 静态生成 + ISR 的更细优化 → 我们流量还没到这个量级
- 系统性审计其它 `force-static` 误用 → 暂未发现别的，遇到再说

---

## 注意

这是个**一行配置错误**，但表现出来是「整个产品都说我没登录」，给用户的体感很差。Codex1 修完后 PM 必须**真到 Vercel 上**点一次确认（不是本地 dev server，因为 dev server 永远是动态的，本地测不出这个 bug）。
