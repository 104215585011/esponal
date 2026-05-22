# TALK-001 — 对话气泡内的西语点击查词

**优先级**：P2（即时见效的 UX 一致性）
**区域**：talk / web / vocabulary
**依赖**：TALK 集成 P3 ✅、VOCAB-008 ✅（LookupCard）、VOCAB-009 ✅（统一查词组件）

---

## 背景

`/talk/[characterId]` 里 AI 的回复目前是纯文本 `<p>{message.content}</p>`。
学习者读到 Carlos 说 `«hubiera ido»` 想查词时，只能复制粘贴去别处查——
和 `/lectura` 已经一致提供的「点任意词查义 + 加入词库」体验严重断层。

VOCAB-008 已有 `LookupCard`，VOCAB-009 让全站统一可点。
**对话气泡是最后一处遗漏的西语文本**。

## 范围

### 做

- AssistantMessage 渲染：把 `whitespace-pre-wrap text` 换成 token 化渲染（参考 `LecturaReader.tsx` 的 `splitParagraphTokens` + `normalizeLookupWord`）
- 每个西语 token 包一层 `<span>`，点击 → `LookupCard`，弹窗位置贴近被点的词
- WordEncounter 新增 source type **`"talk"`**（schema 不用动，sourceType 是 free string）
- LookupCard 的 `source.type = "talk"`，记录：
  - characterId（哪个老师说的）
  - sessionId（哪次会话）
  - messageIndex（会话内第几条）
  - sentence（整条消息原文）

### 不做（推迟）

- ❌ 用户自己消息也可点（用户的西语经常是输入错的，点了没意义）
- ❌ Carlos 之外角色的语言查词（Emma 英语、Sophie 法语等——Esponal 字典只覆盖西语）
- ❌ 流式中点击（等 done 事件再启用，避免点了一半字典查不到）

### 西语角色判定

只对 **Carlos**（`language: "Spanish (Mexico)"`）和未来任何 `id.startsWith("es-")` 的角色启用查词。
其他角色保持纯文本渲染，避免英语/法语/日语错误进入西语词库。

## 验收

- [ ] 与 Carlos 对话后，AI 回复里每个西语单词可点击
- [ ] 点击弹 LookupCard，正确显示 lemma + 中文 + 例句
- [ ] 「加入词库」后再去 `/vocab` 能看到，source 显示「talk · Carlos」
- [ ] Emma 等非西语角色的回复**不**可点（仍是纯文本）
- [ ] 流式生成中点击不出错
- [ ] 200/200 测试通过

## 技术草图

```tsx
// TalkClient.tsx 抽出 AssistantBubble 组件
function AssistantBubble({ message, characterId, locale, sessionId, messageIndex }) {
  if (!locale.startsWith("es")) {
    return <p className="whitespace-pre-wrap">{message.content}</p>;
  }
  return <ClickableSpanishText
    text={message.content}
    source={{ type: "talk", characterId, sessionId, messageIndex, sentence: message.content }}
  />;
}
```

复用 VOCAB-009 的 `ClickableSpanishText` 组件（如已抽出）。

## 成本估计

**0.5-1 天**（抽组件 + 接 LookupCard + source type 新增 + 测试）
