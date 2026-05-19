# AUDIO-001 — Lectura 段落朗读 + LookupCard 单词发音

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-19
**状态**：`ready_for_dev`
**前置依赖**：READ-001 ✅、COURSE-004 ✅（已有 msedge-tts 经验）

---

## 背景

PM 反馈（2026-05-19）：

> 我们加的有 TTS，可以给阅读以及词语加上语音部分的。

当前缺口：
- **Lectura** 是纯文本，初学者不知道生词怎么发音
- **LookupCard** 查词只有义项 + 例句，没有语音

两层音频用不同方案：

| 层 | 方案 | 理由 |
|---|---|---|
| **Lectura 段落** | 预生成 MP3（msedge-tts，沿用 COURSE-004 流水线） | 段落是已知静态内容，预生成 = 零运行时成本、零 API quota、可缓存到 PWA 离线、Edge voice 质量好 |
| **LookupCard 单词** | 浏览器原生 Web Speech API | 词是动态的（每次点啥都不一样），运行时合成更合适；单词不涉及语调问题，Web Speech 质量够；零基础设施 |

---

## Part A — Lectura 段落朗读

### A.1 生成脚本

新建 `scripts/generate-lectura-audio.mjs`，参考 `scripts/generate-unit-audio.mjs` (COURSE-004) 的结构：

```js
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { mkdir, writeFile, access } from "node:fs/promises";
import { lecturaStories } from "../content/lectura/index.ts";

const VOICE = "es-MX-DaliaNeural"; // 自然女声西语
const OUTPUT_BASE = "public/audio/lectura";

async function synth(text, outPath) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const stream = tts.toStream(text);
  const chunks = [];
  for await (const chunk of stream.audioStream) chunks.push(chunk);
  await writeFile(outPath, Buffer.concat(chunks));
}

async function exists(p) {
  return access(p).then(() => true).catch(() => false);
}

for (const story of lecturaStories) {
  const dir = `${OUTPUT_BASE}/${story.slug}`;
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < story.paragraphs.length; i++) {
    const out = `${dir}/p${i}.mp3`;
    if (await exists(out)) {
      console.log(`skip ${out}`);
      continue;
    }
    await synth(story.paragraphs[i], out);
    console.log(`✓ ${out}`);
  }
}
```

并发：保持顺序（COURSE-004 经验：并发会导致 0 字节文件）。每段约 1-2 秒，5 篇 × ~7 段 = 35 个 MP3，全部跑完约 1 分钟。

注意：脚本里 `import { lecturaStories } from "../content/lectura/index.ts"` 在纯 Node 跑会因 `.ts` 扩展名失败——参考 COURSE-004，用 `tsx` 或 `--loader` 跑。最简单：`package.json` 加 `"audio:lectura": "tsx scripts/generate-lectura-audio.mjs"`。

### A.2 产物路径约定

```
public/audio/lectura/
├── la-tortuga-y-la-liebre/
│   ├── p0.mp3
│   ├── p1.mp3
│   └── ...
├── el-leon-y-el-raton/
│   └── ...
└── ...
```

### A.3 类型扩展

`content/lectura/types.ts` 不动（音频路径按约定从 slug 推导，不需要数据里冗余存）。

阅读时通过 `/audio/lectura/{slug}/p{i}.mp3` 直接 fetch，命中就有、没命中就退化（按钮 disabled 或不渲染）。

### A.4 LecturaReader UI 改动

每个 `<p>` 段落左侧加一个**小播放按钮**（hover 时显示，移动端始终显示）：

```
[▶]  Había una vez una liebre muy rápida...
```

- 按钮：`h-6 w-6 shrink-0` 圆形，灰色描边，hover 时变 brand-500
- 点击：用 `new Audio("/audio/lectura/{slug}/p{i}.mp3").play()`
- 播放中：按钮变成 ▌▌（暂停）+ 段落左边框 brand-500 高亮
- 播放结束：还原
- 复用 `AudioButton` 组件（COURSE-001 的）——加一个 `compact` size 变体

同一时刻**只有一个段落在响**：点新的会停旧的。用 `useRef<HTMLAudioElement | null>` 维护当前播放实例。

### A.5 「整篇连播」（可选 v1，不强求）

阅读页顶部加一个「🔊 朗读全篇」按钮，依次播 p0 → p1 → ... → 结束。当前播段落自动 scrollIntoView 居中。

如果时间紧 v1 只做单段播放，连播留 v2。

---

## Part B — LookupCard 单词发音

### B.1 UI 改动

`src/app/watch/LookupCard.tsx` 头部（lemma 显示位置）右边加一个发音按钮：

```
vivir  v.  [🔊]
/bi.ˈβiɾ/
```

- 按钮：`h-7 w-7` 圆角，灰色描边
- 点击：调 Web Speech API 发音
- 朗读期间按钮变 brand 色 + 微动画（CSS pulse）

### B.2 实现（纯前端）

```ts
function speak(text: string, lang: string = "es-MX") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  // 取消上一次（防叠播）
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.9; // 略慢一点，初学者友好
  // 优先 es-* 任意西语 voice
  const voices = window.speechSynthesis.getVoices();
  const esVoice =
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang?.startsWith("es")) ??
    null;
  if (esVoice) utter.voice = esVoice;
  window.speechSynthesis.speak(utter);
}
```

注意：
- `getVoices()` 在某些浏览器首次访问时返回空数组——需要监听 `voiceschanged` 事件再调一次
- 把这段逻辑抽到 `src/lib/speak.ts` 让两个组件复用

### B.3 浏览器兼容降级

- 不支持 Web Speech API 的（少见）：按钮隐藏，不报错
- 没有西语 voice 的设备（极少）：按钮仍可点，浏览器会用默认英语 voice「读」西语，效果很差但不会 crash

提供一个 `useSpeechAvailable()` hook：
```ts
function useSpeechAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const check = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailable(voices.some((v) => v.lang?.startsWith("es")));
    };
    check();
    window.speechSynthesis.onvoiceschanged = check;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);
  return available;
}
```

`available === false` 时不渲染发音按钮。

### B.4 例句也加发音

LookupCard 里 example 区域的西语行右边也加同款 🔊 按钮，速率 0.85（更慢，让用户听清完整句子）。

---

## 三、文件清单

**新增**：
- `scripts/generate-lectura-audio.mjs`
- `public/audio/lectura/*/p*.mp3`（脚本产物，35 个文件约 3MB；**入 git 是合理的**——内容不变 + 离线 PWA 需要）
- `src/lib/speak.ts`（Web Speech API helper + hook）
- `tests/audio001.test.mjs`

**修改**：
- `package.json`：加 `audio:lectura` 脚本
- `src/app/lectura/LecturaReader.tsx`：每段加播放按钮，maintain `currentPlaying` ref
- `src/app/watch/LookupCard.tsx`：lemma 旁 + example 句子旁加 🔊 按钮
- `src/app/components/audio/AudioButton.tsx`（COURSE-001 已存在）：加 `compact` size 变体

---

## 四、测试断言

- `scripts/generate-lectura-audio.mjs` 存在并 import msedge-tts + lecturaStories
- 至少 5 个 lectura slug 都有 `public/audio/lectura/<slug>/p0.mp3` 文件
- `src/lib/speak.ts` export `speak` + `useSpeechAvailable`
- `LecturaReader.tsx` 含 `new Audio(` 或 `<audio>` 引用 `/audio/lectura/`
- `LookupCard.tsx` 含对 `speak(` 的调用，参数包含 lemma
- 不破坏现有 READ-001 / WEB-005 / VOCAB-004 测试

---

## 五、验收

1. `npm test` 通过；`npm run build` 通过
2. **本地跑** `npm run audio:lectura` → 看到 35 个 MP3 生成
3. 访问 `/lectura/la-tortuga-y-la-liebre` → 每段左侧有 ▶ → 点 → 听到自然西语女声
4. 同时点两段 → 旧段停、新段开，不重叠
5. 任意视频里点字幕词 → LookupCard 出 → 点 🔊 → 听到该词朗读
6. PWA 装到桌面 → 飞行模式 → Lectura 段落音频**仍能播放**（service worker 缓存了）
7. **不支持 TTS 的设备**（隐私模式 + 禁用 speechSynthesis）→ 词语 🔊 按钮不显示但页面不崩

---

## 六、不在本 ticket 范围内

- 「整篇连播」+ 段落自动 scrollIntoView 同步 → 留 AUDIO-002
- 用户自定义朗读速度 → 留下一轮 UX polish
- 朗读字级高亮（karaoke 风格）→ 复杂度太高，远期
- 替换 msedge-tts 成其它 TTS 引擎（Azure TTS、OpenAI TTS 等） → 当前免费方案够用
- 词库页（/vocab）每个词加发音按钮 → 留下一轮
- 课程 /learn 现有 audioSrc 体系不动（COURSE-004 已经在用 msedge-tts，本票不影响）

---

## 七、注意

- **msedge-tts 一定要顺序跑**（COURSE-004 教训），并发会出 0 字节文件
- 音频文件入 git 而不是 .gitignore——内容稳定 + 离线 PWA 需要、+ Vercel 部署即可命中、+ 总量 < 5MB
- Web Speech API 在不同 OS 上声音质量差异大（Windows Edge 西语好、Android Chrome 一般、iOS Safari 较弱），我们接受这个差异，不试图统一
- Service Worker（PWA-001）需要把 `/audio/lectura/**.mp3` 加进 runtime caching（CacheFirst 策略），否则离线时还是放不出。Codex1 实现时记得同步更新 `src/sw.ts`
