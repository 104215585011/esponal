# COURSE-004 — 批量生成课程单元 TTS 音频

**优先级**：P2 | **负责人**：Codex1 | **日期**：2026-05-15  
**前置依赖**：COURSE-003（单元页面实现）可并行进行，但音频需在验收前就绪

---

## 背景

9 个单元 JSON 文件（unidad-1.json ~ unidad-9.json）中，所有词汇、句型、对话的 `audioSrc` 字段均为空字符串。需要：

1. 用 TTS 批量生成每条西语文本的 MP3 音频
2. 将文件存到正确路径
3. 将 JSON 里的 `audioSrc` 填入对应路径

---

## TTS 方案

使用 **msedge-tts**（Node.js 包，调用 Microsoft Edge TTS 服务）：
- 免费，无需 API key，无需注册
- 西语声音：`es-ES-AlvaroNeural`（男声，自然流畅）
- 备选声音：`es-ES-ElviraNeural`（女声）

```bash
npm install msedge-tts
```

如果 `msedge-tts` 有兼容问题，备选：
- `edge-tts-node`
- 或调用系统 Python 的 `edge-tts`（`pip install edge-tts`）

---

## 文件路径规则

音频存放位置：
```
public/audio/units/unidad-N/
```

文件命名（slug 规则）：
- 西语文本转小写
- 空格 → 连字符 `-`
- 去除标点和特殊字符（`¿ ¡ . , ? ! ( )`）
- 保留字母、数字、连字符
- 末尾加 `.mp3`

示例：
- `"Buenos días"` → `buenos-dias.mp3`
- `"¿Cómo te llamas?"` → `como-te-llamas.mp3`
- `"Me levanto a las siete."` → `me-levanto-a-las-siete.mp3`

---

## 脚本要求

### 脚本路径
```
scripts/generate-unit-audio.mjs
```

### 处理范围

每个单元 JSON 中需要生成音频的字段：

```
vocabGroups[].items[].es         → 单词/短语
phrases[].items[].es             → 句型
dialogues[].lines[].es           → 对话台词
```

grammarCards 的 example 字段和 compareCards 的 body 字段**不需要**生成音频。

### 脚本逻辑

```
for each unidad-N.json (N = 1..9):
  for each audioable field:
    1. 取 es 文本
    2. slug 化得到文件名
    3. 检查 public/audio/units/unidad-N/{slug}.mp3 是否已存在
       - 已存在：跳过（避免重复生成，节省时间）
    4. 不存在：调用 msedge-tts 生成，保存文件
    5. 将 audioSrc 更新为 "/audio/units/unidad-N/{slug}.mp3"
  将更新后的 JSON 写回文件
```

### 幂等性要求

脚本必须支持重复运行：已存在的文件跳过，只生成缺失的。方便断点续传。

### 并发控制

TTS 调用加并发限制（每次最多 3 个并行），避免触发频率限制。

### 进度输出

每生成一个文件输出一行日志：
```
[unidad-1] buenos-dias.mp3 ✓
[unidad-1] como-te-llamas.mp3 (skip, exists)
```

---

## 运行方式

```bash
node scripts/generate-unit-audio.mjs
```

可选参数（便于单独重跑某个单元）：
```bash
node scripts/generate-unit-audio.mjs --unit=unidad-1
```

---

## 音频数量估算

| 字段 | 每单元约 | 9 单元合计 |
|------|---------|-----------|
| vocabGroups items | 20 条 | 180 |
| phrases items | 7 条 | 63 |
| dialogues lines | 11 条 | 99 |
| **合计** | **~38 条** | **~340 条** |

生成时间估算：每条约 1-2 秒，约 340 条，预计 **6-12 分钟**。

---

## 验收标准

1. `public/audio/units/unidad-N/` 目录下有对应 MP3 文件
2. 每个 MP3 文件大小 > 1KB（确认不是空文件）
3. 所有 unidad-*.json 的 `audioSrc` 字段已填入正确路径（非空字符串）
4. 脚本重复运行结果一致（幂等）
5. 浏览器中点击音频按钮可正常播放
6. `npm test` 通过
