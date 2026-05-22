# TALK-004 — 语音直传给模型（不经文本转写，让 AI 听发音）

**优先级**：P3（差异化卖点，但技术投入大）
**区域**：talk / model / research
**依赖**：TALK 集成 P3 ✅

---

## 背景

PM 提出：

> "我们其实最好输出给对面的是语音的话就不要转文字，这样子如果我的发音有问题它也可以帮我及时纠正。"

当前流程：
```
用户说话 → 浏览器 STT 转文字 → 文字发给 DeepSeek → DeepSeek 不知道发音
```

理想流程：
```
用户说话 → 录音直接发给「能听音」的模型 → 模型反馈发音 + 内容回复
```

**这是 Esponal 区别于 ChatGPT 的核心卖点**：
对口语学习者，发音纠正比内容理解还重要。

## 关键技术风险

**DeepSeek 不支持 audio input**。要做这个功能，必须换模型：

| 候选模型 | Audio in | 西语支持 | 价格（粗估，per minute audio）| 备注 |
|---|---|---|---|---|
| **GPT-4o Realtime API** | ✅ 流式 | 强 | $0.06 input + $0.24 output | 真双向流式对话，体验最好 |
| **GPT-4o-audio-preview** | ✅ 文件 | 强 | 较高 | 非实时，但可纠正发音 |
| **Gemini 2.0 Flash** | ✅ | 一般 | 便宜 | 西语没 GPT 强 |
| Claude（Anthropic） | ❌ | — | — | 现阶段无 audio in |
| DeepSeek | ❌ | — | — | 现阶段无 |

⚠️ **任一选项都会显著增加运营成本**——你的 DeepSeek 几乎免费，
GPT-4o Realtime 是它的 100-1000 倍。先评估付费意愿再启动。

## 范围

### 做（需要先决策）

- **模型选型**：建议先做 **GPT-4o-audio-preview**（非实时，一问一答），
  风险可控、迁移最小。流式 Realtime 留到 v2。
- **新 model-client**：`createAudioModelClient()` 接受 audio bytes + character prompt
- **前端改造**：
  - 移除"识别→文本→发送"链路
  - 改为：录音 → POST audio Blob → 等模型返回 → 收文本回复 + 发音反馈
  - 视觉：用户消息显示为「🎙 0:03 [waveform]」而非文本
- **system prompt 增强**：
  ```
  When the user sends audio, do TWO things in your reply:
  1. Note any pronunciation issues you heard, gently (one short line at the top).
  2. Continue the conversation naturally based on what they said.
  ```
- **降级链路**：模型说听不清 / API 失败 → 自动 fallback 到 Web Speech API + DeepSeek

### 不做（本 ticket 范围外）

- ❌ Realtime 流式双向（v2，复杂度 + 价格双高）
- ❌ 让其他角色也用 audio model（先只 Carlos 验证）
- ❌ 自动比对学习者发音 vs 标准发音（需要专门的 ASR + 音素对齐技术）

## 验收

- [ ] Carlos 角色启用音频模式开关（默认开）
- [ ] 录音说"Hola Carlos"，AI 回复里包含「发音观察」一行 + 正常对话
- [ ] 故意说错（如错把 "ll" 发成 "l"），AI 能指出来
- [ ] 失败时自动退回 STT + DeepSeek 链路，用户无感
- [ ] 单次请求 ≤ 30s 内返回（包括 audio upload）
- [ ] DB 里用户消息存音频 URL（或 base64）+ 转写文本

## 成本估计

**3-5 天**（研究 + model client + 改前端 + 错误链路 + 联调）
**外加月度运营成本**：取决于使用量。100 分钟对话 ≈ $30。

## 强烈建议先做的事

**不要先编码**。先做一个原型脚本：

```bash
# 用 GPT-4o-audio-preview 跑一个手动样例
node scripts/test-audio-model.mjs path/to/sample.webm
```

听听 AI 真能不能纠正发音、纠正质量好不好、延迟多少。
**如果效果不行，整张 ticket 都白做**。这一步成本 2 小时。

---

## 不动手前我的判断

这 ticket 的**承诺**很有诱惑——但要么投入大、要么效果不及预期。
个人建议优先级：先 TALK-001（点查词）+ TALK-002（会话列表）+ TALK-003（归档），
让现有体验完整起来，等真有付费用户验证了价值再启动 TALK-004。
