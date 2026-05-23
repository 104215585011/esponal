# TALK-004 — 语音直传给模型（不经文本转写，让 AI 听发音）

**优先级**：P3（差异化卖点，但技术投入大）
**区域**：talk / model / research
**依赖**：TALK 集成 P3 ✅

---

## 背景

PM 反复确认（2026-05-23 二次澄清）：

> "我之前说的，我发的语音不需要转文字，发出像语音消息那样的就好，
> 你知道微信聊天吗？做成那种逻辑就可以"

### 完整 UX（微信式语音消息）

**用户侧**：
- 按住麦克风按钮录音（"按住说话" 不是 "点击切换"）
- 松开 → 消息以**音频气泡**形式发出，**不显示转写文本**
- 气泡显示：🔊 0:03（时长） · 点击可重放
- 可选：长按气泡 → "转为文字" 二级动作（参考微信）——v2 再做

**AI 侧**：
- 接收原始音频（不经过本地 STT）
- 回复时同时输出两路：
  1. 「发音观察」：「'r' 颤音不够，听起来像 'l'」一类即时反馈
  2. 正常对话回复（文字 + TTS 语音，沿用现有 /api/talk/synthesize）

### 当前架构与目标的 gap

```
现在：录音 → 浏览器 Web Speech API STT → 文字 → DeepSeek → 文字回复 → Fish Audio TTS
目标：录音 → audio Blob 直传 → 多模态模型 → 文字+发音反馈 → Fish Audio TTS
```

**这是 Esponal 区别于 ChatGPT 的核心卖点**：
对口语学习者，发音纠正比内容理解还重要。
微信式音频气泡保留了"我说了什么"的完整证据（用户可重听自己刚才发音），
这本身就是学习材料。

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
- **前端改造（微信式语音气泡）**：
  - 麦克风按钮改为**按住录音、松开发送**（替换当前的点击切换）
  - 录音时按钮变红 + 显示时长 0:01 / 0:02 ...（上限 60s）
  - 松开后立即在消息流插入「user audio bubble」：🔊 0:03 + 点击播放
  - **不显示转写**——音频本身就是消息
  - 移除现有"识别→文本→发送"链路（浏览器 STT 留作 fallback）
- **数据模型**：
  - `ChatMessage` 新增 `audioUrl: String?` 列（migration）
  - 上传音频到 Vercel Blob / R2 / Supabase Storage（具体选型放在实施阶段决定）
  - 转写文本（如果模型返回了）存在 content 字段中加密
- **system prompt 增强**：
  ```
  When the user sends audio, do TWO things in your reply:
  1. Note any pronunciation issues you heard, gently (one short line at the top).
  2. Continue the conversation naturally based on what they said.
  Always reply in Spanish (Mexico) for Carlos.
  ```
- **降级链路**：模型说听不清 / API 失败 → 自动 fallback 到 Web Speech API STT + DeepSeek
  - fallback 时仍显示音频气泡（用户体验一致），只是 AI 回复中可能不带发音反馈

### 不做（本 ticket 范围外）

- ❌ Realtime 流式双向（v2，复杂度 + 价格双高）
- ❌ 让其他角色也用 audio model（先只 Carlos 验证）
- ❌ 自动比对学习者发音 vs 标准发音（需要专门的 ASR + 音素对齐技术）

## 验收

- [ ] Carlos 角色按住麦克风录音、松开发送（不再是点击切换）
- [ ] 录音时按钮变红 + 实时显示时长 0:01 / 0:02 ...
- [ ] 松开后消息流出现🔊 0:03 音频气泡，点击可重放自己的录音
- [ ] AI 回复包含「发音观察」一行 + 正常对话回复
- [ ] AI 回复气泡仍是 Fish Audio TTS 自动播放（沿用现有逻辑）
- [ ] 故意说错（如错把 "ll" 发成 "l"），AI 能指出来
- [ ] 模型 / API 失败时自动退回 Web Speech STT + DeepSeek，用户看到的仍是音频气泡（无感降级）
- [ ] 录音上限 60s，超过自动停止并发送
- [ ] 单次请求 ≤ 30s 内返回（包括 audio upload）
- [ ] DB 里 ChatMessage 新增 audioUrl 列；旧消息 audioUrl=null 不影响渲染

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
