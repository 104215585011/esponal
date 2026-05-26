# VOCAB-010 — LookupCard 已标记状态

**优先级**：P1（用户体验基础修复）
**区域**：vocab
**依赖**：VOCAB-004（LookupCard 已存在）

---

## 背景

用户点击一个之前已加过词库的词，「加入我的词库」按钮显示的仍是绿色默认状态，
用户不知道自己已经保存过这个词，可能重复点击，或者误以为词库功能没有生效。

期望行为：打开 LookupCard 时，若该词（lemma）已在用户词库里，
按钮应立即显示为**黄色 + 不可点击 + 「已加入词库」**。

---

## 范围

### 做

**Step 1 — API 扩展**：`GET /api/vocab/lookup?word=...` 响应新增 `isSaved: boolean` 字段。
- 若用户已登录且该词的 lemma 在 `Word` 表中有对应记录 → `isSaved: true`
- 未登录 / 未保存 → `isSaved: false`

**Step 2 — ButtonState 扩展**：新增 `"already_saved"` 状态。

**Step 3 — LookupCard 逻辑**：
- `lookupWord()` 拿到响应后，若 `payload.isSaved === true` → `setButtonState("already_saved")`
- 其余逻辑不变

**Step 4 — 样式**：

| 状态 | 背景 | 文字 | 可点击 |
|---|---|---|---|
| `default` | `bg-brand-50` | `加入我的词库` | ✅ |
| `loading` | `bg-brand-50 opacity-70` | `保存中...` | ❌ |
| `success` | `bg-brand-50` | `已加入词库` | ❌ |
| `already_saved` | `bg-amber-50` | `已加入词库` | ❌ |
| `disabled` | `bg-gray-100` | 视查词状态 | ❌ |

`already_saved` 具体样式：`bg-amber-50 text-amber-600 cursor-default`

### 不做

- ❌ 移除词库功能（不在本票范围）
- ❌ 「再次加入」覆盖写入

---

## 验收标准

- [ ] `/api/vocab/lookup` 响应包含 `isSaved: boolean`
- [ ] 已登录用户点击已保存词 → 按钮立即显示 `bg-amber-50 text-amber-600`「已加入词库」
- [ ] 未登录用户 → `isSaved: false`，行为不变
- [ ] 未保存词 → `isSaved: false`，绿色按钮正常显示
- [ ] `already_saved` 状态按钮不可点击
- [ ] 在 `/lectura`、`/watch`、`/dissect`、`/talk` 各入口均生效（LookupCard 共享）
- [ ] npm test 通过

## 成本估计

**0.5 天**
